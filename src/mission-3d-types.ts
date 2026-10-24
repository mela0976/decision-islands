import type * as THREE from 'three';
import type { MissionPropKind, MissionSetting, MissionStageInput } from './mission-stage-types';

export interface MissionActorJoints {
  head: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}
export interface Mission3DModel {
  root: THREE.Group;
  joints?: MissionActorJoints;
}
export interface Mission3DAssets {
  room(setting: MissionSetting): THREE.Group;
  entity(kind: MissionPropKind, id: string): Mission3DModel;
  dispose(): void;
}
export interface Mission3DSnapshot {
  mode: 'webgl' | 'fallback';
  animating: boolean;
  progress: number;
  phase: 'ready' | 'approach' | 'interact' | 'result';
  comparisonView: 'before' | 'after';
  choiceId: string | null;
  previewChoiceId: string | null;
  comparisonCue: { active: boolean; token: number | null; entityIds: readonly string[] };
  camera: { position: number[]; left: number; right: number; top: number; bottom: number };
  effects: {kind: 'action-focus'; action: string; target: string; position: number[]}[];
  entities: {id: string; kind: string; position: number[]; rotation: number[]; visible: boolean; joints: number[]; projected: {left: number; top: number; right: number; bottom: number; width: number; height: number}}[];
  flowCount: number;
  renderCount: number;
}
export interface Mission3DStage {
  update(input: MissionStageInput): void;
  setActive(active: boolean): void;
  setMotion(enabled: boolean): void;
  replay(): void;
  snapshot(): Mission3DSnapshot;
  dispose(): void;
}
