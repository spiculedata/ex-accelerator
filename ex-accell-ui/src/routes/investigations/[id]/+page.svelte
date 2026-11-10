<script lang="ts">
  import { resolveInvestigationRange } from '$lib/utils/investigationRange';
  import { formatDay } from '$lib/utils/dayFormat';
  import { parseAnnotations, type Annotation } from '$lib/utils/annotations';
  import { createSingleFlight } from '$lib/utils/singleFlight';
  import { beforeNavigate } from '$app/navigation';
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { highlightKeywords } from '$lib/utils/highlight';
  import { goto } from '$app/navigation';
  import {
    investigationSelection,
    clearSelection,
    setTimeRange,
    setSentimentFilter,
    setSourceFilter,
    setCrossFilter,
    clearCrossFilter,
    type CrossFilter
  } from '$lib/stores/investigationStore';
  import { getPortalLayout, setPortalLayout, getPortalGrid, setPortalGrid, resetPortalGrid, type PortalGridItem } from '$lib/stores/investigationStore';
  import SwimLaneTimeline from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import type { TimelineEntry } from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import SentimentDistribution from '$lib/components/investigation/SentimentDistribution.svelte';
  import ParallelCoordinates from '$lib/components/investigation/ParallelCoordinates.svelte';
  import LagAnalysisChart from '$lib/components/investigation/LagAnalysisChart.svelte';
  import KeywordNetwork from '$lib/components/investigation/KeywordNetwork.svelte';
  import WordCloudChart from '$lib/components/investigation/WordCloudChart.svelte';
  import SentimentPortal from '$lib/components/investigation/portals/SentimentPortal.svelte';
  import VolumePortal from '$lib/components/investigation/portals/VolumePortal.svelte';
  import CorrelationPortal from '$lib/components/investigation/portals/CorrelationPortal.svelte';
  import TopicsPortal from '$lib/components/investigation/portals/TopicsPortal.svelte';
  import GeographyPortal from '$lib/components/investigation/portals/GeographyPortal.svelte';
  import ActorsPortal from '$lib/components/investigation/portals/ActorsPortal.svelte';
  import { CSV_BOM, socialPostRecord, toCsv } from '$lib/utils/evidenceExport';

  export const ssr = false;

  interface Investigation {
    id: string;
    name: string;
    description: string;
    keywords: string[];
    date_start: string;
    date_end: string;
    sources: string[];
    created_at: string;
    /** Notes as stored: an array, or older double-encoded JSON text; read with parseAnnotations */
    annotations?: unknown;
    query_config?: {
      keywords?: string[];
      dateStart?: string;
      dateEnd?: string;
      [key: string]: unknown;
    };
  }

  interface GdeltEvent {
    globaleventid: string | number;
    sqldate: string;
    actor1name?: string;
    actor2name?: string;
    goldsteinscale: number;
    avgtone: number;
    actiongeo_fullname?: string;
    numarticles?: number;
  }

  interface RadioSegment {
    id: string | number;
    radio_name: string;
    state?: string;
    segment_start: string;
    duration_seconds: number;
    transcript: string;
    sentiment?: string;
    emotion?: string;
    confidence?: number;
    is_political?: boolean;
  }

  interface SocialPost {
    id: string | number;
    text: string;
    sentiment_category?: string;
    confidence_score?: number;
    platform?: string;
    timestamp?: string;
    engagement_likes?: number;
    engagement_shares?: number;
    engagement_comments?: number;
    emotions?: string;
  }

  let investigation: Investigation | null = null;
  let loading = true;
  let timelineData: TimelineEntry[] = [];
  let timelineLoading = true;
  let gdeltEvents: GdeltEvent[] = [];
  let radioSegments: RadioSegment[] = [];
  let socialPosts: SocialPost[] = [];
  let keywordData: any[] = [];
  let gdeltLoading = true;
  let radioLoading = true;
  let socialLoading = true;

  // Tabs
  let activeTab: 'gdelt' | 'radio' | 'social' | 'visualizations' = 'gdelt';

  // Portal configuration
  const allPortals = [
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'volume', label: 'Volume' },
    { id: 'correlation', label: 'Correlation' },
    { id: 'topics', label: 'Topics' },
    { id: 'geography', label: 'Geography' },
    { id: 'actors', label: 'Actors' },
  ];
  let portalLayout = getPortalLayout();
  $: visiblePortals = portalLayout.order.filter(id => portalLayout.visible.includes(id));
  let portalGrid: PortalGridItem[] = getPortalGrid();
  let dragSource: string | null = null;
  let dragTarget: string | null = null;

  function togglePortal(portalId: string) {
    const visible = portalLayout.visible.includes(portalId)
      ? portalLayout.visible.filter(id => id !== portalId)
      : [...portalLayout.visible, portalId];
    portalLayout = { ...portalLayout, visible };
    setPortalLayout(portalLayout);
  }

  // Grid items for visible portals, maintaining saved sizes
  $: gridItems = visiblePortals.map(id => {
    const saved = portalGrid.find(g => g.id === id);
    return saved || { id, x: 0, y: 0, w: 6, h: 2 };
  });

  function portalHeight(item: PortalGridItem): number {
    return item.h * 140;
  }

  // Corner-drag resize
  let resizingPortal: string | null = null;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;
  let resizeEl: HTMLElement | null = null;

  function startResize(portalId: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizingPortal = portalId;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    const item = portalGrid.find(g => g.id === portalId);
    resizeStartW = item?.w ?? 6;
    resizeStartH = item?.h ?? 2;
    resizeEl = (e.target as HTMLElement).closest('[data-portal-cell]');

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(e: MouseEvent) {
    if (!resizingPortal || !resizeEl) return;
    const cellW = resizeEl.parentElement?.clientWidth ? resizeEl.parentElement.clientWidth / 12 : 80;
    const cellH = 140;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    const newW = Math.max(3, Math.min(12, Math.round(resizeStartW + dx / cellW)));
    const newH = Math.max(2, Math.min(8, Math.round(resizeStartH + dy / cellH)));

    portalGrid = portalGrid.map(g =>
      g.id === resizingPortal ? { ...g, w: newW, h: newH } : g
    );
  }

  function handleResizeEnd() {
    if (resizingPortal) {
      setPortalGrid(portalGrid);
      resizingPortal = null;
      resizeEl = null;
    }
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }

  function handleDragStart(portalId: string) {
    dragSource = portalId;
  }

  function handleDragOver(portalId: string, e: DragEvent) {
    e.preventDefault();
    dragTarget = portalId;
  }

  function handleDrop(portalId: string) {
    if (!dragSource || dragSource === portalId) {
      dragSource = null;
      dragTarget = null;
      return;
    }
    // Swap positions in the order
    const order = [...portalLayout.order];
    const srcIdx = order.indexOf(dragSource);
    const tgtIdx = order.indexOf(portalId);
    if (srcIdx >= 0 && tgtIdx >= 0) {
      [order[srcIdx], order[tgtIdx]] = [order[tgtIdx], order[srcIdx]];
      portalLayout = { ...portalLayout, order };
      setPortalLayout(portalLayout);
    }
    dragSource = null;
    dragTarget = null;
  }

  function handleResetGrid() {
    resetPortalGrid();
    portalGrid = getPortalGrid();
    portalLayout = { visible: allPortals.map(p => p.id), order: allPortals.map(p => p.id) };
    setPortalLayout(portalLayout);
  }

  // Row expand states
  let expandedTranscriptId: string | number | null = null;
  let expandedGdeltId: string | number | null = null;
  let expandedSocialId: string | number | null = null;

  // Investigation parameters
  let keywords: string[] = [];
  let dateStart = '';
  let dateEnd = '';

  $: investigationId = $page.params.id || '';

  // Filter timeline data to the currently selected time range for visualizations
  $: filteredTimelineData = (() => {
    const range = $investigationSelection.timeRange;
    if (!range || (range.start === dateStart && range.end === dateEnd)) return timelineData;
    return timelineData.filter((d: any) => {
      const date = d.date;
      return date >= range.start && date <= range.end;
    });
  })();

  // Cross-filter: active filter from portal clicks
  $: activeCrossFilter = $investigationSelection.crossFilter;

  function handleCrossFilter(event: CustomEvent<CrossFilter>) {
    setCrossFilter(event.detail);
  }

  // Apply cross-filter to detail data for portals that consume raw records
  $: crossFilteredGdelt = (() => {
    if (!activeCrossFilter) return gdeltEvents;
    const cf = activeCrossFilter;
    switch (cf.dimension) {
      case 'actor':
        return gdeltEvents.filter((e: any) =>
          (e.actor1name || '').toLowerCase().includes(cf.value.toLowerCase()) ||
          (e.actor2name || '').toLowerCase().includes(cf.value.toLowerCase())
        );
      case 'location':
        return gdeltEvents.filter((e: any) =>
          (e.actiongeo_fullname || '').toLowerCase().includes(cf.value.toLowerCase())
        );
      case 'keyword':
        return gdeltEvents.filter((e: any) => {
          const text = `${e.actor1name || ''} ${e.actor2name || ''} ${e.actiongeo_fullname || ''}`.toLowerCase();
          return text.includes(cf.value.toLowerCase());
        });
      case 'sentiment': {
        return gdeltEvents.filter((e: any) => {
          const tone = e.avgtone ?? e.avg_tone ?? 0;
          if (cf.value === 'positive') return tone > 1;
          if (cf.value === 'negative') return tone < -1;
          return tone >= -1 && tone <= 1; // neutral
        });
      }
      case 'date':
        return gdeltEvents.filter((e: any) => {
          const s = String(e.sqldate);
          const eventDate = s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : s;
          return eventDate === cf.value;
        });
      default:
        return gdeltEvents;
    }
  })();

  $: crossFilteredRadio = (() => {
    if (!activeCrossFilter) return radioSegments;
    const cf = activeCrossFilter;
    switch (cf.dimension) {
      case 'keyword':
        return radioSegments.filter((s: any) =>
          (s.transcript || '').toLowerCase().includes(cf.value.toLowerCase())
        );
      case 'sentiment':
        return radioSegments.filter((s: any) =>
          (s.sentiment || '').toLowerCase() === cf.value
        );
      case 'date':
        return radioSegments.filter((s: any) => {
          const d = (s.segment_start || '').split('T')[0];
          return d === cf.value;
        });
      default:
        return radioSegments;
    }
  })();

  $: crossFilteredSocial = (() => {
    if (!activeCrossFilter) return socialPosts;
    const cf = activeCrossFilter;
    switch (cf.dimension) {
      case 'keyword':
        return socialPosts.filter((p: any) =>
          (p.text || '').toLowerCase().includes(cf.value.toLowerCase())
        );
      case 'sentiment':
        return socialPosts.filter((p: any) =>
          (p.sentiment_category || '').toLowerCase() === cf.value
        );
      case 'date':
        return socialPosts.filter((p: any) => {
          const d = (p.timestamp || '').split('T')[0];
          return d === cf.value;
        });
      default:
        return socialPosts;
    }
  })();

  $: sentimentChartData = computeSentimentFromAllSources(gdeltEvents, radioSegments, socialPosts);

  function computeSentimentFromAllSources(
    gdelt: GdeltEvent[],
    radio: RadioSegment[],
    social: SocialPost[]
  ): { label: string; value: number; color: string }[] {
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const e of gdelt) {
      if (e.avgtone > 1) positive++;
      else if (e.avgtone < -1) negative++;
      else neutral++;
    }

    for (const s of radio) {
      const label = (s.sentiment || 'neutral').toLowerCase();
      if (label === 'positive') positive++;
      else if (label === 'negative') negative++;
      else neutral++;
    }

    for (const p of social) {
      const label = (p.sentiment_category || 'neutral').toLowerCase();
      if (label === 'positive') positive++;
      else if (label === 'negative') negative++;
      else neutral++;
    }

    return [
      { label: 'Positive', value: positive, color: getSentimentColor('positive') },
      { label: 'Negative', value: negative, color: getSentimentColor('negative') },
      { label: 'Neutral', value: neutral, color: getSentimentColor('neutral') }
    ];
  }

  onMount(() => {
    loadInvestigation();
    return () => clearSelection();
  });

  async function loadInvestigation() {
    loading = true;
    try {
      const response = await fetch(`/api/investigations?id=${investigationId}`);
      const result = await response.json();
      if (result.success && result.investigation) {
        investigation = result.investigation;
        annotations = parseAnnotations(investigation?.annotations);
        savedSnapshot = JSON.stringify(annotations);
        const config = investigation?.query_config || {};
        keywords = investigation?.keywords || config.keywords || [];
        // The queries need both dates, so a blank range falls back to the last 90 days
        const range = resolveInvestigationRange(
          investigation?.date_start || config.dateStart || '',
          investigation?.date_end || config.dateEnd || ''
        );
        dateStart = range.start;
        dateEnd = range.end;

        if (dateStart && dateEnd) {
          setTimeRange(dateStart, dateEnd);
        }

        await Promise.all([
          loadTimeline(keywords, dateStart, dateEnd),
          loadDetailPanels(keywords, dateStart, dateEnd),
          loadKeywordData(keywords, dateStart, dateEnd)
        ]);

        // Open on the first source that has results rather than an empty tab
        if (gdeltEvents.length === 0) {
          if (radioSegments.length > 0) activeTab = 'radio';
          else if (socialPosts.length > 0) activeTab = 'social';
        }
      }
    } catch (error) {
      console.error('Error loading investigation:', error);
    } finally {
      loading = false;
    }
  }

  async function loadTimeline(kw: string[], ds: string, de: string) {
    timelineLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-timeline' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);
      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) {
        const raw = result.data || result.timeline || [];
        timelineData = raw.map((d: any) => ({
          date: typeof d.date === 'string' && d.date.includes('T') ? d.date.split('T')[0] : d.date,
          gdelt_events: Number(d.gdelt_events ?? d.events ?? 0),
          gdelt_avg_goldstein: Number(d.gdelt_avg_goldstein ?? d.avg_goldstein ?? 0),
          gdelt_avg_tone: Number(d.gdelt_avg_tone ?? d.avg_tone ?? 0),
          radio_segments: Number(d.radio_segments ?? 0),
          radio_positive: Number(d.radio_positive ?? 0),
          radio_negative: Number(d.radio_negative ?? 0),
          radio_neutral: Number(d.radio_neutral ?? 0),
          social_posts: Number(d.social_posts ?? 0),
          social_positive: Number(d.social_positive ?? 0),
          social_negative: Number(d.social_negative ?? 0),
          social_neutral: Number(d.social_neutral ?? 0),
        }));
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      timelineLoading = false;
    }
  }

  async function loadDetailPanels(kw: string[], ds: string, de: string) {
    await Promise.all([
      loadGdeltEvents(kw, ds, de),
      loadRadioSegments(kw, ds, de),
      loadSocialPosts(kw, ds, de)
    ]);
  }

  async function loadGdeltEvents(kw: string[], ds: string, de: string) {
    gdeltLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-gdelt-events', limit: '200' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);
      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) gdeltEvents = result.data || result.events || [];
    } catch (error) {
      console.error('Error loading GDELT events:', error);
    } finally {
      gdeltLoading = false;
    }
  }

  async function loadRadioSegments(kw: string[], ds: string, de: string) {
    radioLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-radio-segments', limit: '100' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);
      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) radioSegments = result.data || result.segments || [];
    } catch (error) {
      console.error('Error loading radio segments:', error);
    } finally {
      radioLoading = false;
    }
  }

  async function loadSocialPosts(kw: string[], ds: string, de: string) {
    socialLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-social-posts', limit: '200' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);
      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) socialPosts = result.data || result.posts || [];
    } catch (error) {
      console.error('Error loading social posts:', error);
    } finally {
      socialLoading = false;
    }
  }

  async function loadKeywordData(kw: string[], ds: string, de: string) {
    try {
      const params = new URLSearchParams({ type: 'investigation-keyword-overlap' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);
      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) keywordData = result.data || [];
    } catch (error) {
      console.error('Error loading keyword data:', error);
    }
  }

  $: wordCloudData = keywordData.map((k: any) => ({
    text: k.keyword || k.word,
    size: (k.gdelt_count || 0) + (k.radio_count || 0) + (k.social_count || 0)
  })).filter((w: any) => w.size > 0);

  function handleBrushChange(event: CustomEvent<{ start: Date; end: Date }>) {
    const { start, end } = event.detail;
    const brushStart = start.toISOString().split('T')[0];
    const brushEnd = end.toISOString().split('T')[0];
    setTimeRange(brushStart, brushEnd);
    loadDetailPanels(keywords, brushStart, brushEnd);
    loadKeywordData(keywords, brushStart, brushEnd);
  }

  function handleDayClick(event: CustomEvent<{ date: string }>) {
    const { date } = event.detail;
    setTimeRange(date, date);
    loadDetailPanels(keywords, date, date);
    loadKeywordData(keywords, date, date);
  }

  function handleSentimentFilter(event: CustomEvent<{ label: string }>) {
    const { label } = event.detail;
    const current = $investigationSelection.sentiment || [];
    if (current.includes(label.toLowerCase())) {
      setSentimentFilter(current.filter((s: string) => s !== label.toLowerCase()));
    } else {
      setSentimentFilter([...current, label.toLowerCase()]);
    }
  }

  function resetBrush() {
    if (dateStart && dateEnd) {
      setTimeRange(dateStart, dateEnd);
      loadDetailPanels(keywords, dateStart, dateEnd);
      loadKeywordData(keywords, dateStart, dateEnd);
    }
  }

  function formatDateCompact(dateStr: string): string {
    return formatDay(dateStr);
  }

  function formatGdeltDate(sqldate: string | number): string {
    const s = String(sqldate);
    if (s.length !== 8) return s;
    const d = new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatPostDate(timestamp: string | number | undefined): string {
    if (!timestamp && timestamp !== 0) return '';
    const fmt = (d: Date) => isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (typeof timestamp === 'number') {
      if (timestamp > 1e12) return fmt(new Date(timestamp));
      if (timestamp > 1e9) return fmt(new Date(timestamp * 1000));
      return '';
    }
    // Try ISO string parse first (most common for API data)
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return fmt(d);
    // Try numeric parse as fallback
    const ts = Number(timestamp);
    if (!isNaN(ts) && ts > 1e12) return fmt(new Date(ts));
    if (!isNaN(ts) && ts > 1e9) return fmt(new Date(ts * 1000));
    return '';
  }

  function goldsteinColor(val: number): string {
    if (val >= 5) return 'bg-emerald-600/80 text-emerald-100';
    if (val >= 2) return 'bg-emerald-700/60 text-emerald-200';
    if (val >= 0.5) return 'bg-emerald-800/40 text-emerald-300';
    if (val > -0.5) return 'bg-slate-700/50 text-slate-300';
    if (val > -2) return 'bg-rose-800/40 text-rose-300';
    if (val > -5) return 'bg-rose-700/60 text-rose-200';
    return 'bg-rose-600/80 text-rose-100';
  }

  function toneBarWidth(tone: number): number {
    return Math.min(100, Math.max(0, (tone + 10) * 5));
  }

  function sentimentDotColor(sentiment?: string): string {
    const s = (sentiment || 'neutral').toLowerCase();
    if (s === 'positive') return 'bg-sentiment-positive';
    if (s === 'negative') return 'bg-sentiment-negative';
    return 'bg-sentiment-neutral';
  }


  // Annotations
  let annotations: Annotation[] = [];
  let newAnnotation = '';
  let showAnnotations = false;
  let saveStatus: '' | 'saving' | 'saved' | 'error' = '';
  // Why a save failed, when the reason is one the visitor can act on (someone else's investigation)
  let saveErrorMessage = '';
  let savedSnapshot = '[]';
  // Notes that exist on screen but not yet in the database
  $: unsaved = JSON.stringify(annotations) !== savedSnapshot;

  // Adding or removing a note saves straight away. Saves are serialised so that two quick edits cannot
  // finish out of order: a save that arrives while another is running is folded into one follow-up that
  // sends the latest notes.
  function addAnnotation() {
    if (!newAnnotation.trim()) return;
    annotations = [...annotations, { id: crypto.randomUUID(), text: newAnnotation.trim(), timestamp: new Date().toISOString() }];
    newAnnotation = '';
    void saveNotes();
  }

  function removeAnnotation(id: string) {
    annotations = annotations.filter(a => a.id !== id);
    void saveNotes();
  }

  async function persist(includeConfig: boolean) {
    saveStatus = 'saving';
    saveErrorMessage = '';
    const toSave = annotations;
    try {
      const response = await fetch('/api/investigations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Autosaving a note sends only the notes, so keyword and date edits being tried out are not saved with it
        body: JSON.stringify({
          id: investigationId,
          ...(includeConfig ? { query_config: { ...investigation?.query_config, keywords, dateStart, dateEnd } } : {}),
          annotations: toSave
        })
      });
      const result = await response.json().catch(() => null);
      if (response.status === 403) saveErrorMessage = 'Only the person who created this investigation, or an admin, can change it. Your changes were not saved.';
      if (!response.ok || !result?.success) throw new Error(result?.error ?? `HTTP ${response.status}`);
      savedSnapshot = JSON.stringify(toSave);
      saveStatus = 'saved';
      setTimeout(() => { if (saveStatus === 'saved') saveStatus = ''; }, 2000);
    } catch (error) {
      console.error('Error saving investigation:', error);
      saveStatus = 'error';
    }
  }

  // Which payload the next run sends: an explicit Save also saves keywords and dates
  let nextSaveIncludesConfig = false;
  const runSave = createSingleFlight(() => {
    const includeConfig = nextSaveIncludesConfig;
    nextSaveIncludesConfig = false;
    return persist(includeConfig);
  });
  const saveNotes = () => runSave();
  function handleSave() {
    nextSaveIncludesConfig = true;
    return runSave();
  }

  // Leaving the page with notes that are unsaved, or whose save failed, would lose them
  // Closing the tab or going to another site ('leave') cannot show our own dialog, so cancelling lets the
  // browser ask; in-app navigation can ask here. An unsaved list already covers a failed save.
  beforeNavigate(({ cancel, type }) => {
    if (!unsaved) return;
    if (type === 'leave') cancel();
    else if (!confirm('Your latest notes have not been saved. Leave this page anyway?')) cancel();
  });

  function downloadFile(contents: string, type: string, extension: string) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investigation-${(investigation?.name ?? 'export').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Every post that was loaded (up to 200), not a sample, with the fields needed to cite and find each one again
  async function handleExport() {
    const report = {
      investigation: { name: investigation?.name, keywords, dateStart, dateEnd },
      annotations,
      summary: { gdelt_events: gdeltEvents.length, radio_segments: radioSegments.length, social_posts: socialPosts.length, timeline_days: timelineData.length },
      gdelt_sample: gdeltEvents.slice(0, 50),
      radio_sample: radioSegments.slice(0, 20),
      social_posts: socialPosts.map(socialPostRecord),
      note: `Posts carry no permalink in this data. Each has a citation (platform, post id, author, ISO 8601 UTC time) to find it again. This export holds the ${socialPosts.length} posts loaded for this investigation (the workbench loads at most 200) and ignores any cross-filter on screen.`,
      exported_at: new Date().toISOString()
    };
    downloadFile(JSON.stringify(report, null, 2), 'application/json', 'json');
  }

  function handleExportCsv() {
    const rows = socialPosts.map(socialPostRecord);
    // Text starting with = + - @ gets a leading ' so a spreadsheet cannot run it; the JSON export holds the verbatim text
    const columns = ['id', 'platform', 'author', 'posted_at', 'text', 'sentiment', 'confidence', 'emotions', 'likes', 'shares', 'comments', 'citation'] as const;
    downloadFile(CSV_BOM + toCsv(rows, columns), 'text/csv;charset=utf-8', 'csv');
  }

  $: totalItems = crossFilteredGdelt.length + crossFilteredRadio.length + crossFilteredSocial.length;

  // Tab counts — reflect cross-filter
  $: tabCounts = {
    gdelt: crossFilteredGdelt.length,
    radio: crossFilteredRadio.length,
    social: crossFilteredSocial.length,
    visualizations: gdeltEvents.length + radioSegments.length + socialPosts.length
  };
</script>

<svelte:head>
  <title>{investigation?.name || 'Investigation'} - Workbench - Social Explorer</title>
  <meta name="description" content="Search, annotate and export the evidence in one investigation." />
</svelte:head>

{#if loading}
  <div class="flex items-center justify-center h-screen bg-slate-950">
    <div class="flex items-center gap-3">
      <svg class="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span class="text-sm text-slate-400 font-mono">Loading investigation...</span>
    </div>
  </div>
{:else if investigation}
  <div class="h-[100dvh] flex flex-col bg-slate-950 overflow-hidden">

    <!-- ============ HEADER BAR ============ -->
    <div class="h-9 flex-shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 flex items-center px-3 gap-2">
      <button on:click={() => goto('/investigations')} class="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0" aria-label="Back">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <h1 class="text-xs font-semibold text-slate-200 truncate max-w-[200px]">{investigation.name}</h1>
      <div class="w-px h-4 bg-slate-700 flex-shrink-0"></div>

      <div class="flex items-center gap-1 flex-shrink-0 overflow-hidden">
        {#each keywords.slice(0, 4) as keyword}
          <span class="px-1 py-0 text-[9px] bg-indigo-500/20 text-indigo-300 rounded font-medium truncate max-w-[70px]">{keyword}</span>
        {/each}
      </div>

      {#if dateStart || dateEnd}
        <span class="text-[11px] font-mono text-slate-500 flex-shrink-0">{formatDateCompact(dateStart)}-{formatDateCompact(dateEnd)}</span>
      {/if}

      {#if $investigationSelection.timeRange && ($investigationSelection.timeRange.start !== dateStart || $investigationSelection.timeRange.end !== dateEnd)}
        <button on:click={resetBrush} class="text-[9px] text-amber-400 hover:text-amber-300 flex-shrink-0" title="Reset time range" aria-label="Reset time range">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      {/if}

      <div class="flex-1"></div>

      <!-- Notes toggle -->
      <button
        on:click={() => showAnnotations = !showAnnotations}
        class="relative p-1 rounded transition-colors {showAnnotations ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'}"
        title="Notes"
        aria-label="Notes"
        aria-pressed={showAnnotations}
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        {#if annotations.length > 0}
          <span class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center">{annotations.length}</span>
        {/if}
      </button>
      <button on:click={handleExportCsv} class="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors text-xs font-semibold" title="Export posts as CSV (text starting with = + - @ is prefixed with an apostrophe; JSON is verbatim)" aria-label="Export posts as CSV">CSV</button>
      <button on:click={handleExport} class="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors" title="Export everything as JSON" aria-label="Export everything as JSON">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>
      <button
        on:click={handleSave}
        class="relative p-1 rounded transition-colors {saveStatus === 'saved' ? 'text-emerald-400' : saveStatus === 'error' ? 'text-danger-400' : saveStatus === 'saving' ? 'text-indigo-400 animate-pulse' : 'text-slate-500 hover:text-slate-300'}"
        title={saveStatus === 'error' ? (saveErrorMessage || 'Could not save. Click to try again') : unsaved ? 'Save (you have unsaved changes)' : 'Save'}
        aria-label={saveStatus === 'error' ? 'Could not save. Try again' : unsaved ? 'Save, you have unsaved changes' : 'Save'}
      >
        {#if unsaved && saveStatus !== 'saving'}
          <span class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-signal-500 rounded-full" aria-hidden="true"></span>
        {/if}
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {#if saveStatus === 'saved'}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          {:else}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          {/if}
        </svg>
      </button>
    </div>

    <!-- ============ ANNOTATIONS ============ -->
    {#if showAnnotations}
      <div class="flex-shrink-0 bg-slate-900 border-b border-slate-700/50 px-3 py-1">
        <div class="flex items-center gap-2">
          <div class="flex-1 flex flex-wrap gap-1">
            {#each annotations as annotation (annotation.id)}
              <div class="flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded px-1.5 py-0.5 max-w-[200px]">
                <p class="text-[9px] text-slate-300 truncate">{annotation.text}</p>
                <button on:click={() => removeAnnotation(annotation.id)} class="text-slate-600 hover:text-rose-400 text-[9px] flex-shrink-0">x</button>
              </div>
            {/each}
            {#if annotations.length === 0}
              <span class="text-[9px] text-slate-600">No notes yet</span>
            {/if}
          </div>
          <span role="status" class="text-[9px] {saveStatus === 'error' ? 'text-danger-400' : 'text-slate-500'}">
            {#if saveStatus === 'error'}{saveErrorMessage || 'Could not save notes. Try again.'}{:else if saveStatus === 'saving'}Saving…{:else if unsaved}Unsaved{:else if annotations.length > 0}Saved, {annotations.length} note{annotations.length === 1 ? '' : 's'}{/if}
          </span>
          <input
            bind:value={newAnnotation}
            placeholder="Add note..."
            class="w-40 px-1.5 py-0.5 text-[9px] bg-slate-800 border border-slate-700 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            on:keydown={(e) => { if (e.key === 'Enter') addAnnotation(); }}
          />
          <button on:click={addAnnotation} class="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-medium rounded">Add</button>
        </div>
      </div>
    {/if}

    <!-- ============ TIMELINE ============ -->
    <div class="flex-shrink-0 bg-slate-900 border-b border-slate-700/50" style="height: 140px;">
      <div class="h-full flex flex-col">
        <div class="px-3 flex items-center justify-between flex-shrink-0" style="height: 16px;">
          <div class="flex items-center gap-2">
            <span class="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Timeline</span>
            {#if $investigationSelection.timeRange}
              <span class="text-[8px] font-mono text-slate-500">{formatDateCompact($investigationSelection.timeRange.start)} - {formatDateCompact($investigationSelection.timeRange.end)}</span>
            {/if}
          </div>
          <span class="text-[8px] font-mono text-slate-600">{timelineData.length} days</span>
        </div>
        <div class="flex-1 min-h-0 px-1">
          {#if timelineLoading}
            <div class="flex items-center justify-center h-full">
              <svg class="animate-spin h-3 w-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </div>
          {:else}
            <SwimLaneTimeline data={timelineData} height={120} on:brushChange={handleBrushChange} on:dayClick={handleDayClick} />
          {/if}
        </div>
      </div>
    </div>

    <!-- ============ TABS ============ -->
    <div role="tablist" aria-label="Investigation sources" class="min-h-8 flex-shrink-0 bg-slate-900 border-b border-slate-700/50 flex items-end px-2 gap-0">
      <!-- Global cross-filter pill — visible on all tabs -->
      {#if activeCrossFilter}
        <div class="flex items-center gap-1.5 px-2 py-0.5 mb-0.5 mr-2 bg-indigo-500/15 border border-indigo-500/30 rounded-full self-center">
          <span class="text-[8px] text-indigo-400/70 uppercase tracking-wider">{activeCrossFilter.dimension}</span>
          <span class="text-[9px] text-indigo-300 font-medium max-w-[100px] truncate">{activeCrossFilter.label || activeCrossFilter.value}</span>
          <button
            on:click={() => clearCrossFilter()}
            class="text-indigo-400/50 hover:text-indigo-300 transition-colors"
            title="Clear filter"
            aria-label="Clear filter"
          >
            <svg class="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      {/if}
      <button
        on:click={() => activeTab = 'gdelt'}
        role="tab"
        id="tab-gdelt"
        aria-selected={activeTab === 'gdelt'}
        aria-controls="panel-gdelt"
        class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'gdelt' ? 'text-amber-400 border-amber-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 {activeTab === 'gdelt' ? 'bg-amber-500' : 'bg-slate-600'}"></span>
        GDELT
        <span class="ml-1 text-[11px] font-mono {activeTab === 'gdelt' ? 'text-amber-400/70' : 'text-slate-600'}">{tabCounts.gdelt >= 200 ? '200 max' : tabCounts.gdelt}</span>
      </button>
      <button
        on:click={() => activeTab = 'radio'}
        role="tab"
        id="tab-radio"
        aria-selected={activeTab === 'radio'}
        aria-controls="panel-radio"
        class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'radio' ? 'text-violet-400 border-violet-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 {activeTab === 'radio' ? 'bg-violet-500' : 'bg-slate-600'}"></span>
        Radio
        <span class="ml-1 text-[11px] font-mono {activeTab === 'radio' ? 'text-violet-400/70' : 'text-slate-600'}">{tabCounts.radio}</span>
      </button>
      <button
        on:click={() => activeTab = 'social'}
        role="tab"
        id="tab-social"
        aria-selected={activeTab === 'social'}
        aria-controls="panel-social"
        class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'social' ? 'text-sky-400 border-sky-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 {activeTab === 'social' ? 'bg-sky-500' : 'bg-slate-600'}"></span>
        Social
        <span class="ml-1 text-[11px] font-mono {activeTab === 'social' ? 'text-sky-400/70' : 'text-slate-600'}">{tabCounts.social >= 200 ? '200 max' : tabCounts.social}</span>
      </button>
      <button
        on:click={() => activeTab = 'visualizations'}
        role="tab"
        id="tab-visualizations"
        aria-selected={activeTab === 'visualizations'}
        aria-controls="panel-visualizations"
        class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'visualizations' ? 'text-indigo-400 border-indigo-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
      >
        <svg class="inline-block w-3 h-3 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Visualizations
      </button>
    </div>

    <!-- ============ TAB CONTENT ============ -->
    <div class="flex-1 min-h-0 overflow-hidden">

      <!-- GDELT Tab -->
      {#if activeTab === 'gdelt'}
        <div role="tabpanel" id="panel-gdelt" aria-labelledby="tab-gdelt" class="h-full">
        {#if gdeltLoading}
          <div class="flex items-center justify-center h-full"><svg class="animate-spin h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
        {:else if crossFilteredGdelt.length === 0}
          <div class="flex flex-col items-center justify-center h-full gap-1 text-sm text-slate-400">
            <p>No GDELT events match these keywords{activeCrossFilter ? ' and the active filter' : ''}.</p>
            <p class="text-xs text-slate-500">Matching looks for the keyword anywhere in a word. Try different keywords or a wider date range.</p>
          </div>
        {:else}
          <div class="h-full overflow-y-auto">
            <p class="px-3 py-1.5 text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
              Keywords match anywhere in a word, so “bus” also finds “business”.
              {#if tabCounts.gdelt >= 200}<span class="text-amber-300">Showing the first 200 matches; narrow the keywords or dates to see others.</span>{/if}
            </p>
            <table class="w-full text-xs">
              <thead class="sticky top-0 z-10">
                <tr class="bg-slate-900">
                  <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-20">Date</th>
                  <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5">Actors</th>
                  <th class="text-center text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-20">Goldstein</th>
                  <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-32">Avg Tone</th>
                  <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5">Location</th>
                  <th class="text-right text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-16">Articles</th>
                </tr>
              </thead>
              <tbody>
                {#each crossFilteredGdelt as event}
                  {@const expanded = expandedGdeltId === event.globaleventid}
                  <tr
                    class="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors cursor-pointer"
                    on:click={() => expandedGdeltId = expanded ? null : event.globaleventid}
                  >
                    <td class="px-3 py-1.5 text-slate-400 font-mono whitespace-nowrap">{formatGdeltDate(event.sqldate)}</td>
                    <td class="px-3 py-1.5 text-slate-300">
                      {#if event.actor1name}<!-- svelte-ignore a11y-click-events-have-key-events --><span class="font-medium cursor-pointer hover:text-indigo-300 transition-colors" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor1name, label: event.actor1name })} role="button" tabindex="0">{event.actor1name}</span>{:else}<span>-</span>{/if}
                      {#if event.actor2name}
                        <span class="text-slate-600 mx-1">&rarr;</span>
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <span class="text-slate-400 cursor-pointer hover:text-indigo-300 transition-colors" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor2name, label: event.actor2name })} role="button" tabindex="0">{event.actor2name}</span>
                      {/if}
                    </td>
                    <td class="px-3 py-1.5 text-center">
                      <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold {goldsteinColor(event.goldsteinscale)}">
                        {event.goldsteinscale > 0 ? '+' : ''}{event.goldsteinscale.toFixed(1)}
                      </span>
                    </td>
                    <td class="px-3 py-1.5">
                      <div class="flex items-center gap-1.5">
                        <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div class="h-full rounded-full {event.avgtone >= 0 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}" style="width: {toneBarWidth(event.avgtone)}%"></div>
                        </div>
                        <span class="text-[10px] font-mono text-slate-500">{event.avgtone.toFixed(1)}</span>
                      </div>
                    </td>
                    <td class="px-3 py-1.5 truncate max-w-[200px]" title={event.actiongeo_fullname}>
                      {#if event.actiongeo_fullname}<!-- svelte-ignore a11y-click-events-have-key-events --><span class="text-slate-500 cursor-pointer hover:text-indigo-300 transition-colors" on:click|stopPropagation={() => setCrossFilter({ dimension: 'location', value: event.actiongeo_fullname, label: event.actiongeo_fullname })} role="button" tabindex="0">{event.actiongeo_fullname}</span>{:else}<span class="text-slate-600">-</span>{/if}
                    </td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-500">{event.numarticles || '-'}</td>
                  </tr>
                  {#if expanded}
                    <tr class="bg-slate-800/20">
                      <td colspan="6" class="px-4 py-3">
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Event Type</span>
                            <span class="text-slate-300 font-mono">{event.eventcode || '-'}</span>
                            {#if event.quadclass}
                              <span class="ml-1.5 text-[9px] px-1 py-0 rounded {event.quadclass == 1 ? 'bg-emerald-500/15 text-emerald-400' : event.quadclass == 2 ? 'bg-sky-500/15 text-sky-400' : event.quadclass == 3 ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}">
                                {event.quadclass == 1 ? 'Verbal Coop' : event.quadclass == 2 ? 'Material Coop' : event.quadclass == 3 ? 'Verbal Conflict' : 'Material Conflict'}
                              </span>
                            {/if}
                          </div>
                          <div>
                            <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Coverage</span>
                            <span class="text-slate-300">{event.nummentions ?? 0} mentions &middot; {event.numsources ?? 0} sources &middot; {event.numarticles ?? 0} articles</span>
                          </div>
                          <div>
                            <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Location</span>
                            {#if event.actiongeo_fullname}
                              <!-- svelte-ignore a11y-click-events-have-key-events -->
                              <span class="text-slate-300 cursor-pointer hover:text-indigo-300 transition-colors {activeCrossFilter?.dimension === 'location' && activeCrossFilter?.value === event.actiongeo_fullname ? 'text-indigo-300 underline' : ''}" on:click|stopPropagation={() => setCrossFilter({ dimension: 'location', value: event.actiongeo_fullname, label: event.actiongeo_fullname })} role="button" tabindex="0">{event.actiongeo_fullname}</span>
                            {:else}
                              <span class="text-slate-500">Unknown</span>
                            {/if}
                            {#if event.actiongeo_lat && event.actiongeo_long}
                              <span class="text-[11px] font-mono text-slate-600 ml-1">({Number(event.actiongeo_lat).toFixed(2)}, {Number(event.actiongeo_long).toFixed(2)})</span>
                            {/if}
                          </div>
                          <div>
                            <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Actors</span>
                            <div class="text-slate-300">
                              {#if event.actor1name}<!-- svelte-ignore a11y-click-events-have-key-events --><span class="font-medium cursor-pointer hover:text-indigo-300 transition-colors {activeCrossFilter?.dimension === 'actor' && activeCrossFilter?.value === event.actor1name ? 'text-indigo-300 underline' : ''}" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor1name, label: event.actor1name })} role="button" tabindex="0">{event.actor1name}</span>{#if event.actor1countrycode}<span class="text-[9px] text-slate-500 ml-1">({event.actor1countrycode})</span>{/if}{/if}
                              {#if event.actor2name}<span class="text-slate-600 mx-1">&rarr;</span><!-- svelte-ignore a11y-click-events-have-key-events --><span class="cursor-pointer hover:text-indigo-300 transition-colors {activeCrossFilter?.dimension === 'actor' && activeCrossFilter?.value === event.actor2name ? 'text-indigo-300 underline' : ''}" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor2name, label: event.actor2name })} role="button" tabindex="0">{event.actor2name}</span>{#if event.actor2countrycode}<span class="text-[9px] text-slate-500 ml-1">({event.actor2countrycode})</span>{/if}{/if}
                            </div>
                          </div>
                        </div>
                        {#if event.sourceurl}
                          <div class="mt-2 pt-2 border-t border-slate-700/30">
                            <a href={event.sourceurl} target="_blank" rel="noopener noreferrer" class="text-[10px] text-indigo-400 hover:text-indigo-300 truncate block max-w-full">
                              {event.sourceurl}
                            </a>
                          </div>
                        {/if}
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        </div>
      {/if}

      <!-- Radio Tab -->
      {#if activeTab === 'radio'}
        <div role="tabpanel" id="panel-radio" aria-labelledby="tab-radio" class="h-full">
        {#if radioLoading}
          <div class="flex items-center justify-center h-full"><svg class="animate-spin h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
        {:else if crossFilteredRadio.length === 0}
          <div class="flex items-center justify-center h-full text-slate-500 text-sm">No radio transcripts found</div>
        {:else}
          <div class="h-full overflow-y-auto">
            <div class="divide-y divide-slate-800/50">
              {#each crossFilteredRadio as segment}
                <div
                  class="px-4 py-2.5 hover:bg-slate-800/30 transition-colors cursor-pointer"
                  on:click={() => expandedTranscriptId = expandedTranscriptId === segment.id ? null : segment.id}
                  on:keydown={(e) => { if (e.key === 'Enter') expandedTranscriptId = expandedTranscriptId === segment.id ? null : segment.id; }}
                  role="button"
                  tabindex="0"
                >
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <span class="w-2 h-2 rounded-full cursor-pointer hover:ring-2 hover:ring-indigo-400/40 {sentimentDotColor(segment.sentiment)}" on:click|stopPropagation={() => { if (segment.sentiment) setCrossFilter({ dimension: 'sentiment', value: segment.sentiment.toLowerCase(), label: segment.sentiment }); }} role="button" tabindex="0"></span>
                      <span class="text-xs font-semibold text-slate-200">{segment.radio_name}</span>
                      {#if segment.state}
                        <span class="text-[10px] text-slate-500">{segment.state}</span>
                      {/if}
                      {#if segment.is_political}
                        <span class="px-1 py-0 text-[8px] uppercase tracking-wider bg-rose-500/20 text-rose-400 rounded font-medium">Political</span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      {#if segment.emotion}
                        <span class="text-[10px] px-1.5 py-0 bg-slate-800 text-slate-400 rounded">{segment.emotion}</span>
                      {/if}
                      {#if segment.confidence}
                        <span class="text-[10px] font-mono text-slate-500">{(segment.confidence * 100).toFixed(0)}%</span>
                      {/if}
                      <span class="text-[10px] font-mono text-slate-600">{Math.floor(segment.duration_seconds / 60)}m{(segment.duration_seconds % 60).toString().padStart(2, '0')}s</span>
                      <svg class="w-3 h-3 text-slate-600 transition-transform {expandedTranscriptId === segment.id ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {#if expandedTranscriptId === segment.id}
                    <div class="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/30">
                        <span class="text-[10px] font-semibold text-slate-300">Full Transcript</span>
                        <span class="text-[9px] text-slate-500">{segment.transcript.length} characters</span>
                      </div>
                      <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{@html highlightKeywords(segment.transcript, keywords)}</p>
                    </div>
                  {:else}
                    <p class="text-xs text-slate-400 leading-snug line-clamp-2">{segment.transcript}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        </div>
      {/if}

      <!-- Social Tab -->
      {#if activeTab === 'social'}
        <div role="tabpanel" id="panel-social" aria-labelledby="tab-social" class="h-full">
        {#if socialLoading}
          <div class="flex items-center justify-center h-full"><svg class="animate-spin h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
        {:else if crossFilteredSocial.length === 0}
          <div class="flex items-center justify-center h-full text-slate-500 text-sm">No social posts found</div>
        {:else}
          <div class="h-full overflow-y-auto">
            <p class="px-3 py-1.5 text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
              Keywords match anywhere in a word, so “bus” also finds “business”.
              {#if tabCounts.social >= 200}<span class="text-amber-300">Showing the first 200 matches; narrow the keywords or dates to see others.</span>{/if}
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-800/30 p-1">
              {#each crossFilteredSocial as post}
                {@const isExpanded = expandedSocialId === post.id}
                {@const likes = Number(post.engagement_likes || 0)}
                {@const shares = Number(post.engagement_shares || 0)}
                {@const comments = Number(post.engagement_comments || 0)}
                {@const totalEng = likes + shares + comments}
                <div
                  class="bg-slate-900 p-3 hover:bg-slate-800/50 transition-colors cursor-pointer {isExpanded ? 'col-span-1 md:col-span-2 xl:col-span-3 bg-slate-800/50' : ''}"
                  on:click={() => expandedSocialId = isExpanded ? null : post.id}
                  on:keydown={(e) => { if (e.key === 'Enter') expandedSocialId = isExpanded ? null : post.id; }}
                  role="button"
                  tabindex="0"
                >
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full {sentimentDotColor(post.sentiment_category)}"></span>
                      {#if post.platform}
                        <span class="text-[10px] font-medium text-sky-400">{post.platform}</span>
                      {/if}
                      {#if post.sentiment_category}
                        {@const sentNorm = (post.sentiment_category || '').toLowerCase().includes('positive') ? 'positive' : (post.sentiment_category || '').toLowerCase().includes('negative') ? 'negative' : 'neutral'}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <span
                          class="text-[9px] px-1 py-0 rounded cursor-pointer transition-all hover:ring-1 hover:ring-indigo-400/40 {sentNorm === 'positive' ? 'bg-sentiment-positive/20 text-sentiment-positive' : sentNorm === 'negative' ? 'bg-sentiment-negative/20 text-sentiment-negative' : 'bg-slate-700/50 text-slate-400'}"
                          on:click|stopPropagation={() => setCrossFilter({ dimension: 'sentiment', value: sentNorm, label: post.sentiment_category || sentNorm })}
                          role="button"
                          tabindex="0"
                        >{post.sentiment_category}</span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <!-- Inline engagement -->
                      {#if totalEng > 0}
                        <div class="flex items-center gap-1.5 text-[9px] text-slate-600">
                          {#if likes > 0}<span title="Likes">❤ {likes.toLocaleString()}</span>{/if}
                          {#if shares > 0}<span title="Shares">↗ {shares.toLocaleString()}</span>{/if}
                          {#if comments > 0}<span title="Comments">💬 {comments.toLocaleString()}</span>{/if}
                        </div>
                      {/if}
                      {#if post.confidence_score}
                        <span class="text-[11px] font-mono text-slate-600">{(post.confidence_score * 100).toFixed(0)}%</span>
                      {/if}
                      {#if post.timestamp}
                        <span class="text-[11px] font-mono text-slate-600">{formatPostDate(post.timestamp)}</span>
                      {/if}
                    </div>
                  </div>

                  {#if isExpanded}
                    <!-- Expanded view -->
                    <p class="text-sm text-slate-200 leading-relaxed mb-3 whitespace-pre-wrap">{post.text}</p>
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-700/30">
                      <div>
                        <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Engagement</span>
                        <div class="flex items-center gap-3 text-xs">
                          <span class="text-rose-400">❤ {likes.toLocaleString()}</span>
                          <span class="text-sky-400">↗ {shares.toLocaleString()}</span>
                          <span class="text-amber-400">💬 {comments.toLocaleString()}</span>
                        </div>
                      </div>
                      <div>
                        <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Sentiment</span>
                        <span class="text-xs text-slate-300">{post.sentiment_category || 'Unknown'}</span>
                        {#if post.confidence_score}
                          <span class="text-[9px] text-slate-500 ml-1">({(post.confidence_score * 100).toFixed(0)}% confidence)</span>
                        {/if}
                      </div>
                      {#if post.emotions}
                        <div>
                          <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Emotions</span>
                          <span class="text-xs text-slate-300">{post.emotions}</span>
                        </div>
                      {/if}
                      <div>
                        <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Platform</span>
                        <span class="text-xs text-sky-400">{post.platform || 'Unknown'}</span>
                        {#if post.timestamp}
                          <span class="text-[9px] text-slate-500 ml-1">{formatPostDate(post.timestamp)}</span>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <p class="text-xs text-slate-300 leading-snug line-clamp-3">{post.text}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        </div>
      {/if}

      <!-- Visualizations Tab — Analytical Portals -->
      {#if activeTab === 'visualizations'}
        <div role="tabpanel" id="panel-visualizations" aria-labelledby="tab-visualizations" class="h-full">
        <div class="h-full overflow-y-auto p-3">
          <!-- Portal toolbar -->
          <div class="flex items-center gap-1.5 mb-3">
            <span class="text-[9px] uppercase tracking-wider text-slate-600 font-semibold mr-1">Portals</span>
            {#each allPortals as portal}
              <button
                on:click={() => togglePortal(portal.id)}
                class="px-2 py-0.5 text-[9px] rounded-full transition-colors {portalLayout.visible.includes(portal.id)
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-600 border border-slate-700/30 hover:text-slate-400 hover:border-slate-600'}"
              >
                {portal.label}
              </button>
            {/each}

            <!-- Active cross-filter pill -->
            {#if activeCrossFilter}
              <div class="ml-2 flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded-full">
                <span class="text-[9px] text-indigo-400/70 uppercase tracking-wider">{activeCrossFilter.dimension}</span>
                <span class="text-[10px] text-indigo-300 font-medium max-w-[120px] truncate">{activeCrossFilter.label || activeCrossFilter.value}</span>
                <button
                  on:click={() => clearCrossFilter()}
                  class="text-indigo-400/50 hover:text-indigo-300 transition-colors ml-0.5"
                  title="Clear filter"
                  aria-label="Clear filter"
                >
                  <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </div>
            {/if}

            <div class="flex-1"></div>
            <button on:click={handleResetGrid}
              class="px-2 py-0.5 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
              title="Reset layout"
            >Reset</button>
          </div>

          <!-- Portal grid — drag headers to reorder, drag corners to resize -->
          <div class="grid grid-cols-12 gap-3 auto-rows-[140px]">
            {#each visiblePortals as portalId (portalId)}
              {@const item = gridItems.find(g => g.id === portalId) || { id: portalId, w: 6, h: 2, x: 0, y: 0 }}
              <div
                data-portal-cell
                class="relative transition-all duration-150 {dragTarget === portalId ? 'ring-2 ring-indigo-500/50' : ''} {resizingPortal === portalId ? 'ring-1 ring-indigo-400/30' : ''}"
                style="grid-column: span {Math.min(12, item.w)}; grid-row: span {item.h};"
                draggable="true"
                on:dragstart={() => handleDragStart(portalId)}
                on:dragover={(e) => handleDragOver(portalId, e)}
                on:dragleave={() => { if (dragTarget === portalId) dragTarget = null; }}
                on:drop={() => handleDrop(portalId)}
                on:dragend={() => { dragSource = null; dragTarget = null; }}
                role="listitem"
              >
                <!-- Corner resize handle (bottom-right) -->
                <div
                  class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 opacity-0 hover:opacity-100 transition-opacity"
                  on:mousedown={(e) => startResize(portalId, e)}
                  role="separator"
                  aria-orientation="horizontal"
                >
                  <svg class="w-4 h-4 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="12" cy="12" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="12" cy="8" r="1.5" />
                  </svg>
                </div>

                {#if portalId === 'sentiment'}
                  <SentimentPortal
                    timelineData={filteredTimelineData}
                    gdeltEvents={crossFilteredGdelt}
                    radioSegments={crossFilteredRadio}
                    socialPosts={crossFilteredSocial}
                    height={portalHeight(item)}
                    crossFilter={activeCrossFilter}
                    on:crossfilter={handleCrossFilter}
                  />
                {:else if portalId === 'volume'}
                  <VolumePortal
                    timelineData={filteredTimelineData}
                    gdeltEvents={crossFilteredGdelt}
                    height={portalHeight(item)}
                    crossFilter={activeCrossFilter}
                    on:crossfilter={handleCrossFilter}
                  />
                {:else if portalId === 'correlation'}
                  <CorrelationPortal
                    timelineData={filteredTimelineData}
                    gdeltEvents={crossFilteredGdelt}
                    gdeltTotal={gdeltEvents.length}
                    {gdeltLoading}
                    height={portalHeight(item)}
                    crossFilter={activeCrossFilter}
                    on:crossfilter={handleCrossFilter}
                  />
                {:else if portalId === 'topics'}
                  <TopicsPortal
                    {keywordData}
                    gdeltEvents={crossFilteredGdelt}
                    height={portalHeight(item)}
                    crossFilter={activeCrossFilter}
                    on:crossfilter={handleCrossFilter}
                  />
                {:else if portalId === 'geography'}
                  <GeographyPortal
                    {keywords}
                    {dateStart}
                    {dateEnd}
                    gdeltEvents={crossFilteredGdelt}
                    height={portalHeight(item)}
                    crossFilter={activeCrossFilter}
                    on:crossfilter={handleCrossFilter}
                  />
                {:else if portalId === 'actors'}
                  <ActorsPortal
                    {keywords}
                    {dateStart}
                    {dateEnd}
                    gdeltEvents={crossFilteredGdelt}
                    height={portalHeight(item)}
                    crossFilter={activeCrossFilter}
                    on:crossfilter={handleCrossFilter}
                  />
                {/if}
              </div>
            {/each}
          </div>
        </div>
        </div>
      {/if}

    </div>

  </div>
{:else}
  <div class="flex items-center justify-center h-screen bg-slate-950">
    <div class="text-center">
      <h2 class="text-sm font-semibold text-slate-300 mb-1">Investigation not found</h2>
      <p class="text-xs text-slate-500 mb-4">This investigation doesn't exist or has been deleted.</p>
      <button on:click={() => goto('/investigations')} class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors">Back to Investigations</button>
    </div>
  </div>
{/if}
