import { describe, it, expect, vi } from 'vitest';

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
