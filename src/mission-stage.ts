import './mission-stage.css';
import { createMission3DStage } from './mission-3d-stage';
import { createSvgMissionStage, type SvgMissionStage } from './mission-svg-stage';
import type { MissionStage, MissionStageInput } from './mission-stage-types';
import type { Mission3DStage, Mission3DSnapshot } from './mission-3d-types';

type MissionStagePhase = Mission3DSnapshot['phase'];
type VisibleMissionStagePhase = Exclude<MissionStagePhase, 'ready'>;
type MissionStagePhaseDetail = Readonly<{phase: MissionStagePhase; choiceId: string | null; preview: boolean; comparisonView?: 'before' | 'after'}>;
type MissionStagePhaseTarget = Readonly<{key: string; choiceId: string | null; previewChoiceId: string | null}>;

const VISIBLE_PHASES: readonly VisibleMissionStagePhase[] = ['approach', 'interact', 'result'];
const PHASE_LABELS: Record<'zh' | 'en', Record<VisibleMissionStagePhase, string>> = {
  zh: {approach: '準備', interact: '操作', result: '結果'},
  en: {approach: 'Prepare', interact: 'Act', result: 'Result'},
};

function isMissionStagePhase(value: unknown): value is MissionStagePhase {
  return value === 'ready' || value === 'approach' || value === 'interact' || value === 'result';
}

function readMissionStagePhaseDetail(event: Event): MissionStagePhaseDetail | null {
  if (!(event instanceof CustomEvent) || typeof event.detail !== 'object' || event.detail === null) return null;
  const detail = event.detail as Record<string, unknown>;
  if (!isMissionStagePhase(detail.phase) || (detail.choiceId !== null && typeof detail.choiceId !== 'string') || typeof detail.preview !== 'boolean' || (detail.comparisonView != null && detail.comparisonView !== 'before' && detail.comparisonView !== 'after')) return null;
  return {phase: detail.phase, choiceId: detail.choiceId, preview: detail.preview, comparisonView: detail.comparisonView as 'before' | 'after' | undefined};
}

export function createMissionStage(host: HTMLElement, language: 'zh' | 'en'): MissionStage {
  const shell = document.createElement('div');
  shell.className = 'mission-stage-shell';
  const figure = document.createElement('figure');
  figure.className = 'mission-stage mission-stage--3d';
  figure.dataset.renderer = 'webgl';
  const viewport = document.createElement('div');
  viewport.className = 'mission-stage-viewport';
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'mission-stage-replay';
  replay.textContent = language === 'zh' ? '重播動作' : 'Replay action';
  replay.disabled = true;
  const phaseIndicator = document.createElement('ol');
  phaseIndicator.className = 'mission-stage-phase';
  phaseIndicator.setAttribute('aria-label', language === 'zh' ? '動作進度' : 'Action progress');
  phaseIndicator.hidden = true;
  const phaseItems = new Map<VisibleMissionStagePhase, HTMLLIElement>();
  for (const phase of VISIBLE_PHASES) {
    const item = document.createElement('li');
    item.textContent = PHASE_LABELS[language][phase];
    phaseItems.set(phase, item);
    phaseIndicator.append(item);
  }
  const comparison = document.createElement('div');
  comparison.className = 'mission-stage-comparison';
  comparison.setAttribute('role', 'group');
  comparison.setAttribute('aria-label', language === 'zh' ? '場景比較' : 'Scene comparison');
  comparison.hidden = true;
  const comparisonButtons = new Map<'before' | 'after', HTMLButtonElement>();
  for (const view of ['before', 'after'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.missionView = view;
    button.textContent = view === 'before'
      ? (language === 'zh' ? '選擇前' : 'Before choice')
      : (language === 'zh' ? '選擇後' : 'After choice');
    button.setAttribute('aria-pressed', 'false');
    comparisonButtons.set(view, button);
    comparison.append(button);
  }
  const caption = document.createElement('figcaption');
  figure.dataset.phase = 'ready';
  figure.append(viewport, phaseIndicator, comparison, replay, caption);
  shell.append(figure);
  host.append(shell);
  let input: MissionStageInput | undefined;
  let comparisonView: 'before' | 'after' = 'after';
  let currentPhase: MissionStagePhase = 'ready';
  let activeFigure: HTMLElement = figure;
  let phaseTarget: MissionStagePhaseTarget | null = null;
  let active = true, motion = true, disposed = false;
  let fallback: SvgMissionStage | undefined;
  let engine: Mission3DStage | undefined;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selectedChoice = () => input?.previewChoiceId ?? input?.choiceId ?? null;
  const syncReplay = () => { replay.disabled = !selectedChoice() || !motion || media.matches; };
  const syncComparison = () => {
    const hasChoice = Boolean(selectedChoice());
    const visible = hasChoice && (Boolean(fallback) || comparisonView === 'before' || currentPhase === 'result');
    comparison.hidden = !visible;
    phaseIndicator.hidden = currentPhase === 'ready' || comparisonView === 'before' || (currentPhase === 'result' && visible);
    for (const [view, button] of comparisonButtons) button.setAttribute('aria-pressed', String(comparisonView === view));
    activeFigure.dataset.comparisonView = comparisonView;
  };
  const stageInput = (animate?: boolean): MissionStageInput => {
    const next = {...input!};
    delete next.comparisonView;
    delete next.animate;
    if (selectedChoice()) next.comparisonView = comparisonView;
    if (animate !== undefined) next.animate = animate;
    return next;
  };
  const frameForView = (): MissionStageInput['definition']['initial'] => {
    if (comparisonView === 'before') return input!.definition.initial;
    const choice = selectedChoice();
    return choice ? input!.definition.choices[choice] ?? input!.definition.initial : input!.definition.initial;
  };
  const syncCaption = () => {
    if (!input) return;
    const choice = selectedChoice();
    const frame = frameForView();
    const label = comparisonView === 'before' && choice
      ? (language === 'zh' ? (input.previewChoiceId ? '選擇前（預覽）' : '選擇前') : (input.previewChoiceId ? 'Before choice (preview)' : 'Before choice'))
      : input.previewChoiceId
        ? (language === 'zh' ? '另一種做法（預覽）' : 'Alternative choice (preview)')
        : input.choiceId
          ? (language === 'zh' ? '你選的做法' : 'Your choice')
          : (language === 'zh' ? '情境演示' : 'Scenario');
    caption.textContent = `${label}：${frame.description[language]}`;
  };
  const setPhase = (phase: MissionStagePhase) => {
    currentPhase = phase;
    activeFigure.dataset.phase = phase;
    for (const [itemPhase, item] of phaseItems) {
      if (itemPhase === phase) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
    syncComparison();
  };
  const onPhase = (event: Event) => {
    if (disposed || fallback || event.target !== viewport.querySelector('canvas') || !input) return;
    const detail = readMissionStagePhaseDetail(event);
    const choiceId = input.previewChoiceId ?? input.choiceId;
    if (!detail || comparisonView === 'before' || !choiceId || detail.choiceId !== choiceId || detail.preview !== Boolean(input.previewChoiceId) || (detail.comparisonView != null && detail.comparisonView !== comparisonView)) return;
    setPhase(detail.phase);
  };
  figure.addEventListener('mission-stage-phase', onPhase);
  media.addEventListener('change', syncReplay);

  const useFallback = () => {
    if (disposed || fallback) return;
    engine?.setActive(false);
    fallback = createSvgMissionStage(shell, language);
    const fallbackFigure = shell.lastElementChild as HTMLElement;
    fallbackFigure.dataset.renderer = 'fallback';
    fallbackFigure.dataset.choiceId = figure.dataset.choiceId ?? '';
    fallbackFigure.dataset.preview = figure.dataset.preview ?? 'false';
    phaseIndicator.remove();
    fallbackFigure.append(comparison, replay);
    figure.remove();
    activeFigure = fallbackFigure;
    fallback.setActive(active);
    fallback.setMotion(motion);
    if (input) {
      fallback.update(stageInput());
      syncCaption();
      activeFigure.dataset.setting = input.definition.setting;
      setPhase(comparisonView === 'before' ? 'ready' : selectedChoice() ? 'result' : 'ready');
    }
  };
  engine = createMission3DStage(viewport, language, failed => { if (failed) useFallback(); });
  if (fallback) engine.setActive(false);
  const setComparisonView = (view: 'before' | 'after') => {
    if (!input || !selectedChoice()) return;
    comparisonView = view;
    setPhase(view === 'before' ? 'ready' : 'result');
    syncCaption();
    const next = stageInput(false);
    if (fallback) fallback.update(next);
    else engine?.update(next);
  };
  const onComparison = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-mission-view]');
    const view = button?.dataset.missionView;
    if (view === 'before' || view === 'after') setComparisonView(view);
  };
  const onReplay = () => {
    if (replay.disabled) return;
    if (comparisonView === 'before') setComparisonView('after');
    if (fallback) fallback.replay();
    else engine?.replay();
  };
  comparison.addEventListener('click', onComparison);
  replay.addEventListener('click', onReplay);

  return {
    update(next) {
      if (disposed) return;
      const choice = next.previewChoiceId ?? next.choiceId;
      const changedTarget = !phaseTarget || phaseTarget.key !== next.key || phaseTarget.choiceId !== next.choiceId || phaseTarget.previewChoiceId !== next.previewChoiceId;
      phaseTarget = {key: next.key, choiceId: next.choiceId, previewChoiceId: next.previewChoiceId};
      input = next;
      if (changedTarget) comparisonView = 'after';
      const frame = frameForView();
      activeFigure.dataset.choiceId = choice ?? '';
      activeFigure.dataset.preview = String(Boolean(next.previewChoiceId));
      activeFigure.dataset.comparisonView = comparisonView;
      if (changedTarget) setPhase('ready');
      syncCaption();
      syncReplay();
      syncComparison();
      if (fallback) {
        fallback.update(stageInput());
        setPhase(comparisonView === 'before' ? 'ready' : choice ? 'result' : 'ready');
      }
      else {
        engine!.update(stageInput());
        viewport.querySelector('canvas')?.setAttribute('aria-label', `${next.definition.title[language]}。${frame.description[language]}`);
        viewport.querySelector('canvas')?.setAttribute('title', language === 'zh' ? '拖曳查看場景' : 'Drag to inspect the scene');
        activeFigure.dataset.setting = next.definition.setting;
      }
    },
    setActive(value) {
      active = value;
      fallback?.setActive(value);
      engine?.setActive(value && !fallback);
    },
    setMotion(value) {
      motion = value;
      syncReplay();
      fallback?.setMotion(value);
      engine?.setMotion(value);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      replay.removeEventListener('click', onReplay);
      comparison.removeEventListener('click', onComparison);
      figure.removeEventListener('mission-stage-phase', onPhase);
      media.removeEventListener('change', syncReplay);
      engine?.dispose();
      fallback?.dispose();
      shell.remove();
    },
  };
}
