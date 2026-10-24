import './mission-stage.css';
import { createMission3DStage } from './mission-3d-stage';
import { createSvgMissionStage } from './mission-svg-stage';
import type { MissionStage, MissionStageInput } from './mission-stage-types';
import type { Mission3DStage, Mission3DSnapshot } from './mission-3d-types';

type MissionStagePhase = Mission3DSnapshot['phase'];
type VisibleMissionStagePhase = Exclude<MissionStagePhase, 'ready'>;
type MissionStagePhaseDetail = Readonly<{phase: MissionStagePhase; choiceId: string | null; preview: boolean}>;
type MissionStagePhaseTarget = Readonly<{key: string; choiceId: string | null; preview: boolean}>;

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
  if (!isMissionStagePhase(detail.phase) || (detail.choiceId !== null && typeof detail.choiceId !== 'string') || typeof detail.preview !== 'boolean') return null;
  return {phase: detail.phase, choiceId: detail.choiceId, preview: detail.preview};
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
  const caption = document.createElement('figcaption');
  figure.dataset.phase = 'ready';
  figure.append(viewport, phaseIndicator, replay, caption);
  shell.append(figure);
  host.append(shell);
  let input: MissionStageInput | undefined;
  let phaseTarget: MissionStagePhaseTarget | null = null;
  let active = true, motion = true, disposed = false;
  let fallback: MissionStage | undefined;
  let engine: Mission3DStage | undefined;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncReplay = () => { replay.disabled = !input || !(input.previewChoiceId ?? input.choiceId) || !motion || media.matches; };
  const setPhase = (phase: MissionStagePhase) => {
    figure.dataset.phase = phase;
    phaseIndicator.hidden = phase === 'ready';
    for (const [itemPhase, item] of phaseItems) {
      if (itemPhase === phase) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
  };
  const onPhase = (event: Event) => {
    if (disposed || fallback || event.target !== viewport.querySelector('canvas') || !input) return;
    const detail = readMissionStagePhaseDetail(event);
    const choiceId = input.previewChoiceId ?? input.choiceId;
    if (!detail || !choiceId || detail.choiceId !== choiceId || detail.preview !== Boolean(input.previewChoiceId)) return;
    setPhase(detail.phase);
  };
  figure.addEventListener('mission-stage-phase', onPhase);
  media.addEventListener('change', syncReplay);

  const useFallback = () => {
    if (disposed || fallback) return;
    engine?.setActive(false);
    figure.remove();
    fallback = createSvgMissionStage(shell, language);
    shell.querySelector<HTMLElement>('.mission-stage')!.dataset.renderer = 'fallback';
    fallback.setActive(active);
    fallback.setMotion(motion);
    if (input) fallback.update(input);
  };
  engine = createMission3DStage(viewport, language, failed => { if (failed) useFallback(); });
  if (fallback) engine.setActive(false);
  const onReplay = () => engine?.replay();
  replay.addEventListener('click', onReplay);

  return {
    update(next) {
      if (disposed) return;
      const choice = next.previewChoiceId ?? next.choiceId;
      const preview = Boolean(next.previewChoiceId);
      const changedTarget = !phaseTarget || phaseTarget.key !== next.key || phaseTarget.choiceId !== choice || phaseTarget.preview !== preview;
      phaseTarget = {key: next.key, choiceId: choice, preview};
      input = next;
      const frame = choice ? next.definition.choices[choice] ?? next.definition.initial : next.definition.initial;
      figure.dataset.choiceId = choice ?? '';
      figure.dataset.preview = String(preview);
      if (changedTarget) setPhase('ready');
      const label = preview
        ? (language === 'zh' ? '另一種做法（預覽）' : 'Alternative choice (preview)')
        : next.choiceId
          ? (language === 'zh' ? '你選的做法' : 'Your choice')
          : (language === 'zh' ? '情境演示' : 'Scenario');
      caption.textContent = `${label}：${frame.description[language]}`;
      syncReplay();
      if (fallback) fallback.update(next);
      else {
        engine!.update(next);
        viewport.querySelector('canvas')?.setAttribute('aria-label', `${next.definition.title[language]}。${frame.description[language]}`);
        viewport.querySelector('canvas')?.setAttribute('title', language === 'zh' ? '拖曳查看場景' : 'Drag to inspect the scene');
        figure.dataset.setting = next.definition.setting;
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
      figure.removeEventListener('mission-stage-phase', onPhase);
      media.removeEventListener('change', syncReplay);
      engine?.dispose();
      fallback?.dispose();
      shell.remove();
    },
  };
}
