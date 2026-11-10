// What the Home page says about each project, and when it should explain itself to a first-time visitor.

export interface HomeProject {
  anomaly: { type: string } | null;
  sentiment_trend: string;
  sparkline: number[];
  event_count: number;
  workspace_count: number;
  sources: { gdelt: boolean; radio: boolean; social: boolean };
}

export function insightText(project: HomeProject): string {
  if (project.anomaly?.type === 'volume_spike') return 'Volume spike detected';
  if (project.anomaly?.type === 'sentiment_shift') return 'Sentiment shift detected';
  if (project.sentiment_trend === 'positive') return 'Sentiment trending positive';
  if (project.sentiment_trend === 'negative') return 'Sentiment trending negative';
  // "Steady" is a claim about data; with none there is nothing to call steady
  if (project.sparkline.length === 0 && project.event_count === 0) return 'No data yet, so no trend to show';
  return 'Steady, no significant changes';
}

export function sourceNames(sources: HomeProject['sources']): string[] {
  return [sources.gdelt && 'GDELT', sources.radio && 'Radio', sources.social && 'Social'].filter((name): name is string => Boolean(name));
}

/** True until some project has a workspace to analyse, which is the point where the three steps stop being news. */
export function needsFirstRun(projects: readonly HomeProject[]): boolean {
  return projects.every((project) => project.workspace_count === 0);
}
