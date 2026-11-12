import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';

const hoisted = vi.hoisted(() => ({
  goto: vi.fn(),
  beforeNavigate: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto: hoisted.goto, beforeNavigate: hoisted.beforeNavigate }));
vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return { page: readable({ params: { id: '5' } }) };
});

// The d3 charts draw nothing useful without layout, so stand-ins show what they were given
vi.mock('$lib/components/investigation/SwimLaneTimeline.svelte', async () => ({
  default: (await import('../../../test/stubs/TimelineStub.svelte')).default
}));
vi.mock('$lib/components/investigation/portals/SentimentPortal.svelte', async () => ({
  default: (await import('../../../test/stubs/PortalStub.svelte')).default
}));
vi.mock('$lib/components/investigation/portals/VolumePortal.svelte', async () => ({
  default: (await import('../../../test/stubs/PortalStub.svelte')).default
}));
vi.mock('$lib/components/investigation/portals/CorrelationPortal.svelte', async () => ({
  default: (await import('../../../test/stubs/PortalStub.svelte')).default
}));
vi.mock('$lib/components/investigation/portals/TopicsPortal.svelte', async () => ({
  default: (await import('../../../test/stubs/PortalStub.svelte')).default
}));
vi.mock('$lib/components/investigation/portals/GeographyPortal.svelte', async () => ({
  default: (await import('../../../test/stubs/PortalStub.svelte')).default
}));
vi.mock('$lib/components/investigation/portals/ActorsPortal.svelte', async () => ({
  default: (await import('../../../test/stubs/PortalStub.svelte')).default
}));

import { clearSelection } from '$lib/stores/investigationStore';
import Page from './+page.svelte';

const investigation = {
  id: '5',
  name: 'Border Talks',
  description: '',
  keywords: ['border', 'talks'],
  date_start: '2026-01-01',
  date_end: '2026-01-31',
  sources: [],
  created_at: '2026-01-01',
  annotations: [{ id: 'a1', text: 'First note', timestamp: '2026-01-02T00:00:00Z' }]
};

const gdeltEvents = [
  {
    globaleventid: 1, sqldate: '20260105', actor1name: 'Alice', actor2name: 'Bob', goldsteinscale: 3.2, avgtone: -2.5,
    actiongeo_fullname: 'Paris', numarticles: 4, eventcode: '042', quadclass: 1, nummentions: 9, numsources: 3,
    sourceurl: 'https://example.com/story'
  },
  { globaleventid: 2, sqldate: '20260106', actor1name: 'Carol', goldsteinscale: -6, avgtone: 4, actiongeo_fullname: 'Rome', numarticles: 1 }
];
const radioSegments = [
  { id: 1, radio_name: 'Radio One', state: 'CA', segment_start: '2026-01-04T10:00:00Z', duration_seconds: 125, transcript: 'The border talks continue today', sentiment: 'positive', is_political: true, emotion: 'hope', confidence: 0.8 }
];
const socialPosts = [
  { id: 'p1', text: 'Border talks stall', sentiment_category: 'negative', platform: 'twitter', timestamp: 1767434400000, engagement_likes: 10, engagement_shares: 2, engagement_comments: 1, confidence_score: 0.9, emotions: 'anger' },
  { id: 'p2', text: 'Hope for the talks', sentiment_category: 'positive', platform: 'reddit', timestamp: 1767520800000 }
];
const timeline = [{ date: '2026-01-02T00:00:00Z', gdelt_events: 2, social_posts: 1 }];

type Data = { gdelt?: unknown[]; radio?: unknown[]; social?: unknown[]; found?: boolean };
let patchResponse: { status: number; body: unknown };

const reply = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

function stubFetch({ gdelt = gdeltEvents, radio = radioSegments, social = socialPosts, found = true }: Data = {}) {
  const calls = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'PATCH') return reply(patchResponse.body, patchResponse.status);
    if (url.startsWith('/api/investigations')) return reply(found ? { success: true, investigation } : { success: false });
    const type = new URLSearchParams(url.split('?')[1]).get('type');
    if (type === 'investigation-timeline') return reply({ success: true, data: timeline });
    if (type === 'investigation-gdelt-events') return reply({ success: true, data: gdelt });
    if (type === 'investigation-radio-segments') return reply({ success: true, data: radio });
    if (type === 'investigation-social-posts') return reply({ success: true, data: social });
    if (type === 'investigation-keyword-overlap') return reply({ success: true, data: [{ keyword: 'border', gdelt_count: 1 }] });
    return reply({ success: false });
  });
  vi.stubGlobal('fetch', calls);
  return calls;
}

const analyticsCalls = (fetchMock: ReturnType<typeof stubFetch>, type: string) =>
  fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes(`type=${type}`));
const patchBodies = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter((c) => c[1]?.method === 'PATCH').map((c) => JSON.parse(String(c[1]?.body)));

async function openWorkbench(data?: Data) {
  const fetchMock = stubFetch(data);
  render(Page);
  await screen.findByRole('heading', { name: 'Border Talks' });
  await waitFor(() => expect(screen.queryByTestId('timeline-stub')).not.toBeNull());
  return fetchMock;
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  clearSelection();
  hoisted.goto.mockReset();
  hoisted.beforeNavigate.mockReset();
  patchResponse = { status: 200, body: { success: true } };
});

describe('investigation workbench loading', () => {
  it('shows a loading message, then the header with name, keywords and dates', async () => {
    stubFetch();
    render(Page);
    expect(screen.getByText('Loading investigation...')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Border Talks' })).toBeInTheDocument();
    expect(screen.getByText('border')).toBeInTheDocument();
    expect(screen.getByText('talks')).toBeInTheDocument();
    expect(screen.getAllByText(/Jan 1.*Jan 31/).length).toBeGreaterThan(0);
  });

  it('says the investigation was not found, and offers the way back', async () => {
    stubFetch({ found: false });
    render(Page);

    expect(await screen.findByText('Investigation not found')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Back to Investigations' }));
    expect(hoisted.goto).toHaveBeenCalledWith('/investigations');
  });

  it('queries every source with the keywords and date range', async () => {
    const fetchMock = await openWorkbench();

    const [gdeltUrl] = analyticsCalls(fetchMock, 'investigation-gdelt-events');
    expect(gdeltUrl).toContain('keywords=border%2Ctalks');
    expect(gdeltUrl).toContain('date_start=2026-01-01');
    expect(gdeltUrl).toContain('date_end=2026-01-31');
    expect(gdeltUrl).toContain('limit=200');
    expect(analyticsCalls(fetchMock, 'investigation-radio-segments')[0]).toContain('limit=100');
    expect(analyticsCalls(fetchMock, 'investigation-social-posts')[0]).toContain('limit=200');
    expect(analyticsCalls(fetchMock, 'investigation-timeline')).toHaveLength(1);
    expect(analyticsCalls(fetchMock, 'investigation-keyword-overlap')).toHaveLength(1);
    expect(screen.getByTestId('timeline-stub')).toHaveAttribute('data-days', '1');
  });

  it('goes back to the list from the header', async () => {
    await openWorkbench();

    await fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(hoisted.goto).toHaveBeenCalledWith('/investigations');
  });
});

describe('source tabs', () => {
  it('opens on GDELT with a count per source, and marks the selected tab', async () => {
    await openWorkbench();

    expect(tab(/GDELT/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/GDELT/)).toHaveTextContent('2');
    expect(tab(/Radio/)).toHaveTextContent('1');
    expect(tab(/Social/)).toHaveTextContent('2');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-gdelt');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-gdelt');
  });

  it('opens on radio when there are no GDELT events, and on social when only posts exist', async () => {
    await openWorkbench({ gdelt: [] });
    expect(tab(/Radio/)).toHaveAttribute('aria-selected', 'true');

    cleanup();
    await openWorkbench({ gdelt: [], radio: [] });
    expect(tab(/Social/)).toHaveAttribute('aria-selected', 'true');
  });

  it('caps the displayed count at 200 and says matches were limited', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ globaleventid: i, sqldate: '20260105', goldsteinscale: 0, avgtone: 0 }));
    await openWorkbench({ gdelt: many });

    expect(tab(/GDELT/)).toHaveTextContent('200 max');
    expect(screen.getByText(/Showing the first 200 matches/)).toBeInTheDocument();
  });

  it('switches panels', async () => {
    await openWorkbench();

    await fireEvent.click(tab(/Radio/));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-radio');
    await fireEvent.click(tab(/Social/));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-social');
    await fireEvent.click(tab(/Visualizations/));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-visualizations');
  });

  it('shows an empty message for each source', async () => {
    await openWorkbench({ gdelt: [], radio: [], social: [] });

    expect(screen.getByText(/No GDELT events match these keywords\./)).toBeInTheDocument();
    await fireEvent.click(tab(/Radio/));
    expect(screen.getByText('No radio transcripts found')).toBeInTheDocument();
    await fireEvent.click(tab(/Social/));
    expect(screen.getByText('No social posts found')).toBeInTheDocument();
  });
});

describe('GDELT table', () => {
  it('lists events with date, actors, goldstein, tone, location and articles', async () => {
    await openWorkbench();

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    const first = within(rows[1]);
    expect(first.getByText('Jan 5')).toBeInTheDocument();
    expect(first.getByText('Alice')).toBeInTheDocument();
    expect(first.getByText('Bob')).toBeInTheDocument();
    expect(first.getByText('+3.2')).toBeInTheDocument();
    expect(first.getByText('-2.5')).toBeInTheDocument();
    expect(first.getByText('Paris')).toBeInTheDocument();
    expect(first.getByText('4')).toBeInTheDocument();
    expect(within(rows[2]).getByText('-6.0')).toBeInTheDocument();
  });

  it('expands and collapses a row to show its detail', async () => {
    await openWorkbench();
    const row = screen.getAllByRole('row')[1];

    await fireEvent.click(row);
    expect(screen.getByText('Event Type')).toBeInTheDocument();
    expect(screen.getByText('Verbal Coop')).toBeInTheDocument();
    expect(screen.getByText(/9 mentions/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://example.com/story' })).toHaveAttribute('rel', 'noopener noreferrer');

    await fireEvent.click(row);
    expect(screen.queryByText('Event Type')).toBeNull();
  });

  it('keeps an expanded row open when you switch tabs and come back', async () => {
    await openWorkbench();
    await fireEvent.click(screen.getAllByRole('row')[1]);

    await fireEvent.click(tab(/Radio/));
    await fireEvent.click(tab(/GDELT/));

    expect(screen.getByText('Event Type')).toBeInTheDocument();
  });

  it('filters every source when an actor is clicked, shows the pill, and clears it', async () => {
    await openWorkbench();

    await fireEvent.click(within(screen.getAllByRole('row')[2]).getByText('Carol'));

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(tab(/GDELT/)).toHaveTextContent('1');
    expect(screen.getByText('actor')).toBeInTheDocument();
    expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull();
  });

  it('filters by location', async () => {
    await openWorkbench();

    await fireEvent.click(within(screen.getAllByRole('row')[1]).getByText('Paris'));

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('location')).toBeInTheDocument();
  });

  it('names the active filter in the empty message', async () => {
    await openWorkbench();
    await fireEvent.click(tab(/Visualizations/));
    await fireEvent.click(screen.getAllByRole('button', { name: 'raise filter' })[0]);

    await fireEvent.click(tab(/GDELT/));

    expect(screen.getByText('No GDELT events match these keywords and the active filter.')).toBeInTheDocument();
    expect(tab(/Radio/)).toHaveTextContent('1');
  });
});

describe('radio and social lists', () => {
  it('expands a radio transcript with the keywords highlighted', async () => {
    await openWorkbench();
    await fireEvent.click(tab(/Radio/));
    expect(screen.getByText('Radio One')).toBeInTheDocument();
    expect(screen.getByText('Political')).toBeInTheDocument();
    expect(screen.getByText('2m05s')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();

    await fireEvent.click(screen.getByText('Radio One'));

    expect(screen.getByText('Full Transcript')).toBeInTheDocument();
    expect(screen.getByText('31 characters')).toBeInTheDocument();
    const marks = [...document.querySelectorAll('#panel-radio mark')].map((m) => m.textContent);
    expect(marks).toEqual(['border', 'talks']);
  });

  it('expands a social post with engagement, and adds it to the notes once', async () => {
    const fetchMock = await openWorkbench();
    await fireEvent.click(tab(/Social/));
    expect(screen.getByText('Border talks stall')).toBeInTheDocument();

    await fireEvent.click(screen.getByText('Border talks stall'));
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('(90% confidence)')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Add to notes' });

    await fireEvent.click(add);

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1));
    const [body] = patchBodies(fetchMock);
    expect(body.id).toBe('5');
    expect(body.query_config).toBeUndefined();
    expect(body.annotations).toHaveLength(2);
    expect(body.annotations[1].text).toContain('Border talks stall');
    expect(body.annotations[1].text).toContain('twitter post #p1');
    expect(screen.getByRole('button', { name: 'In your notes' })).toBeDisabled();
    // The notes bar opens so the new note is visible
    expect(screen.getByPlaceholderText('Add note...')).toBeInTheDocument();
  });

  it('filters by sentiment when the label is clicked', async () => {
    await openWorkbench();
    await fireEvent.click(tab(/Social/));

    await fireEvent.click(screen.getByText('negative'));

    expect(tab(/Social/)).toHaveTextContent('1');
    expect(screen.queryByText('Hope for the talks')).toBeNull();
    expect(screen.getByText('sentiment')).toBeInTheDocument();
  });
});

describe('notes', () => {
  const openNotes = () => fireEvent.click(screen.getByRole('button', { name: 'Notes' }));

  it('toggles the notes bar and shows the stored notes with a count', async () => {
    await openWorkbench();
    const toggle = screen.getByRole('button', { name: 'Notes' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent('1');

    await openNotes();

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('First note')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved, 1 note');
    expect(screen.getByRole('button', { name: 'Export notes' })).toBeEnabled();
  });

  it('adds a note on Enter and saves only the notes', async () => {
    const fetchMock = await openWorkbench();
    await openNotes();
    const input = screen.getByPlaceholderText('Add note...');

    await fireEvent.input(input, { target: { value: '  Second thought  ' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Second thought')).toBeInTheDocument();
    expect(input).toHaveValue('');
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1));
    const [body] = patchBodies(fetchMock);
    expect(body.annotations.map((a: { text: string }) => a.text)).toEqual(['First note', 'Second thought']);
    expect(body.query_config).toBeUndefined();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved, 2 notes'));
  });

  it('ignores an empty note', async () => {
    const fetchMock = await openWorkbench();
    await openNotes();

    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(patchBodies(fetchMock)).toHaveLength(0);
  });

  it('removes a note and saves', async () => {
    const fetchMock = await openWorkbench();
    await openNotes();

    await fireEvent.click(screen.getByRole('button', { name: 'x' }));

    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1));
    expect(patchBodies(fetchMock)[0].annotations).toEqual([]);
    expect(screen.getByRole('button', { name: 'Export notes' })).toBeDisabled();
  });

  it('serialises quick edits: a second edit during a save is folded into one follow-up with the latest notes', async () => {
    const fetchMock = await openWorkbench();
    await openNotes();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === 'PATCH' && patchBodies(fetchMock).length === 1) await gate;
      return original(input, init);
    });
    const input = screen.getByPlaceholderText('Add note...');

    await fireEvent.input(input, { target: { value: 'one' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await fireEvent.input(input, { target: { value: 'two' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await fireEvent.input(input, { target: { value: 'three' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(patchBodies(fetchMock)).toHaveLength(1);
    release();

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(2));
    expect(patchBodies(fetchMock)[1].annotations.map((a: { text: string }) => a.text)).toEqual(['First note', 'one', 'two', 'three']);
  });

  it('explains a refusal to save someone else\'s investigation', async () => {
    patchResponse = { status: 403, body: { success: false, error: 'forbidden' } };
    await openWorkbench();
    await openNotes();
    const input = screen.getByPlaceholderText('Add note...');

    await fireEvent.input(input, { target: { value: 'mine' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Only the person who created this investigation, or an admin, can change it. Your changes were not saved.')
    );
  });

  it('says saving failed generically for other errors, and keeps the notes unsaved', async () => {
    patchResponse = { status: 500, body: { success: false } };
    await openWorkbench();
    await openNotes();
    const input = screen.getByPlaceholderText('Add note...');

    await fireEvent.input(input, { target: { value: 'mine' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not save notes. Try again.'));
    expect(screen.getByRole('button', { name: 'Could not save. Try again' })).toBeInTheDocument();
  });

  it('saves keywords and dates as well when the Save button is used', async () => {
    const fetchMock = await openWorkbench();

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1));
    const [body] = patchBodies(fetchMock);
    expect(body.query_config).toMatchObject({ keywords: ['border', 'talks'], dateStart: '2026-01-01', dateEnd: '2026-01-31' });
    expect(body.annotations).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).className).toContain('text-emerald-400'));
  });

  it('asks before leaving with unsaved notes, but not when everything is saved', async () => {
    patchResponse = { status: 500, body: { success: false } };
    await openWorkbench();
    expect(hoisted.beforeNavigate).toHaveBeenCalled();
    const guard = hoisted.beforeNavigate.mock.calls.at(-1)![0] as (nav: { cancel: () => void; type: string }) => void;

    const cancelClean = vi.fn();
    guard({ cancel: cancelClean, type: 'goto' });
    expect(cancelClean).not.toHaveBeenCalled();

    await openNotes();
    const input = screen.getByPlaceholderText('Add note...');
    await fireEvent.input(input, { target: { value: 'unsaved' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not save'));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const cancelStay = vi.fn();
    guard({ cancel: cancelStay, type: 'goto' });
    expect(confirmSpy).toHaveBeenCalledWith('Your latest notes have not been saved. Leave this page anyway?');
    expect(cancelStay).toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    const cancelLeave = vi.fn();
    guard({ cancel: cancelLeave, type: 'goto' });
    expect(cancelLeave).not.toHaveBeenCalled();

    const cancelClose = vi.fn();
    guard({ cancel: cancelClose, type: 'leave' });
    expect(cancelClose).toHaveBeenCalled();
  });
});

describe('exports', () => {
  let blobs: Blob[];
  let downloads: string[];

  const readBlob = (blob: Blob) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });

  beforeEach(() => {
    blobs = [];
    downloads = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });

  it('exports every loaded post as CSV with a byte order mark and a safe filename', async () => {
    await openWorkbench();

    await fireEvent.click(screen.getByRole('button', { name: 'Export posts as CSV' }));

    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^investigation-Border-Talks-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await readBlob(blobs[0]);
    expect(blobs[0].type).toBe('text/csv;charset=utf-8');
    expect(text.replace('﻿', '')).toContain('id,platform,author,posted_at,text,sentiment,confidence,emotions,likes,shares,comments,citation');
    expect(text).toContain('Border talks stall');
    expect(text).toContain('Hope for the talks');
  });

  it('exports everything as JSON with the notes, summary and posts', async () => {
    await openWorkbench();

    await fireEvent.click(screen.getByRole('button', { name: 'Export everything as JSON' }));

    expect(downloads[0]).toMatch(/\.json$/);
    const report = JSON.parse(await readBlob(blobs[0]));
    expect(report.investigation).toEqual({ name: 'Border Talks', keywords: ['border', 'talks'], dateStart: '2026-01-01', dateEnd: '2026-01-31' });
    expect(report.annotations).toHaveLength(1);
    expect(report.summary).toEqual({ gdelt_events: 2, radio_segments: 1, social_posts: 2, timeline_days: 1 });
    expect(report.social_posts).toHaveLength(2);
    expect(report.gdelt_sample).toHaveLength(2);
    expect(report.note).toContain('holds the 2 posts loaded');
  });

  it('exports the notes as Markdown', async () => {
    await openWorkbench();
    await fireEvent.click(screen.getByRole('button', { name: 'Notes' }));

    await fireEvent.click(screen.getByRole('button', { name: 'Export notes' }));

    expect(downloads[0]).toMatch(/\.md$/);
    expect(await readBlob(blobs[0])).toContain('First note');
  });
});

describe('time range', () => {
  it('reloads the detail panels for a brushed range and resets back to the whole range', async () => {
    const fetchMock = await openWorkbench();
    expect(screen.queryByRole('button', { name: 'Reset time range' })).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'brush' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset time range' })).toBeInTheDocument());
    const brushed = analyticsCalls(fetchMock, 'investigation-gdelt-events').at(-1)!;
    expect(brushed).toContain('date_start=2026-01-10');
    expect(brushed).toContain('date_end=2026-01-12');
    expect(analyticsCalls(fetchMock, 'investigation-keyword-overlap').at(-1)).toContain('date_start=2026-01-10');
    expect(screen.getByText(/Jan 10 - Jan 12/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reset time range' })).toBeNull());
    expect(analyticsCalls(fetchMock, 'investigation-gdelt-events').at(-1)).toContain('date_start=2026-01-01');
  });

  it('narrows to a single day when a day is clicked', async () => {
    const fetchMock = await openWorkbench();

    await fireEvent.click(screen.getByRole('button', { name: 'click day' }));

    await waitFor(() => expect(analyticsCalls(fetchMock, 'investigation-social-posts').at(-1)).toContain('date_start=2026-01-05'));
    expect(analyticsCalls(fetchMock, 'investigation-social-posts').at(-1)).toContain('date_end=2026-01-05');
  });
});

describe('visualizations tab', () => {
  async function openVisualizations() {
    await openWorkbench();
    await fireEvent.click(tab(/Visualizations/));
  }

  it('shows all six portals in order with their saved size', async () => {
    await openVisualizations();

    const stubs = screen.getAllByTestId('portal-stub');
    expect(stubs).toHaveLength(6);
    expect(stubs[0]).toHaveAttribute('data-height', '280');
    expect(document.querySelectorAll('[data-portal-cell]')).toHaveLength(6);
    for (const label of ['Sentiment', 'Volume', 'Correlation', 'Topics', 'Geography', 'Actors']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('hides and shows a portal and remembers the choice', async () => {
    await openVisualizations();

    await fireEvent.click(screen.getByRole('button', { name: 'Volume' }));

    expect(screen.getAllByTestId('portal-stub')).toHaveLength(5);
    expect(JSON.parse(localStorage.getItem('investigation-portal-layout') ?? '{}').visible).not.toContain('volume');

    await fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    expect(screen.getAllByTestId('portal-stub')).toHaveLength(6);
  });

  it('applies a raised cross-filter to the portals and shows the pill', async () => {
    await openVisualizations();

    await fireEvent.click(screen.getAllByRole('button', { name: 'raise filter' })[0]);

    expect(screen.getAllByTestId('portal-stub')[0]).toHaveAttribute('data-cross', 'yes');
    expect(screen.getAllByRole('button', { name: 'Clear filter' }).length).toBeGreaterThan(0);
  });

  it('resets the layout', async () => {
    await openVisualizations();
    await fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    expect(screen.getAllByTestId('portal-stub')).toHaveLength(5);

    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getAllByTestId('portal-stub')).toHaveLength(6);
  });

  it('swaps two portals when one is dropped on another', async () => {
    await openVisualizations();
    const cells = document.querySelectorAll('[data-portal-cell]');
    const before = [...cells].map((c) => c.getAttribute('style'));

    await fireEvent.dragStart(cells[0]);
    await fireEvent.dragOver(cells[1]);
    await fireEvent.drop(cells[1]);

    const layout = JSON.parse(localStorage.getItem('investigation-portal-layout') ?? '{}');
    expect(layout.order.slice(0, 2)).toEqual(['volume', 'sentiment']);
    expect(before).toHaveLength(6);
  });

  it('resizes a portal by dragging its corner and saves the grid', async () => {
    await openVisualizations();
    const cell = document.querySelectorAll('[data-portal-cell]')[0] as HTMLElement;
    Object.defineProperty(cell.parentElement, 'clientWidth', { configurable: true, value: 1200 });
    const handle = cell.querySelector('[role="separator"]') as HTMLElement;

    await fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    await fireEvent.mouseMove(document, { clientX: 300, clientY: 340 });
    await fireEvent.mouseUp(document);

    const grid = JSON.parse(localStorage.getItem('investigation-portal-grid') ?? '[]');
    const sentiment = grid.find((g: { id: string }) => g.id === 'sentiment');
    // 200px over 100px columns adds 2 columns; 240px over 140px rows adds 2 rows (rounded)
    expect(sentiment).toMatchObject({ w: 8, h: 4 });
    expect(cell.getAttribute('style')).toContain('grid-column: span 8');
  });
});
