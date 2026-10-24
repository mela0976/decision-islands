import type { MissionSceneAction } from './mission-stage-types';

export const MISSION_3D_ACTIONS: Readonly<
  Record<string, Readonly<Record<string, readonly MissionSceneAction[]>>>
> = {
  'shared-memory-1': {
    a: [
      { kind: 'operate', actor: 'adult', target: 'screen', prop: 'playlist' },
      { kind: 'review', actor: 'elder', target: 'screen' },
      { kind: 'review', actor: 'child', target: 'screen' },
    ],
    b: [
      { kind: 'show', actor: 'elder', target: 'adult', prop: 'playlist' },
      { kind: 'show', actor: 'child', target: 'adult', prop: 'phone' },
    ],
  },
  'shared-memory-2': {
    a: [
      { kind: 'operate', actor: 'adult', target: 'screen', prop: 'playlist' },
      { kind: 'show', actor: 'fan', target: 'adult', prop: 'poster' },
    ],
    b: [
      { kind: 'show', actor: 'fan', target: 'elder', prop: 'poster' },
      { kind: 'review', actor: 'adult', target: 'screen' },
    ],
  },
  'shared-memory-3': {
    a: [{ kind: 'review', actor: 'adult', target: 'phone' }],
    b: [
      { kind: 'show', actor: 'elder', target: 'adult', prop: 'book' },
      { kind: 'review', actor: 'adult', target: 'book' },
      { kind: 'review', actor: 'child', target: 'book' },
    ],
  },
  'family-trust-1': {
    a: [
      { kind: 'handoff', actor: 'child', target: 'adult', prop: 'phone' },
      { kind: 'review', actor: 'adult', target: 'phone' },
    ],
    b: [{ kind: 'review', actor: 'adult', target: 'poster' }],
  },
  'family-trust-2': {
    a: [
      { kind: 'show', actor: 'child', target: 'adult', prop: 'poster' },
      { kind: 'review', actor: 'adult', target: 'poster' },
    ],
    b: [
      { kind: 'review', actor: 'adult', target: 'calendar' },
      { kind: 'review', actor: 'elder', target: 'calendar' },
    ],
  },
  'family-trust-3': {
    a: [
      { kind: 'handoff', actor: 'robot', target: 'adult', prop: 'document' },
      { kind: 'review', actor: 'adult', target: 'phone' },
    ],
    b: [
      { kind: 'show', actor: 'robot', target: 'adult', prop: 'document' },
      { kind: 'review', actor: 'adult', target: 'phone' },
    ],
  },
  'experience-value-1': {
    a: [
      { kind: 'operate', actor: 'speaker', target: 'microphone' },
      { kind: 'review', actor: 'newcomer', target: 'speaker' },
    ],
    b: [
      { kind: 'handoff', actor: 'speaker', target: 'newcomer', prop: 'book' },
      { kind: 'review', actor: 'newcomer', target: 'book' },
    ],
  },
  'experience-value-2': {
    a: [
      { kind: 'show', actor: 'robot', target: 'organizer', prop: 'document' },
      { kind: 'review', actor: 'organizer', target: 'screen' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'screen', prop: 'document' },
      { kind: 'review', actor: 'organizer', target: 'screen' },
    ],
  },
  'experience-value-3': {
    a: [{ kind: 'pause', actor: 'speaker', target: 'camera' }],
    b: [{ kind: 'review', actor: 'speaker', target: 'document' }],
  },
  'connection-control-1': {
    a: [
      { kind: 'show', actor: 'elder', target: 'adult', prop: 'book' },
      { kind: 'review', actor: 'adult', target: 'book' },
    ],
    b: [
      { kind: 'show', actor: 'adult', target: 'newcomer', prop: 'phone' },
      { kind: 'show', actor: 'newcomer', target: 'elder', prop: 'phone' },
    ],
  },
  'connection-control-2': {
    a: [
      { kind: 'show', actor: 'robot', target: 'member', prop: 'calendar' },
      { kind: 'review', actor: 'member', target: 'calendar' },
      { kind: 'review', actor: 'organizer', target: 'poster' },
    ],
    b: [
      { kind: 'show', actor: 'robot', target: 'member', prop: 'phone' },
      { kind: 'review', actor: 'member', target: 'calendar' },
      { kind: 'review', actor: 'organizer', target: 'phone' },
    ],
  },
  'connection-control-3': {
    a: [
      { kind: 'show', actor: 'robot', target: 'member', prop: 'document' },
      { kind: 'review', actor: 'member', target: 'document' },
    ],
    b: [
      { kind: 'handoff', actor: 'member', target: 'robot', prop: 'document' },
      { kind: 'operate', actor: 'robot', target: 'cart' },
    ],
  },
  'human-skill-1': {
    a: [{ kind: 'operate', actor: 'researcher', target: 'user', prop: 'microphone' }],
    b: [{ kind: 'review', actor: 'researcher', target: 'document' }],
  },
  'human-skill-2': {
    a: [
      { kind: 'show', actor: 'researcher', target: 'consumer', prop: 'poster' },
      { kind: 'review', actor: 'consumer', target: 'poster' },
    ],
    b: [
      { kind: 'review', actor: 'researcher', target: 'chart' },
      { kind: 'review', actor: 'manager', target: 'chart' },
    ],
  },
  'human-skill-3': {
    a: [
      { kind: 'show', actor: 'designer', target: 'manager', prop: 'document' },
      { kind: 'show', actor: 'client', target: 'manager', prop: 'document' },
      { kind: 'review', actor: 'manager', target: 'document' },
    ],
    b: [
      { kind: 'handoff', actor: 'designer', target: 'manager', prop: 'document' },
      { kind: 'handoff', actor: 'client', target: 'manager', prop: 'document' },
    ],
  },
  'reliable-delivery-1': {
    a: [
      { kind: 'operate', actor: 'marketer', target: 'document' },
      { kind: 'review', actor: 'manager', target: 'document' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'screen' },
      { kind: 'review', actor: 'manager', target: 'screen' },
    ],
  },
  'reliable-delivery-2': {
    a: [{ kind: 'review', actor: 'creator', target: 'book' }],
    b: [
      { kind: 'operate', actor: 'owner', target: 'document' },
      { kind: 'review', actor: 'creator', target: 'document' },
    ],
  },
  'reliable-delivery-3': {
    a: [
      { kind: 'operate', actor: 'editor', target: 'document' },
      { kind: 'review', actor: 'creative', target: 'screen' },
    ],
    b: [
      { kind: 'handoff', actor: 'editor', target: 'creative', prop: 'document' },
      { kind: 'operate', actor: 'creative', target: 'screen', prop: 'poster' },
    ],
  },
  'daily-attention-1': {
    a: [{ kind: 'handoff', actor: 'commuter', target: 'phone', prop: 'poster' }],
    b: [{ kind: 'operate', actor: 'commuter', target: 'poster', prop: 'phone' }],
  },
  'daily-attention-2': {
    a: [
      { kind: 'operate', actor: 'commuter', target: 'screen', prop: 'playlist' },
      { kind: 'review', actor: 'friend', target: 'screen' },
    ],
    b: [
      { kind: 'show', actor: 'commuter', target: 'friend', prop: 'playlist' },
      { kind: 'show', actor: 'friend', target: 'commuter', prop: 'phone' },
    ],
  },
  'daily-attention-3': {
    a: [{ kind: 'review', actor: 'commuter', target: 'phone' }],
    b: [{ kind: 'review', actor: 'commuter', target: 'poster' }],
  },
  'shopping-help-1': {
    a: [
      { kind: 'show', actor: 'robot', target: 'adult', prop: 'document' },
      { kind: 'review', actor: 'adult', target: 'document' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'cart', prop: 'mug' },
      { kind: 'review', actor: 'adult', target: 'cart' },
    ],
  },
  'shopping-help-2': {
    a: [
      { kind: 'show', actor: 'robot', target: 'adult', prop: 'document' },
      { kind: 'review', actor: 'adult', target: 'document' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'cart' },
      { kind: 'pause', actor: 'adult', target: 'robot', prop: 'stop-control' },
    ],
  },
  'shopping-help-3': {
    a: [{ kind: 'review', actor: 'adult', target: 'phone' }],
    b: [
      { kind: 'show', actor: 'child', target: 'adult', prop: 'mug' },
      { kind: 'review', actor: 'adult', target: 'phone' },
    ],
  },
  'seen-remembered-1': {
    a: [{ kind: 'operate', actor: 'analyst', target: 'document' }],
    b: [
      { kind: 'operate', actor: 'analyst', target: 'chart', prop: 'mug' },
    ],
  },
  'seen-remembered-2': {
    a: [
      { kind: 'show', actor: 'analyst', target: 'user', prop: 'document' },
      { kind: 'review', actor: 'user', target: 'screen' },
    ],
    b: [
      { kind: 'operate', actor: 'user', target: 'microphone' },
      { kind: 'review', actor: 'analyst', target: 'document' },
    ],
  },
  'seen-remembered-3': {
    a: [
      { kind: 'operate', actor: 'analyst', target: 'screen', prop: 'document' },
      { kind: 'review', actor: 'manager', target: 'screen' },
    ],
    b: [
      { kind: 'show', actor: 'manager', target: 'analyst', prop: 'poster' },
      { kind: 'review', actor: 'analyst', target: 'poster' },
    ],
  },
  'scale-distinctiveness-1': {
    a: [
      { kind: 'handoff', actor: 'marketer', target: 'robot', prop: 'document' },
      { kind: 'review', actor: 'robot', target: 'screen' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'screen', prop: 'poster' },
      { kind: 'review', actor: 'marketer', target: 'document' },
    ],
  },
  'scale-distinctiveness-2': {
    a: [
      { kind: 'operate', actor: 'editor', target: 'document' },
      { kind: 'review', actor: 'creative', target: 'screen' },
    ],
    b: [
      { kind: 'handoff', actor: 'editor', target: 'creative', prop: 'document' },
      { kind: 'operate', actor: 'creative', target: 'screen', prop: 'poster' },
    ],
  },
  'scale-distinctiveness-3': {
    a: [
      { kind: 'pause', actor: 'contributor', target: 'camera' },
      { kind: 'review', actor: 'director', target: 'camera' },
    ],
    b: [
      { kind: 'operate', actor: 'contributor', target: 'mug' },
      { kind: 'review', actor: 'director', target: 'camera' },
    ],
  },
  'research-decision-1': {
    a: [
      { kind: 'show', actor: 'robot', target: 'lead', prop: 'chart' },
      { kind: 'review', actor: 'lead', target: 'chart' },
    ],
    b: [{ kind: 'operate', actor: 'lead', target: 'user', prop: 'microphone' }],
  },
  'research-decision-2': {
    a: [
      { kind: 'operate', actor: 'lead', target: 'document' },
      { kind: 'review', actor: 'peer', target: 'screen' },
    ],
    b: [
      { kind: 'show', actor: 'peer', target: 'lead', prop: 'chart' },
      { kind: 'review', actor: 'lead', target: 'chart' },
    ],
  },
  'research-decision-3': {
    a: [
      { kind: 'operate', actor: 'robot', target: 'case-a' },
      { kind: 'review', actor: 'lead', target: 'chart' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'case-b' },
      { kind: 'review', actor: 'lead', target: 'shield' },
    ],
  },
  'agent-investment-1': {
    a: [
      { kind: 'handoff', actor: 'robot', target: 'staff', prop: 'document' },
      { kind: 'operate', actor: 'staff', target: 'phone' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'phone', prop: 'document' },
      { kind: 'review', actor: 'staff', target: 'document' },
    ],
  },
  'agent-investment-2': {
    a: [
      { kind: 'operate', actor: 'staff', target: 'document' },
      { kind: 'review', actor: 'lead', target: 'document' },
    ],
    b: [
      { kind: 'handoff', actor: 'staff', target: 'robot', prop: 'document' },
      { kind: 'review', actor: 'lead', target: 'document' },
    ],
  },
  'agent-investment-3': {
    a: [
      { kind: 'handoff', actor: 'robot', target: 'staff', prop: 'document' },
      { kind: 'operate', actor: 'staff', target: 'phone' },
    ],
    b: [
      { kind: 'operate', actor: 'robot', target: 'phone' },
      { kind: 'review', actor: 'staff', target: 'document' },
    ],
  },
  'creative-value-1': {
    a: [{ kind: 'operate', actor: 'creative', target: 'user', prop: 'microphone' }],
    b: [
      { kind: 'handoff', actor: 'creative', target: 'user', prop: 'document' },
      { kind: 'review', actor: 'user', target: 'document' },
    ],
  },
  'creative-value-2': {
    a: [
      { kind: 'operate', actor: 'editor', target: 'document' },
      { kind: 'review', actor: 'creative', target: 'document' },
    ],
    b: [
      { kind: 'handoff', actor: 'creative', target: 'editor', prop: 'document' },
      { kind: 'operate', actor: 'editor', target: 'screen', prop: 'document' },
    ],
  },
  'creative-value-3': {
    a: [
      { kind: 'operate', actor: 'creative', target: 'document' },
      { kind: 'review', actor: 'editor', target: 'document' },
    ],
    b: [
      { kind: 'review', actor: 'creative', target: 'screen' },
      { kind: 'review', actor: 'editor', target: 'screen' },
    ],
  },
  'content-resonance-1': {
    a: [
      { kind: 'operate', actor: 'editor', target: 'document' },
      { kind: 'review', actor: 'user', target: 'screen' },
    ],
    b: [
      { kind: 'operate', actor: 'user', target: 'microphone' },
      { kind: 'review', actor: 'editor', target: 'document' },
    ],
  },
  'content-resonance-2': {
    a: [
      { kind: 'show', actor: 'editor', target: 'robot', prop: 'document' },
      { kind: 'review', actor: 'robot', target: 'screen' },
    ],
    b: [
      { kind: 'show', actor: 'editor', target: 'robot', prop: 'mug' },
      { kind: 'operate', actor: 'robot', target: 'screen', prop: 'document' },
    ],
  },
  'content-resonance-3': {
    a: [{ kind: 'operate', actor: 'creator', target: 'user', prop: 'microphone' }],
    b: [{ kind: 'operate', actor: 'creator', target: 'document' }],
  },
  'media-measurement-1': {
    a: [{ kind: 'operate', actor: 'analyst', target: 'chart' }],
    b: [{ kind: 'operate', actor: 'analyst', target: 'chart', prop: 'phone' }],
  },
  'media-measurement-2': {
    a: [
      { kind: 'operate', actor: 'analyst', target: 'screen', prop: 'chart' },
      { kind: 'review', actor: 'manager', target: 'screen' },
    ],
    b: [
      { kind: 'operate', actor: 'analyst', target: 'screen', prop: 'phone' },
      { kind: 'review', actor: 'manager', target: 'heart' },
    ],
  },
  'media-measurement-3': {
    a: [
      { kind: 'review', actor: 'analyst', target: 'document' },
      { kind: 'review', actor: 'participant', target: 'chart' },
    ],
    b: [{ kind: 'operate', actor: 'analyst', target: 'participant', prop: 'microphone' }],
  },
  'insight-evidence-1': {
    a: [
      { kind: 'show', actor: 'robot', target: 'analyst', prop: 'document' },
      { kind: 'review', actor: 'analyst', target: 'document' },
    ],
    b: [{ kind: 'review', actor: 'analyst', target: 'book' }],
  },
  'insight-evidence-2': {
    a: [{ kind: 'review', actor: 'analyst', target: 'phone' }],
    b: [{ kind: 'operate', actor: 'analyst', target: 'document' }],
  },
  'insight-evidence-3': {
    a: [{ kind: 'operate', actor: 'analyst', target: 'staff', prop: 'microphone' }],
    b: [{ kind: 'operate', actor: 'analyst', target: 'screen', prop: 'document' }],
  },
};
