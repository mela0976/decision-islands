import './mission-stage.css';
import { createMission3DStage } from './mission-3d-stage';
import { createSvgMissionStage } from './mission-svg-stage';
import type { MissionStage, MissionStageInput } from './mission-stage-types';
import type { Mission3DStage } from './mission-3d-types';

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
  const caption = document.createElement('figcaption');
  figure.append(viewport, replay, caption);
  shell.append(figure);
  host.append(shell);
  let input: MissionStageInput | undefined;
  let active = true, motion = true, disposed = false;
  let fallback: MissionStage | undefined;
  let engine: Mission3DStage | undefined;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncReplay = () => { replay.disabled = !input || !(input.previewChoiceId ?? input.choiceId) || !motion || media.matches; };
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
      input = next;
      const choice = next.previewChoiceId ?? next.choiceId;
      const frame = choice ? next.definition.choices[choice] ?? next.definition.initial : next.definition.initial;
      figure.dataset.choiceId = choice ?? '';
      figure.dataset.preview = String(Boolean(next.previewChoiceId));
      const preview = next.previewChoiceId ? (language === 'zh' ? ' · 預覽' : ' · Preview') : '';
      caption.textContent = `${language === 'zh' ? '情境演示' : 'Scene demonstration'}${preview} · ${frame.description[language]}`;
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
      media.removeEventListener('change', syncReplay);
      engine?.dispose();
      fallback?.dispose();
      shell.remove();
    },
  };
}
