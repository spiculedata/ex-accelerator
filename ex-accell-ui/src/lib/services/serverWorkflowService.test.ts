import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrationColumns } from '../../test/migrationSchema';

const query = vi.hoisted(() => vi.fn());

vi.mock('./postgres', () => ({ postgresPool: { query } }));
vi.mock('./hybridDaprWorkflowExecutor', () => ({ hybridDaprWorkflowExecutor: {} }));

import { serverWorkflowService } from './serverWorkflowService';

const definition = {
  name: 'Demo',
  description: 'demo workflow',
  steps: [
    { id: 's1', type: 'load-data', name: 'Load', description: '', icon: '', color: '', inputs: [], outputs: [], config: { datasetId: 'social_posts' }, position: { x: 0, y: 0 }, status: 'idle' },
    { id: 's2', type: 'sentiment-analysis', name: 'Sentiment', description: '', icon: '', color: '', inputs: [], outputs: [], config: {}, position: { x: 1, y: 0 }, status: 'idle' }
  ],
  connections: [{ id: 'c1', from: 's1', fromPort: 0, to: 's2', toPort: 0 }]
};

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue([]);
});

describe('publishWorkflow', () => {
  it('stores Python-generated metadata, not the retired JavaScript workflow code', async () => {
    const published = await serverWorkflowService.publishWorkflow(definition, { name: 'Demo', description: 'd', createdBy: 'a@example.com' });

    expect(published.pattern).toBe('pure-python-dapr-sdk');
    expect(published.generatedCode.executionOrder).toEqual(['s1', 's2']);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO published_workflows');
    const stored = JSON.parse(params[6]);
    expect(stored.workflowPattern).toBe('pure-python-dapr-sdk');
    expect(stored.pythonScript).toContain('dapr.ext.workflow');
  });

  it('does not store or return machine-specific paths from the generator', async () => {
    const published = await serverWorkflowService.publishWorkflow(definition, { name: 'Demo', description: 'd', createdBy: 'a@example.com' });

    const stored = String(query.mock.calls[0][1][6]);
    expect(stored).not.toContain('virtualEnvPath');
    expect(stored).not.toContain('activationScript');
    expect(stored).not.toContain(process.cwd());
    expect(JSON.stringify(published.generatedCode)).not.toContain('virtualEnvPath');
  });
});

describe('saveDraft', () => {
  const meta = { name: 'Transit sentiment', description: 'draft', createdBy: 'a@example.com' };

  it('inserts a new draft without generating Python, so incomplete workflows can be saved', async () => {
    const draft = await serverWorkflowService.saveDraft({ ...definition, steps: [definition.steps[0]], connections: [] }, meta);

    expect(draft.status).toBe('draft');
    expect(draft.id).toMatch(/^wf_/);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO published_workflows');
    expect(params).toContain('draft');
    expect(JSON.parse(params[6])).toEqual({});
  });

  it('updates the creator\'s own draft in place in one statement, keeping its id', async () => {
    query.mockResolvedValueOnce([{ id: 'wf_9' }]);

    const draft = await serverWorkflowService.saveDraft(definition, meta, 'wf_9');

    expect(draft.id).toBe('wf_9');
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('UPDATE published_workflows');
    expect(String(sql)).toContain("status = 'draft'");
    expect(String(sql)).toContain('created_by');
    expect(params).toContain('wf_9');
    expect(params).toContain('a@example.com');
  });

  it('saves a new draft instead when the id is not the caller\'s draft (someone else\'s, published, or gone)', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValue([]);

    const draft = await serverWorkflowService.saveDraft(definition, meta, 'wf_7');

    expect(draft.id).not.toBe('wf_7');
    expect(query.mock.calls[1][0]).toContain('INSERT INTO published_workflows');
  });

  it('records the real step count, duration and dataset requirements, and copes with steps that have no config', async () => {
    const half = { ...definition, steps: [{ id: 's1', type: 'dataset_input', name: 'Input' }] };

    await serverWorkflowService.saveDraft(half, meta);

    const stored = JSON.parse(query.mock.calls[0][1][7]);
    expect(stored.stepCount).toBe(1);
    expect(stored).toHaveProperty('estimatedDuration');
    expect(stored.datasetRequirements).toEqual([]);
  });
});

describe('executeWorkflow', () => {
  it('refuses to run a workflow that has not been published', async () => {
    query.mockResolvedValueOnce([{ id: 'wf_d', name: 'Draft', status: 'draft', workflow_definition: definition, generated_code: {}, metadata: {} }]);

    await expect(serverWorkflowService.executeWorkflow('wf_d', {})).rejects.toThrow(/published/i);
  });
});

describe('listing queries', () => {
  it('filters workflows by status on the workflows table', async () => {
    await serverWorkflowService.getPublishedWorkflows({ status: 'published' } as any);

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('FROM published_workflows');
    expect(sql).toMatch(/\bstatus = \$1/);
    expect(sql).not.toContain('e.status');
  });

  it('filters executions by workflow and status with qualified columns and a workflow name join', async () => {
    await serverWorkflowService.getWorkflowExecutions({ workflowId: 'wf_1', status: 'failed', limit: 5 });

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('LEFT JOIN published_workflows w ON w.id = e.workflow_id');
    expect(String(sql)).toContain('e.workflow_id = $1');
    expect(String(sql)).toContain('e.status = $2');
    expect(String(sql)).toContain('LIMIT $3');
    expect(params).toEqual(['wf_1', 'failed', 5]);
  });

  it('reads one execution with its workflow name', async () => {
    await serverWorkflowService.getWorkflowExecution('exec_1');

    expect(String(query.mock.calls[0][0])).toContain('w.name AS workflow_name');
  });
});

describe('workflow tables', () => {
  const source = readFileSync(join(__dirname, 'serverWorkflowService.ts'), 'utf8');
  const schema = migrationColumns();

  /**
   * Columns named in INSERT column lists and in UPDATE ... SET assignments for a table. Matches any
   * `column = ...` in the SET block, so literals and functions (`completed_at = NOW()`) count too.
   */
  function usedColumns(table: string): string[] {
    const inserts = [...source.matchAll(new RegExp(`INSERT INTO ${table}\\s*\\(([^)]*)\\)`, 'g'))].flatMap((m) => m[1].split(',').map((c) => c.trim()));
    const updateBlocks = [...source.matchAll(new RegExp(`UPDATE ${table}\\s+SET\\s+([\\s\\S]*?)\\s+WHERE`, 'g'))].map((m) => m[1]);
    const sets = updateBlocks.flatMap((block) => [...block.matchAll(/(?:^|,)\s*([a-z_]+)\s*=/g)].map((m) => m[1]));
    return [...new Set([...inserts, ...sets])].filter((c) => c.length > 0 && !c.startsWith('$'));
  }

  it.each(['published_workflows', 'workflow_executions'])('defines %s with every column the service writes', (table) => {
    const columns = schema.get(table);

    expect(columns, `${table} is not defined in db/migrations`).toBeDefined();
    for (const column of usedColumns(table)) expect(columns!.has(column), `${table}.${column}`).toBe(true);
  });

  it('defines every column the row mappers read', () => {
    const readFromWorkflow = [...source.matchAll(/row\.([a-z_]+)/g)].map((m) => m[1]);
    const known = new Set([...schema.get('published_workflows')!, ...schema.get('workflow_executions')!, 'workflow_name']);

    for (const column of new Set(readFromWorkflow)) expect(known.has(column), `row.${column}`).toBe(true);
  });

  it('turns a draft into the published workflow instead of leaving the draft behind', async () => {
    await serverWorkflowService.publishWorkflow(definition, { name: 'Demo', description: 'd', createdBy: 'a@example.com', draftId: 'wf_draft1' });

    const removal = query.mock.calls.find(([sql]) => String(sql).includes('DELETE FROM published_workflows'));
    expect(removal).toBeDefined();
    const [sql, params] = removal!;
    // Only the publisher's own draft, and only while it is still a draft
    expect(String(sql)).toContain("status = 'draft'");
    expect(String(sql)).toContain('created_by');
    expect(params).toEqual(['wf_draft1', 'a@example.com']);
  });

  it('removes nothing when there is no draft', async () => {
    await serverWorkflowService.publishWorkflow(definition, { name: 'Demo', description: 'd', createdBy: 'a@example.com' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM published_workflows'))).toBe(false);
  });

  it('still reports the publish when removing the draft fails, since the workflow is already stored', async () => {
    query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('DELETE FROM published_workflows')) throw new Error('db hiccup');
      return [];
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const published = await serverWorkflowService.publishWorkflow(definition, { name: 'Demo', description: 'd', createdBy: 'a@example.com', draftId: 'wf_draft1' });
    expect(published.status).toBe('published');
    log.mockRestore();
  });
});
