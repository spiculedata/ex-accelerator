import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';

const session = vi.hoisted(() => ({ user: { id: '1', email: 'root@example.com', name: 'Root', role: 'admin' } }));
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ data: session }) };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import Page from './+page.svelte';

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const dataset = { id: 7, name: 'Telegram posts', table_name: 'posts', dataset_type: 'social_media', record_count: '2' };
const generated = { id: 'telegram-posts', name: 'telegram-posts', title: 'Telegram posts', totalRows: 2, previewRows: 2, created: '2026-01-01T00:00:00Z', publishable: true };
const imported = { ...generated, id: 'ipfs_abc', title: 'Someone else’s posts', publishable: false };

interface Server {
  enabled: boolean;
  packages?: unknown[];
  registry?: unknown[];
}

/** Answers the page's requests the way the API does, and records POSTs. */
function serve({ enabled, packages = [], registry = [] }: Server) {
  const posts: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const reply = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    if (init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)));
      return reply({ success: true, cid: CID, gateway_url: `https://ipfs.io/ipfs/${CID}`, package_id: 'telegram-posts' });
    }
    if (url.includes('action=status')) return reply({ success: true, data: { enabled } });
    if (url.includes('action=list')) return reply({ success: true, packages });
    if (url.includes('action=registry')) return reply({ success: true, enabled, packages: registry });
    if (url.startsWith('/api/datasets')) return reply({ success: true, datasets: [dataset] });
    return reply({ success: false, error: 'unexpected request' });
  });
  return posts;
}

beforeEach(() => {
  session.user = { id: '1', email: 'root@example.com', name: 'Root', role: 'admin' };
});

describe('/data-sharing when peer-to-peer sharing is off', () => {
  it('explains that sharing is off and how to turn it on, instead of showing an error', async () => {
    serve({ enabled: false, packages: [generated] });
    render(Page);

    const panel = await screen.findByTestId('ipfs-disabled');
    expect(panel).toHaveTextContent(/turned off/i);
    expect(panel).toHaveTextContent('IPFS_ENABLED=true');
    expect(panel).toHaveTextContent(/cannot be taken back/i);
    expect(within(panel).getByRole('link', { name: /data sharing guide/i })).toHaveAttribute('href', expect.stringContaining('/guide/data-sharing'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers neither publishing nor importing, but still lists and previews packages', async () => {
    serve({ enabled: false, packages: [generated] });
    render(Page);

    expect(await screen.findByRole('heading', { name: 'Telegram posts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish to IPFS/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Import from IPFS/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
  });
});

describe('/data-sharing when sharing is on', () => {
  it('asks an admin to confirm, saying the data becomes public and cannot be withdrawn, before publishing', async () => {
    const posts = serve({ enabled: true, packages: [generated] });
    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: 'Publish to IPFS' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/public IPFS network/i);
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(dialog).toHaveTextContent(/no sign-in/i);
    expect(posts).toHaveLength(0);

    await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posts).toHaveLength(0);

    await fireEvent.click(screen.getByRole('button', { name: 'Publish to IPFS' }));
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish publicly' }));

    expect(posts).toEqual([{ action: 'publish', package_id: 'telegram-posts' }]);
    expect(await screen.findByText(/Published to IPFS/)).toBeInTheDocument();
  });

  it('shows the import form and the CID of a published package', async () => {
    serve({ enabled: true, packages: [generated], registry: [{ package_id: 'telegram-posts', cid: CID, gateway_url: `https://gw.example/ipfs/${CID}` }] });
    render(Page);

    expect(await screen.findByRole('heading', { name: /Import from IPFS/ })).toBeInTheDocument();
    expect(screen.getByText(CID)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish to IPFS/ })).toBeNull();
  });

  it('does not offer to publish an imported package', async () => {
    serve({ enabled: true, packages: [imported] });
    render(Page);

    expect(await screen.findByText('Someone else’s posts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish to IPFS/ })).toBeNull();
  });

  it('hides generate, publish and import from a non-admin and says why', async () => {
    session.user = { ...session.user, role: 'user' };
    serve({ enabled: true, packages: [generated] });
    render(Page);

    expect(await screen.findByText(/Only administrators can generate, publish or import/)).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('ipfs-disabled')).toBeNull();
    expect(screen.queryByRole('button', { name: /Publish to IPFS/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate Package/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Import from IPFS/ })).toBeNull();
  });
});
