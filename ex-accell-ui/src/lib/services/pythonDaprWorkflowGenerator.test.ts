import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  const writeFile = vi.fn();
  const mkdir = vi.fn();
  return { ...actual, default: { ...actual, writeFile, mkdir }, writeFile, mkdir };
});

import { writeFile, mkdir } from 'fs/promises';
import { pythonDaprWorkflowGenerator } from './pythonDaprWorkflowGenerator';
import type { PythonDaprWorkflow } from './pythonDaprWorkflowGenerator';

const workflow = {
  pythonScript: 'print(1)',
  requirements: '',
  virtualEnvPath: '/tmp/venv'
} as unknown as PythonDaprWorkflow;

describe('pythonDaprWorkflowGenerator.deployPythonDaprWorkflow', () => {
  it.each(['../../etc', 'a/b', 'x;id', '$(whoami)', ''])(
    'rejects unsafe workflowId %j before touching the filesystem',
    async (workflowId) => {
      await expect(
        pythonDaprWorkflowGenerator.deployPythonDaprWorkflow(workflowId, workflow)
      ).rejects.toThrow(/Invalid workflowId/);

      expect(mkdir).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    }
  );
});

type Step = { id: string; type: string; name: string; description: string; config: Record<string, unknown>; position: { x: number; y: number } };

const makeStep = (id: string, type: string, name: string, config: Record<string, unknown> = {}, description = ''): Step => ({
  id,
  type,
  name,
  description,
  config,
  position: { x: 0, y: 0 }
});

const ALL_STEP_TYPES = [
  'text_preprocessing',
  'sentiment_analysis',
  'topic_modeling',
  'clustering',
  'remove_duplicates',
  'custom_unknown'
];

const makeWorkflow = (name: string, steps: Step[]) => ({
  name,
  description: 'A test workflow',
  steps,
  connections: []
});

describe('pythonDaprWorkflowGenerator.generatePythonDaprWorkflow (generated output)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(ALL_STEP_TYPES)('pins the generated script for a single %s step', async (type) => {
    const wf = makeWorkflow('Step Under Test', [
      makeStep('s1', type, 'My Step 1', { columns: ['a', 'b'], keep: 'last' }, 'does a thing')
    ]);

    const result = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(wf);

    expect(result.pythonScript).toMatchSnapshot();
  });

  it('pins the full script, requirements and metadata for a mixed workflow', async () => {
    const wf = makeWorkflow('Full Pipeline!', [
      makeStep('in', 'dataset_input', 'Input'),
      makeStep('a', 'text_preprocessing', 'Clean Text'),
      makeStep('b', 'sentiment_analysis', '2nd Sentiment'),
      makeStep('c', 'topic_modeling', 'Topics'),
      makeStep('d', 'clustering', 'Cluster'),
      makeStep('e', 'remove_duplicates', 'Dedupe', { columns: ['text'], keep: 'first' }),
      makeStep('f', 'weird', 'Weird step'),
      makeStep('out', 'dataset_output', 'Output')
    ]);

    const result = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(wf);

    expect(result.pythonScript).toMatchSnapshot();
    expect(result.requirements).toBe(
      [
        'dapr>=1.15.0',
        'dapr-ext-workflow>=1.15.0',
        'pandas>=2.0.0',
        'numpy>=1.24.0',
        'polars>=0.20.0',
        'scikit-learn>=1.3.0',
        'textblob>=0.17.1',
        'nltk>=3.8.1',
        'vaderSentiment>=3.3.2',
        'gensim>=4.3.0'
      ].join('\n')
    );
    expect(result.workflowName).toBe('fullPipeline');
    expect(result.workflowPattern).toBe('pure-python-dapr-sdk');
    expect(result.executionOrder).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(result.workflowCode).toBe('');
    expect(result.activityCode).toBe('');
    expect(result.appCode).toBe('');
    expect(result.virtualEnvPath).toMatch(/workflow-venvs\/fullPipeline_\d+$/);
    expect(result.activationScript).toBe(
      `#!/bin/bash\n# Virtual environment activation script\nsource "${result.virtualEnvPath}/bin/activate"\necho "Virtual environment activated: ${result.virtualEnvPath}"\n`
    );
  });

  it('emits step calls and decorated activities named from the step name', async () => {
    const wf = makeWorkflow('Names', [makeStep('x1', 'clustering', '9 weird-name!!', {}, 'desc')]);

    const { pythonScript } = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(wf);

    expect(pythonScript).toContain("@wfr.activity(name='9_weird_name_activity')");
    expect(pythonScript).toContain("yield ctx.call_activity('9_weird_name_activity', input=input_data)");
    expect(pythonScript).toContain("results['x1'] = step_result");
    expect(pythonScript).toContain('"""desc activity"""');
  });

  it('falls back to defaultWorkflow and UntitledWorkflow naming', async () => {
    const empty = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(makeWorkflow('!!!', []));
    expect(empty.workflowName).toBe('defaultWorkflow');
    const blank = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(makeWorkflow('', []));
    expect(blank.workflowName).toBe('untitledworkflow');
  });

  it('omits optional requirements when those step types are absent', async () => {
    const result = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(
      makeWorkflow('Plain', [makeStep('c', 'clustering', 'C')])
    );
    expect(result.requirements).not.toContain('vaderSentiment');
    expect(result.requirements).not.toContain('gensim');
  });
});
