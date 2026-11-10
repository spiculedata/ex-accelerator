import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import PageHeader from './PageHeader.svelte';

describe('PageHeader', () => {
  it('shows the title and subtitle', () => {
    render(PageHeader, { title: 'GDELT World Events', subtitle: 'A map of global news events' });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('GDELT World Events');
    expect(screen.getByText('A map of global news events')).toBeTruthy();
  });

  it('draws the icon a page passes as a path, in the shared tile', () => {
    const { container } = render(PageHeader, { title: 'Data Capture', iconPath: 'M7 16a4 4 0 01-.88-7.903' });

    const path = container.querySelector('svg path');
    expect(path?.getAttribute('d')).toBe('M7 16a4 4 0 01-.88-7.903');
  });

  it('falls back to the default icon when a page passes none', () => {
    const { container } = render(PageHeader, { title: 'Dashboards' });

    expect(container.querySelector('svg path')?.getAttribute('d')).toMatch(/^M9 19v-6/);
  });

  it('keeps the brand width unless a page asks for the wide layout', () => {
    const narrow = render(PageHeader, { title: 'Narrow' });
    expect(narrow.container.querySelector('.max-w-7xl')).toBeTruthy();
    expect(narrow.container.querySelector('.xl\\:max-w-full')).toBeNull();
    narrow.unmount();

    const wide = render(PageHeader, { title: 'Wide', wide: true });
    expect(wide.container.querySelector('.xl\\:max-w-full')).toBeTruthy();
  });

  it('has a labelled back button only when given somewhere to go', () => {
    const without = render(PageHeader, { title: 'Top level' });
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
    without.unmount();

    render(PageHeader, { title: 'Nested', backHref: '/text-analytics' });
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
  });
});
