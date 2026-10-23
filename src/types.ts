export type Chapter = 'intro' | 'people' | 'model' | 'ai';
export interface Article {
  id: string; year: number; order: number; chapter: Chapter;
  title: string; authors: string; summary: string; highlights: string[];
  tags: string[]; minutes: number; printedStart: number; printedEnd: number;
  sourcePdf: string; sourcePages: number[]; paragraphs: string[]; htmlUrl: string;
  supplementaryParagraphs?: string[]; unpublishedDifferenceCount?: number;
}
export interface Edition { schemaVersion: 1; year: number; title: string; articles: Article[] }
export interface Catalog { schemaVersion: 1; years: {year: number; title: string; articleCount: number; dataUrl: string; coverUrl: string}[] }
export interface ReadingPath { id: string; title: string; question: string; description: string; orders: number[]; connections: string[] }
