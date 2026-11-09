import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { workflowBuilder, workflow } from './workflowBuilderStore';

const template = { id: 'sentiment_analysis', name: 'Sentiment Analysis', description: '', icon: '', color: 'green', inputs: ['dataset'], outputs: ['dataset'], config: { text_column: '' } };

beforeEach(() => {
  workflowBuilder.resetWorkflow();
});

describe('step status', () => {
  it('a new step needs setup while a required setting is empty', () => {
    workflowBuilder.addStep(template, 300, 200);

    expect(get(workflow).steps[0].status).toBe('needs-setup');
  });

  it('becomes configured when the setting is filled in, and needs setup again if it is cleared', () => {
    const id = workflowBuilder.addStep(template, 300, 200);

    workflowBuilder.updateStepConfig(id, { text_column: 'content' });
    expect(get(workflow).steps[0].status).toBe('configured');

    workflowBuilder.updateStepConfig(id, { text_column: '' });
    expect(get(workflow).steps[0].status).toBe('needs-setup');
  });

  it('recomputes status for a workflow that is opened, whatever status it was saved with', () => {
    workflowBuilder.loadWorkflow({
      id: 'w', name: 'Saved', description: '', connections: [],
      steps: [{ id: 's1', type: 'sentiment_analysis', name: 'Sentiment', description: '', icon: '', color: '', inputs: [], outputs: [], config: { text_column: '' }, position: { x: 0, y: 0 }, status: 'configured' }]
    } as any);

    expect(get(workflow).steps[0].status).toBe('needs-setup');
  });
});
