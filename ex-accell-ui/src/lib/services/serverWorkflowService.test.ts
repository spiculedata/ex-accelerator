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

  /** Columns named in INSERT column lists, UPDATE ... SET assignments and `row.` reads for a table. */
  function usedColumns(table: string): string[] {
    const inserts = [...source.matchAll(new RegExp(`INSERT INTO ${table}\\s*\\(([^)]*)\\)`, 'g'))].flatMap((m) => m[1].split(',').map((c) => c.trim()));
    const updateBlocks = [...source.matchAll(new RegExp(`UPDATE ${table}\\s+SET\\s+([\\s\\S]*?)\\s+WHERE`, 'g'))].map((m) => m[1]);
    const sets = updateBlocks.flatMap((block) => [...block.matchAll(/([a-z_]+)\s*=\s*\$/g)].map((m) => m[1]));
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
});
