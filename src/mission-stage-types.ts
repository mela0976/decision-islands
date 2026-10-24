import type { I18nText } from './explorer-types';

export const MISSION_SETTINGS = ['home', 'community', 'office', 'commute', 'brand-studio', 'meeting', 'production', 'insight-lab'] as const;
export type MissionSetting = typeof MISSION_SETTINGS[number];
export const MISSION_PROPS = ['adult', 'child', 'elder', 'robot', 'phone', 'screen', 'document', 'book', 'mug', 'cart', 'bag', 'calendar', 'poster', 'microphone', 'camera', 'chart', 'magnifier', 'shield', 'check', 'heart', 'playlist', 'globe', 'clapperboard', 'lightbulb', 'stop'] as const;
export type MissionPropKind = typeof MISSION_PROPS[number];
export interface MissionSceneEntity {
  id: string;
  kind: MissionPropKind;
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
  pose?: 'idle' | 'present' | 'listen' | 'work' | 'walk';
  label?: I18nText;
}
export interface MissionSceneFlow {
  id: string;
  from: string;
  to: string;
  kind: 'share' | 'review' | 'handoff' | 'pause';
}
export interface MissionVisualFrame {
  description: I18nText;
  entities: readonly MissionSceneEntity[];
  flows: readonly MissionSceneFlow[];
  actions?: readonly MissionSceneAction[];
}
export interface MissionSceneAction {
  kind: 'show' | 'review' | 'operate' | 'handoff' | 'pause';
  actor: string;
  target: string;
  prop?: string;
}
export interface MissionVisualDefinition {
  setting: MissionSetting;
  title: I18nText;
  initial: MissionVisualFrame;
  choices: Readonly<Record<string, MissionVisualFrame>>;
}
export interface MissionStageInput {
  key: string;
  definition: MissionVisualDefinition;
  choiceId: string | null;
  previewChoiceId: string | null;
  comparisonView?: 'before' | 'after';
  animate?: boolean;
}
export interface MissionStage {
  update(input: MissionStageInput): void;
  setActive(active: boolean): void;
  setMotion(enabled: boolean): void;
  dispose(): void;
}
