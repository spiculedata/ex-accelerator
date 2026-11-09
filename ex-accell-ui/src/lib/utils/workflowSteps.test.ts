import { describe, it, expect } from 'vitest';
import { missingConfig, stepStatus, nextStepPosition, nextFreePosition, setupProblems, REQUIRED_CONFIG } from './workflowSteps';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const step = (type: string, name: string, config: Record<string, unknown>) => ({ id: name, type, name, config });

describe('missingConfig', () => {
  it('lists the required settings that are empty', () => {
    expect(missingConfig('sentiment_analysis', { text_column: '' })).toEqual(['text_column']);
    expect(missingConfig('dataset_input', { dataset_id: '', columns: [] })).toEqual(['dataset_id']);
  });

  it('treats blank text and missing keys as empty, and real values as filled', () => {
    expect(missingConfig('sentiment_analysis', { text_column: '   ' })).toEqual(['text_column']);
    expect(missingConfig('sentiment_analysis', {})).toEqual(['text_column']);
    expect(missingConfig('sentiment_analysis', { text_column: 'content' })).toEqual([]);
  });

  it('needs nothing from steps with no required settings, or unknown steps', () => {
    expect(missingConfig('remove_duplicates', { columns: [], keep: 'first' })).toEqual([]);
    expect(missingConfig('something_new', {})).toEqual([]);
  });
});

describe('stepStatus', () => {
  it('is needs-setup until the required settings are filled, then configured', () => {
    expect(stepStatus(step('sentiment_analysis', 'Sentiment', { text_column: '' }))).toBe('needs-setup');
    expect(stepStatus(step('sentiment_analysis', 'Sentiment', { text_column: 'content' }))).toBe('configured');
  });
});

describe('setupProblems', () => {
  it('names each step that still needs setup and what it needs', () => {
    const problems = setupProblems([
      step('dataset_input', 'Dataset Input', { dataset_id: '' }),
      step('sentiment_analysis', 'Sentiment Analysis', { text_column: 'content' })
    ]);

    expect(problems).toEqual(['Dataset Input: choose a dataset']);
  });

  it('is empty when everything is set up', () => {
    expect(setupProblems([step('dataset_input', 'Dataset Input', { dataset_id: 'd1' })])).toEqual([]);
  });
});

describe('nextStepPosition', () => {
  it('places steps in a grid so added steps do not stack on each other', () => {
    const positions = [0, 1, 2, 3, 4, 5].map(nextStepPosition);

    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBe(6);
    expect(positions[0]).toEqual({ x: 160, y: 120 });
    expect(positions[1].x).toBeGreaterThan(positions[0].x);
    expect(positions[4].y).toBeGreaterThan(positions[0].y);
  });
});

describe('required settings can be edited', () => {
  // A step is only blocked on a setting the config panel can fill in; otherwise it could never become ready
  it('only requires settings for step types that the config panel has an editor for', () => {
    const panel = readFileSync(join(__dirname, '../components/workflow-builder/StepConfigPanel.svelte'), 'utf8');

    for (const type of Object.keys(REQUIRED_CONFIG)) {
      expect(panel, `the config panel has no editor for ${type}, so requiring its settings would block the workflow`).toContain(`'${type}'`);
    }
  });
});

describe('nextFreePosition', () => {
  it('uses the first grid slot, then the next one that is not occupied', () => {
    expect(nextFreePosition([])).toEqual({ x: 160, y: 120 });
    expect(nextFreePosition([{ x: 160, y: 120 }])).toEqual({ x: 420, y: 120 });
  });

  it('reuses a slot freed by deleting a middle step instead of stacking on a later one', () => {
    const slots = [nextStepPosition(0), nextStepPosition(2)];

    expect(nextFreePosition(slots)).toEqual(nextStepPosition(1));
  });

  it('treats a step dragged close to a slot as occupying it', () => {
    expect(nextFreePosition([{ x: 170, y: 130 }])).toEqual({ x: 420, y: 120 });
  });
});
