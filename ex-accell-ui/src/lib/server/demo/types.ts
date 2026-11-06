import type { DemoSource, DemoTopic, Sentiment } from './content';

export type Cell = string | number | boolean | Date | null;

export interface DemoTable {
  name: string;
  columns: string[];
  rows: Cell[][];
}

export interface PostDraft {
  id: number;
  source: DemoSource;
  topic: DemoTopic;
  sentiment: Sentiment;
  languageIndex: number;
  createdAt: Date;
  content: string;
  author: string;
}
