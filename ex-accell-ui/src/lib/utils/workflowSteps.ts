// What a workflow step needs before it can run, and where to put a step added from the library.

/** Settings each step type cannot run without. Anything not listed has working defaults. */
const REQUIRED_CONFIG: Record<string, readonly string[]> = {
  dataset_input: ['dataset_id'],
  filter_rows: ['conditions'],
  sentiment_analysis: ['text_column'],
  topic_modeling: ['text_column'],
  dataset_output: ['name']
};

const LABELS: Record<string, string> = {
  dataset_id: 'choose a dataset',
  conditions: 'add at least one condition',
  text_column: 'choose the text column',
  name: 'name the output'
};

interface StepLike {
  type: string;
  name?: string;
  config: Record<string, unknown>;
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** The required settings of a step type that are still empty. */
export function missingConfig(type: string, config: Record<string, unknown>): string[] {
  return (REQUIRED_CONFIG[type] ?? []).filter((key) => isEmpty(config?.[key]));
}

export function stepStatus(step: StepLike): 'configured' | 'needs-setup' {
  return missingConfig(step.type, step.config).length === 0 ? 'configured' : 'needs-setup';
}

/** One line per step that is not ready, for telling the user what to finish. */
export function setupProblems(steps: readonly StepLike[]): string[] {
  return steps.flatMap((step) => {
    const missing = missingConfig(step.type, step.config);
    return missing.length === 0 ? [] : [`${step.name ?? step.type}: ${missing.map((key) => LABELS[key] ?? key).join(', ')}`];
  });
}

const GRID_COLUMNS = 4;
const GRID_X = 260;
const GRID_Y = 160;

/** Where the nth added step goes: a grid that wraps, so steps added without dragging never stack. */
export function nextStepPosition(count: number): { x: number; y: number } {
  return { x: 160 + (count % GRID_COLUMNS) * GRID_X, y: 120 + Math.floor(count / GRID_COLUMNS) * GRID_Y };
}
