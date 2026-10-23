import type { I18nText } from './explorer-types';

export type { I18nText } from './explorer-types';
export type JourneyConnectionKind = 'complement' | 'tradeoff' | 'context';
export interface JourneyConnection { kind: JourneyConnectionKind; explanation: I18nText }
export interface JourneyStep {
  articleId: string;
  prompt: I18nText;
  reason: I18nText;
  connection?: JourneyConnection;
}
export interface JourneyQuestion {
  id: string;
  title: I18nText;
  why: I18nText;
  steps: readonly JourneyStep[];
}
export interface JourneyPersona {
  id: string;
  title: I18nText;
  description: I18nText;
  icon: string;
  questions: readonly JourneyQuestion[];
}
export interface ReadingJourneys {
  bookId: string;
  year: number;
  personas: readonly JourneyPersona[];
  notice: I18nText;
}
export type JourneyStepDefinition = Omit<JourneyStep, 'articleId'> & (
  { articleId: string; articleOrder?: never } | { articleOrder: number; articleId?: never }
);
export interface JourneyQuestionDefinition extends Omit<JourneyQuestion, 'steps'> {
  steps: readonly JourneyStepDefinition[];
}
export interface JourneyPersonaDefinition extends Omit<JourneyPersona, 'questions'> {
  questions: readonly JourneyQuestionDefinition[];
}
export interface JourneyDefinition {
  bookId: string;
  year: number;
  personas: readonly JourneyPersonaDefinition[];
  notice: I18nText;
}
