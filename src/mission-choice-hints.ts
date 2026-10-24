import { EVERYDAY_MISSION_HINTS } from './mission-choice-hints-everyday';
import { MARKETING_MISSION_HINTS } from './mission-choice-hints-marketing';
import type { MissionChangeHint } from './mission-stage-types';

export const MISSION_CHOICE_HINTS: Readonly<Record<string, Readonly<Record<'a' | 'b', readonly MissionChangeHint[]>>>> = {
  ...EVERYDAY_MISSION_HINTS,
  ...MARKETING_MISSION_HINTS,
};
