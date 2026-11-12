import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  workflowBuilder,
  workflow,
  workflowSteps,
  workflowConnections,
  selectedStep,
  isConnecting,
  hasSteps
} from './workflowBuilderStore';

const template = {
  id: 'sentiment_analysis',
  name: 'Sentiment Analysis',
  description: 'd',
  icon: 'i',
  color: 'green',
  inputs: ['dataset'],
  outputs: ['dataset'],
  config: { text_column: '' }
};

let clock = 1_000;

/** Adds a step with a distinct timestamp-derived id (ids are built from Date.now()). */
function addStep(x = 300, y = 200): string {
  clock += 10;
  vi.setSystemTime(clock);
  return workflowBuilder.addStep(template, x, y);
}

beforeEach(() => {
  vi.useFakeTimers();
  workflowBuilder.resetWorkflow();
  workflowBuilder.cancelConnection();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('workflow info and steps', () => {
  it('sets name and description and resets to the defaults', () => {
    workflowBuilder.setWorkflowInfo('Mine', 'desc');
    expect(get(workflow)).toMatchObject({ name: 'Mine', description: 'desc' });
    addStep();
    workflowBuilder.resetWorkflow();
    expect(get(workflow)).toEqual({ name: 'New Workflow', description: '', steps: [], connections: [] });
    expect(get(hasSteps)).toBe(false);
  });

  it('centres a new step on the drop point and never places it at a negative position', () => {
    const id = addStep(300, 200);
    addStep(10, 10);
    const [first, second] = get(workflowSteps);
    expect(first.id).toBe(id);
    expect(first.position).toEqual({ x: 225, y: 160 });
    expect(second.position).toEqual({ x: 0, y: 0 });
    expect(get(hasSteps)).toBe(true);
  });

  it('copies the template config so editing a step does not change the template', () => {
    const id = addStep();
    workflowBuilder.updateStepConfig(id, { text_column: 'body' });
    expect(template.config.text_column).toBe('');
  });

  it('selects and deselects a step, opening and closing the config panel', () => {
    const id = addStep();
    workflowBuilder.selectStep(id);
    expect(get(selectedStep)?.id).toBe(id);
    expect(get(workflowBuilder).showStepConfig).toBe(true);
    workflowBuilder.deselectStep();
    expect(get(selectedStep)).toBeNull();
    expect(get(workflowBuilder).showStepConfig).toBe(false);
  });

  it('keeps the selected step in sync when its config changes', () => {
    const id = addStep();
    workflowBuilder.selectStep(id);
    workflowBuilder.updateStepConfig(id, { text_column: 'body' });
    expect(get(selectedStep)?.config.text_column).toBe('body');
    expect(get(selectedStep)?.status).toBe('configured');
  });

  it('moves only the targeted step', () => {
    const a = addStep();
    const b = addStep();
    workflowBuilder.updateStepPosition(a, 5, 6);
    const steps = get(workflowSteps);
    expect(steps.find(s => s.id === a)?.position).toEqual({ x: 5, y: 6 });
    expect(steps.find(s => s.id === b)?.position).toEqual({ x: 225, y: 160 });
  });

  it('deletes a step with its connections and clears the selection only when it was selected', () => {
    const a = addStep();
    const b = addStep();
    const c = addStep();
    workflowBuilder.startConnection(a);
    workflowBuilder.completeConnection(b);
    workflowBuilder.startConnection(b);
    workflowBuilder.completeConnection(c);

    workflowBuilder.selectStep(c);
    workflowBuilder.deleteStep(a);
    expect(get(workflowSteps).map(s => s.id)).toEqual([b, c]);
    expect(get(workflowConnections)).toHaveLength(1);
    expect(get(workflowConnections)[0]).toMatchObject({ from: b, to: c });
    expect(get(selectedStep)?.id).toBe(c);

    workflowBuilder.deleteStep(c);
    expect(get(workflowConnections)).toEqual([]);
    expect(get(selectedStep)).toBeNull();
    expect(get(workflowBuilder).showStepConfig).toBe(false);
  });
});

describe('connections', () => {
  it('only tracks a temp connection while connecting', () => {
    const a = addStep();
    workflowBuilder.updateTempConnection(1, 2);
    expect(get(workflowBuilder).tempConnection).toBeNull();

    workflowBuilder.startConnection(a);
    expect(get(isConnecting)).toBe(true);
    workflowBuilder.updateTempConnection(10, 20);
    expect(get(workflowBuilder).tempConnection).toEqual({ from: a, toX: 10, toY: 20 });

    workflowBuilder.cancelConnection();
    expect(get(isConnecting)).toBe(false);
    expect(get(workflowBuilder).tempConnection).toBeNull();
  });

  it('creates a connection between two steps and ends connecting mode', () => {
    const a = addStep();
    const b = addStep();
    workflowBuilder.startConnection(a);
    workflowBuilder.completeConnection(b);
    expect(get(workflowConnections)).toHaveLength(1);
    expect(get(workflowConnections)[0]).toMatchObject({ from: a, to: b });
    expect(get(isConnecting)).toBe(false);
  });

  it('rejects self-connections and duplicates', () => {
    const a = addStep();
    const b = addStep();
    workflowBuilder.startConnection(a);
    workflowBuilder.completeConnection(a);
    expect(get(workflowConnections)).toEqual([]);
    expect(get(isConnecting)).toBe(false);

    workflowBuilder.startConnection(a);
    workflowBuilder.completeConnection(b);
    clock += 10;
    vi.setSystemTime(clock);
    workflowBuilder.startConnection(a);
    workflowBuilder.completeConnection(b);
    expect(get(workflowConnections)).toHaveLength(1);
  });

  it('ignores completeConnection when no connection was started', () => {
    const a = addStep();
    workflowBuilder.completeConnection(a);
    expect(get(workflowConnections)).toEqual([]);
  });

  it('deletes a connection by id', () => {
    const a = addStep();
    const b = addStep();
    workflowBuilder.startConnection(a);
    workflowBuilder.completeConnection(b);
    const [conn] = get(workflowConnections);
    workflowBuilder.deleteConnection('other');
    expect(get(workflowConnections)).toHaveLength(1);
    workflowBuilder.deleteConnection(conn.id);
    expect(get(workflowConnections)).toEqual([]);
  });
});

describe('drag state and dialogs', () => {
  it('tracks canvas dragging and clears the offset when it stops', () => {
    workflowBuilder.startDraggingCanvasStep('s', 4, 5);
    expect(get(workflowBuilder)).toMatchObject({ isDraggingStep: true, draggedStepId: 's', dragOffset: { x: 4, y: 5 } });
    workflowBuilder.stopDraggingCanvasStep();
    expect(get(workflowBuilder)).toMatchObject({ isDraggingStep: false, draggedStepId: null, dragOffset: { x: 0, y: 0 } });
  });

  it('tracks the library step being dragged and the mouse position', () => {
    workflowBuilder.startDraggingLibraryStep(template);
    expect(get(workflowBuilder).draggedStep).toBe(template);
    workflowBuilder.clearDraggedLibraryStep();
    expect(get(workflowBuilder).draggedStep).toBeNull();
    workflowBuilder.updateMousePosition(7, 8);
    expect(get(workflowBuilder).mousePosition).toEqual({ x: 7, y: 8 });
  });

  it('toggles each dialog flag, honouring an explicit value', () => {
    const cases = [
      ['toggleStepConfig', 'showStepConfig'],
      ['toggleCodeExport', 'showCodeExport'],
      ['togglePublishDialog', 'showPublishDialog'],
      ['toggleExecuteDialog', 'showExecuteDialog'],
      ['toggleExecutionMonitor', 'showExecutionMonitor']
    ] as const;
    for (const [method, flag] of cases) {
      workflowBuilder[method](true);
      expect(get(workflowBuilder)[flag]).toBe(true);
      workflowBuilder[method](true);
      expect(get(workflowBuilder)[flag]).toBe(true);
      workflowBuilder[method]();
      expect(get(workflowBuilder)[flag]).toBe(false);
      workflowBuilder[method]();
      expect(get(workflowBuilder)[flag]).toBe(true);
      workflowBuilder[method](false);
      expect(get(workflowBuilder)[flag]).toBe(false);
    }
  });
});
