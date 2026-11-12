import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import type { writable } from 'svelte/store';

type PageState = {
  route: { id: string | null };
  params: Record<string, string>;
  url: URL;
  data: { user?: { name: string; email: string; role: string } | null };
};

const hoisted = vi.hoisted(() => ({
  goto: vi.fn(),
  signOut: vi.fn(),
  signOutEverywhere: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto: hoisted.goto }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  const page = writable({
    route: { id: '/' },
    params: {},
    url: new URL('http://localhost/'),
    data: { user: null }
  });
  return { page };
});
vi.mock('$lib/utils/signOut', () => ({ signOut: hoisted.signOut, signOutEverywhere: hoisted.signOutEverywhere }));

import { page } from '$app/stores';
import { currentProject } from '$lib/stores/projectStore';
import Navigation from './Navigation.svelte';

const pageStore = page as unknown as ReturnType<typeof writable<PageState>>;

const projects = [
  { id: 1, name: 'Alpha', description: 'First project' },
  { id: 2, name: 'Beta', description: 'Second project' }
];
const workspaces = [
  { id: 10, name: 'Elections', workspace_type: 'research' },
  { id: 11, name: 'Quiet', workspace_type: 'general' }
];
const summaries: Record<string, unknown> = {
  '10': { types: ['social_media', 'gdelt_events'], platforms: ['twitter'], datasetCount: 2, recordCount: 12500, lastSync: '2d ago' },
  '11': { types: [], platforms: [], datasetCount: 0, recordCount: 0 }
};

const json = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

function stubFetch({ withProjects = true }: { withProjects?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/projects') return json({ success: true, projects: withProjects ? projects : [] });
      if (url.startsWith('/api/projects?id=')) {
        const id = Number(url.split('=')[1]);
        const project = projects.find((p) => p.id === id);
        return json({ success: Boolean(project), project });
      }
      if (url.startsWith('/api/workspaces?project_id=')) return json({ success: true, workspaces });
      if (url.startsWith('/api/workspaces?id=')) {
        const id = Number(url.split('=')[1]);
        return json({ success: true, workspace: workspaces.find((w) => w.id === id) });
      }
      const summary = /\/api\/workspaces\/(\d+)\/dataset-summary/.exec(url);
      if (summary) return json({ success: true, summary: summaries[summary[1]] });
      return json({ success: false });
    })
  );
}

function setPage(pathname: string, user: PageState['data']['user'] = null) {
  pageStore.set({
    route: { id: pathname },
    params: {},
    url: new URL(`http://localhost${pathname}`),
    data: { user }
  });
}

const admin = { name: 'Ada Admin', email: 'ada@example.com', role: 'admin' };
const viewer = { name: 'Vic Viewer', email: 'vic@example.com', role: 'viewer' };

const mobileMenu = () => document.querySelector('.mobile-menu') as HTMLElement;

async function openMobileMenu() {
  await fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
  return within(mobileMenu());
}

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  currentProject.set(null);
  hoisted.goto.mockReset();
  hoisted.signOut.mockReset();
  hoisted.signOutEverywhere.mockReset();
  setPage('/');
  stubFetch();
});

describe('Navigation desktop menu', () => {
  it('lists the plain links and the dropdown triggers', () => {
    render(Navigation);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Research Notebooks' })).toHaveAttribute('href', '/text-analytics/research-investigation');
    expect(screen.getByRole('link', { name: 'Investigations' })).toHaveAttribute('href', '/investigations');
    for (const name of ['Social Analytics', 'GDELT', 'Images', 'Data']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('opens a dropdown on click, closes it on a second click, and shows its items as links', async () => {
    render(Navigation);
    const trigger = screen.getByRole('button', { name: 'Data' });

    await fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Data Management' })).toHaveAttribute('href', '/data-management');
    expect(screen.getByRole('link', { name: 'Data Capture' })).toHaveAttribute('href', '/data-capture');
    expect(screen.getByRole('link', { name: 'Data Sharing' })).toHaveAttribute('href', '/data-sharing');
    expect(screen.getByRole('link', { name: 'Workflow Builder' })).toHaveAttribute('href', '/data-management/workflow-builder');

    await fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Data Capture' })).toBeNull();
  });

  it('closes an open dropdown on Escape and on a click elsewhere', async () => {
    render(Navigation);
    const trigger = screen.getByRole('button', { name: 'GDELT' });

    await fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: 'GDELT Analytics' })).toBeInTheDocument();
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'GDELT Analytics' })).toBeNull();

    await fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: 'GDELT Analytics' })).toBeInTheDocument();
    await fireEvent.click(document.body);
    expect(screen.queryByRole('link', { name: 'GDELT Analytics' })).toBeNull();
  });

  it('navigates with goto instead of following the link, and adds no workspace without one', async () => {
    render(Navigation);

    await fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    await fireEvent.click(screen.getByRole('link', { name: 'Data Sharing' }));
    await fireEvent.click(screen.getByRole('link', { name: 'Investigations' }));

    expect(hoisted.goto).toHaveBeenNthCalledWith(1, '/data-sharing');
    expect(hoisted.goto).toHaveBeenNthCalledWith(2, '/investigations');
  });

  it('marks only the link of the current page as current', () => {
    setPage('/investigations');
    render(Navigation);

    expect(screen.getByRole('link', { name: 'Investigations' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Research Notebooks' })).not.toHaveAttribute('aria-current');
  });

  it('marks Home as current on the home page', () => {
    render(Navigation);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('highlights a dropdown trigger whose own path is the current page', () => {
    setPage('/dashboards');
    render(Navigation);

    expect(screen.getByRole('button', { name: 'Social Analytics' }).className).toContain('bg-blue-50');
    expect(screen.getByRole('button', { name: 'Data' }).className).not.toContain('bg-blue-50');
  });

  it('adds the current workspace to workspace-aware dropdown links', async () => {
    localStorage.setItem('currentWorkspace', '10');
    render(Navigation);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/workspaces?id=10'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/workspaces/10/dataset-summary'));

    await fireEvent.click(screen.getByRole('button', { name: 'Social Analytics' }));
    await fireEvent.click(screen.getByRole('link', { name: 'Sentiment Analysis' }));

    expect(hoisted.goto).toHaveBeenCalledWith('/text-analytics/sentiment-analysis?workspace=10');
  });
});

describe('Navigation mobile menu', () => {
  it('starts closed and toggles with the menu button', async () => {
    render(Navigation);
    const toggle = screen.getByRole('button', { name: 'Toggle menu' });

    expect(mobileMenu()).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await fireEvent.click(toggle);
    expect(mobileMenu()).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await fireEvent.click(toggle);
    expect(mobileMenu()).toBeNull();
  });

  it('closes on Escape', async () => {
    render(Navigation);
    await openMobileMenu();

    await fireEvent.keyDown(document, { key: 'Escape' });

    expect(mobileMenu()).toBeNull();
  });

  it('lists the top-level items, marks the current page and expands a group on click', async () => {
    setPage('/investigations');
    render(Navigation);
    const menu = await openMobileMenu();

    expect(menu.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(menu.getByRole('link', { name: 'Investigations' })).toHaveAttribute('aria-current', 'page');
    expect(menu.queryByRole('link', { name: 'Data Capture' })).toBeNull();

    await fireEvent.click(menu.getByRole('button', { name: 'Data' }));

    expect(menu.getByRole('link', { name: 'Data Capture' })).toHaveAttribute('href', '/data-capture');
  });

  it('closes after choosing a link and navigates there', async () => {
    render(Navigation);
    const menu = await openMobileMenu();

    await fireEvent.click(menu.getByRole('button', { name: 'Data' }));
    await fireEvent.click(menu.getByRole('link', { name: 'Data Capture' }));

    expect(hoisted.goto).toHaveBeenCalledWith('/data-capture');
    expect(mobileMenu()).toBeNull();
  });

  it('closes after choosing a plain link', async () => {
    render(Navigation);
    const menu = await openMobileMenu();

    await fireEvent.click(menu.getByRole('link', { name: 'Investigations' }));

    expect(hoisted.goto).toHaveBeenCalledWith('/investigations');
    expect(mobileMenu()).toBeNull();
  });

  it('shows no account section when nobody is signed in', async () => {
    render(Navigation);
    const menu = await openMobileMenu();

    expect(menu.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(menu.queryByText('Change password')).toBeNull();
  });

  it('shows the signed-in user with sign out, sign out everywhere, switch project and change password', async () => {
    setPage('/', viewer);
    render(Navigation);
    const menu = await openMobileMenu();

    expect(menu.getByText('Vic Viewer')).toBeInTheDocument();
    expect(menu.getByText('VV')).toBeInTheDocument();
    expect(menu.getByText(/vic@example.com/)).toBeInTheDocument();
    expect(menu.getByRole('link', { name: 'Switch project' })).toHaveAttribute('href', '/projects');
    expect(menu.getByText('Change password', { selector: 'summary' })).toBeInTheDocument();

    await fireEvent.click(menu.getByRole('button', { name: 'Sign out' }));
    expect(hoisted.signOut).toHaveBeenCalledTimes(1);

    await fireEvent.click(menu.getByRole('button', { name: 'Sign out on all devices' }));
    expect(hoisted.signOutEverywhere).toHaveBeenCalledTimes(1);
  });

  it('offers Manage users to admins only', async () => {
    setPage('/', admin);
    render(Navigation);
    const adminMenu = await openMobileMenu();
    expect(adminMenu.getByRole('link', { name: 'Manage users' })).toHaveAttribute('href', '/settings/users');

    cleanup();
    setPage('/', viewer);
    render(Navigation);
    const viewerMenu = await openMobileMenu();
    expect(viewerMenu.queryByRole('link', { name: 'Manage users' })).toBeNull();
  });

  it('explains the asterisk for project-only items when no project is selected', async () => {
    stubFetch({ withProjects: false });
    render(Navigation);
    const menu = await openMobileMenu();

    expect(menu.getByText('* Requires project selection')).toBeInTheDocument();
  });
});

describe('Navigation project and workspace selectors', () => {
  it('offers a Select Project button when there are no projects', async () => {
    stubFetch({ withProjects: false });
    render(Navigation);

    await fireEvent.click(screen.getByRole('button', { name: 'Select Project' }));

    expect(hoisted.goto).toHaveBeenCalledWith('/projects');
  });

  it('shows the current project and lists the projects in the switcher', async () => {
    render(Navigation);
    const trigger = await screen.findByRole('button', { name: /Alpha/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Switch Project')).toBeInTheDocument();
    expect(screen.getByText('Second project')).toBeInTheDocument();
  });

  it('switches project and opens its page', async () => {
    render(Navigation);
    await fireEvent.click(await screen.findByRole('button', { name: /Alpha/ }));

    await fireEvent.click(screen.getByRole('button', { name: /Beta/ }));

    await waitFor(() => expect(hoisted.goto).toHaveBeenCalledWith('/projects/2'));
  });

  it('goes to Manage Projects, and clears the project and goes home', async () => {
    render(Navigation);
    await fireEvent.click(await screen.findByRole('button', { name: /Alpha/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Manage Projects' }));
    expect(hoisted.goto).toHaveBeenCalledWith('/projects');
    expect(screen.queryByText('Switch Project')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear Project' }));
    expect(hoisted.goto).toHaveBeenCalledWith('/');
    expect(screen.getByRole('button', { name: /Select Project/ })).toBeInTheDocument();
  });

  it('closes the project switcher on Escape', async () => {
    render(Navigation);
    await fireEvent.click(await screen.findByRole('button', { name: /Alpha/ }));

    await fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Switch Project')).toBeNull();
  });

  it('lists workspaces with record counts and dataset badges, and navigates to the chosen one', async () => {
    render(Navigation);
    const trigger = await screen.findByRole('button', { name: /Workspace/ });

    await fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Switch Workspace')).toBeInTheDocument();
    await screen.findByText('12.5K posts');
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('GDELT', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('• 2d ago')).toBeInTheDocument();
    expect(screen.getByText('No datasets')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Elections/ }));

    expect(hoisted.goto).toHaveBeenCalledWith('/workspaces/10');
    expect(localStorage.getItem('currentWorkspace')).toBe('10');
    expect(screen.queryByText('Switch Workspace')).toBeNull();
  });

  it('goes to the project page from Manage Workspaces', async () => {
    render(Navigation);
    await fireEvent.click(await screen.findByRole('button', { name: /Workspace/ }));

    await fireEvent.click(screen.getByRole('button', { name: 'Manage Workspaces' }));

    expect(hoisted.goto).toHaveBeenCalledWith('/projects/1');
    expect(screen.queryByText('Switch Workspace')).toBeNull();
  });

  it('names the workspace of the page you are on', async () => {
    pageStore.set({
      route: { id: '/workspaces/[id]' },
      params: { id: '11' },
      url: new URL('http://localhost/workspaces/11'),
      data: { user: null }
    });
    render(Navigation);

    expect(await screen.findByRole('button', { name: /Quiet/ })).toBeInTheDocument();
    expect(localStorage.getItem('currentWorkspace')).toBe('11');
  });
});
