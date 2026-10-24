import { MISSION_PROPS, MISSION_SETTINGS } from './mission-stage-types';
import type { MissionVisualDefinition } from './mission-stage-types';
import type { I18nText } from './explorer-types';

export function validateMissionVisual(visual: MissionVisualDefinition, choices: readonly string[]): void {
  const text = (value: I18nText) => {
    if (!value || typeof value.zh !== 'string' || !value.zh.trim() || typeof value.en !== 'string' || !value.en.trim()) throw new Error('visual text needs both languages');
  };
  const id = (value: string, seen: Set<string>) => {
    if (typeof value !== 'string' || !value.trim() || seen.has(value)) throw new Error('duplicate or empty visual entity ID');
    seen.add(value);
  };
  if (!MISSION_SETTINGS.includes(visual.setting)) throw new Error('unknown mission setting');
  text(visual.title);
  if (!visual.choices || Object.keys(visual.choices).length !== choices.length || choices.some(choice => !Object.hasOwn(visual.choices, choice))) throw new Error('visual choices must match mission choices');
  for (const frame of [visual.initial, ...Object.values(visual.choices)]) {
    if (!frame || !Array.isArray(frame.entities) || frame.entities.length < 1 || frame.entities.length > 20 || !Array.isArray(frame.flows)) throw new Error('invalid mission visual frame');
    text(frame.description);
    const entities = new Set<string>();
    for (const entity of frame.entities) {
      id(entity.id, entities);
      if (!MISSION_PROPS.includes(entity.kind)) throw new Error('unknown mission prop');
      if (![entity.x, entity.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error('visual position out of bounds');
      if (entity.scale !== undefined && (!Number.isFinite(entity.scale) || entity.scale < .3 || entity.scale > 2)) throw new Error('visual scale out of bounds');
      if (entity.opacity !== undefined && (!Number.isFinite(entity.opacity) || entity.opacity < 0 || entity.opacity > 1)) throw new Error('visual opacity out of bounds');
      if (entity.pose !== undefined && !['idle', 'present', 'listen', 'work', 'walk'].includes(entity.pose)) throw new Error('unknown mission pose');
      if (entity.label) text(entity.label);
    }
    const flows = new Set<string>();
    for (const flow of frame.flows) {
      id(flow.id, flows);
      if (!entities.has(flow.from) || !entities.has(flow.to) || flow.from === flow.to) throw new Error('invalid visual flow endpoints');
      if (!['share', 'review', 'handoff', 'pause'].includes(flow.kind)) throw new Error('unknown visual flow');
    }
  }
}
