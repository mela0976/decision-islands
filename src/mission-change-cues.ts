import type { I18nText } from './explorer-types';
import type { MissionSceneEntity, MissionStageInput, MissionVisualFrame } from './mission-stage-types';

const actors = new Set(['adult', 'child', 'elder', 'robot']);
const position = (entity: MissionSceneEntity): [number, number, number] => [(entity.x - 50) * .12, actors.has(entity.kind) ? 0 : .85, actors.has(entity.kind) ? (entity.y - 75) * .1 + 1.3 : (entity.y - 60) * .07 - .4];

export function resolveMissionEntityPose(entity: MissionSceneEntity, frame: MissionVisualFrame) {
  const joints = Array<number>(18).fill(0);
  const action = frame.actions?.find(item => item.actor === entity.id);
  const receivedAction = frame.actions?.find(item => item.target === entity.id && item.actor !== entity.id);
  const flow = frame.flows.find(item => item.from === entity.id || item.to === entity.id);
  const otherId = action?.target ?? receivedAction?.actor ?? (flow && (flow.from === entity.id ? flow.to : flow.from));
  const other = frame.entities.find(item => item.id === otherId);
  const point = position(entity), target = other ? position(other) : null;
  if (actors.has(entity.kind)) {
    const peers = frame.entities.filter(item => actors.has(item.kind) && (item.opacity ?? 1) > .04).sort((a, b) => a.id.localeCompare(b.id));
    const index = peers.findIndex(item => item.id === entity.id);
    for (let prior = 0; prior < index; prior++) {
      const neighbor = position(peers[prior]);
      if (Math.abs(point[0] - neighbor[0]) < .8 && Math.abs(point[2] - neighbor[2]) < .75) point[2] = neighbor[2] + .85;
    }
  }
  const yaw = actors.has(entity.kind) && target ? Math.atan2(target[0] - point[0], target[2] - point[2]) : -.25;
  const pose = entity.pose ?? 'idle';
  if (pose === 'present' || action?.kind === 'show' || action?.kind === 'handoff' || (flow && flow.from === entity.id)) { joints[9] = -1.05; joints[11] = -.24; joints[3] = -.07; }
  if (pose === 'work' || action?.kind === 'operate' || action?.kind === 'review') { joints[6] = -.95; joints[9] = -.95; joints[3] = .16; joints[0] = .22; }
  if (pose === 'listen' || (flow && flow.to === entity.id)) { joints[0] = .13; joints[2] = .08; joints[6] = -.32; }
  if (receivedAction && actors.has(entity.kind)) { joints[0] = .16; joints[6] = receivedAction.kind === 'handoff' ? -.85 : -.36; joints[9] = -.38; }
  if (action?.kind === 'pause' || (!action && flow?.kind === 'pause')) { joints[9] = -.9; joints[11] = -.65; joints[3] = -.12; }
  return { position: point, yaw, joints, scale: (entity.scale ?? 1) * (actors.has(entity.kind) ? 1.45 : 1.35), opacity: entity.opacity ?? 1 };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const text = (zh: string, en: string): I18nText => ({ zh, en });

export function resolveMissionChangeCue(input: MissionStageInput, renderer: 'webgl' | 'svg' = 'webgl'): { entityIds: readonly string[]; labels: readonly I18nText[] } {
  const choice = input.previewChoiceId ?? input.choiceId;
  const after = choice == null ? undefined : input.definition.choices[choice];
  if (!after) return { entityIds: [], labels: [] };
  const before = input.definition.initial;
  const initial = new Map(before.entities.map(entity => [entity.id, entity]));
  const selected = new Map(after.entities.map(entity => [entity.id, entity]));
  const entityIds: string[] = [], labels = new Map<string, {label: I18nText; actor: boolean; visibility: boolean}>();
  const add = (zh: string, en: string) => labels.set(zh, {label: text(zh, en), actor: zh.startsWith('人物'), visibility: zh.endsWith('增減')});
  for (const id of new Set([...initial.keys(), ...selected.keys()])) {
    const from = initial.get(id), to = selected.get(id);
    const fromVisible = !!from && (from.opacity ?? 1) > .005;
    const toVisible = !!to && (to.opacity ?? 1) > .005;
    if (!fromVisible && !toVisible) continue;
    if (fromVisible !== toVisible) {
      entityIds.push(id);
      const actor = actors.has((to ?? from)!.kind);
      add(actor ? '人物增減' : '道具增減', actor ? 'People appear or disappear' : 'Props appear or disappear');
      continue;
    }
    const renderedPose = (entity: MissionSceneEntity, frame: MissionVisualFrame) => renderer === 'webgl' ? resolveMissionEntityPose(entity, frame) : {
      position: [entity.x, entity.y, 0], yaw: entity.pose === 'present' ? -7 : entity.pose === 'work' ? 5 : entity.pose === 'listen' ? -3 : 0,
      joints: actors.has(entity.kind) ? [['idle', 'present', 'listen', 'work', 'walk'].indexOf(entity.pose ?? 'idle')] : [], scale: entity.scale ?? 1, opacity: entity.opacity ?? 1,
    };
    const start = renderedPose(from!, before), end = renderedPose(to!, after);
    const actor = actors.has(to!.kind);
    if (from!.kind === to!.kind && same({...start, joints: actor ? start.joints : []}, {...end, joints: actor ? end.joints : []})) continue;
    entityIds.push(id);
    if (!same(start.position, end.position)) add(actor ? '人物位置改變' : '道具位置改變', actor ? 'People change position' : 'Props change position');
    if (actor && (!same(start.joints, end.joints) || start.yaw !== end.yaw)) add('人物動作改變', 'People change pose');
    if (!actor && start.yaw !== end.yaw) add('道具外觀改變', 'Prop appearance changes');
    if (from!.kind !== to!.kind) add(actor ? '人物外觀改變' : '道具外觀改變', actor ? 'Person appearance changes' : 'Prop appearance changes');
    if (start.scale !== end.scale || start.opacity !== end.opacity) add(actor ? '人物外觀改變' : '道具外觀改變', actor ? 'Person appearance changes' : 'Prop appearance changes');
  }
  if (after.changeHints !== undefined) {
    const changed = new Set(entityIds);
    const view = input.comparisonView === 'before' ? 'before' : 'after';
    return { entityIds, labels: after.changeHints.filter(hint => hint.entityIds.some(id => changed.has(id))).slice(0, 2).map(hint => hint[view]) };
  }
  const ordered = [...labels.values()].sort((a, b) => Number(b.visibility) - Number(a.visibility));
  const actorLabel = ordered.find(item => item.actor), propLabel = ordered.find(item => !item.actor);
  const selectedLabels = actorLabel && propLabel ? [actorLabel, propLabel] : ordered.slice(0, 2);
  return { entityIds, labels: selectedLabels.map(item => item.label) };
}
