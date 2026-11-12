<script lang="ts">
  import { resolveInvestigationRange } from '$lib/utils/investigationRange';
  import { isPostNoted, noteFromPost, notesToMarkdown, parseAnnotations, type Annotation } from '$lib/utils/annotations';
  import { createSingleFlight } from '$lib/utils/singleFlight';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { investigationSelection, clearSelection, setTimeRange } from '$lib/stores/investigationStore';
  import WorkbenchToolbar from '$lib/components/investigation/WorkbenchToolbar.svelte';
  import NotesBar from '$lib/components/investigation/NotesBar.svelte';
  import WorkbenchTimeline from '$lib/components/investigation/WorkbenchTimeline.svelte';
  import SourceTabs from '$lib/components/investigation/SourceTabs.svelte';
  import GdeltEventTable from '$lib/components/investigation/GdeltEventTable.svelte';
  import RadioSegmentList from '$lib/components/investigation/RadioSegmentList.svelte';
  import SocialPostList from '$lib/components/investigation/SocialPostList.svelte';
  import PortalsPanel from '$lib/components/investigation/PortalsPanel.svelte';
  import type { TimelineEntry } from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import { buildInvestigationReport, buildPostsCsv, downloadFile, exportFileName } from '$lib/utils/investigationExport';
  import {
    filterGdeltByCrossFilter,
    filterRadioByCrossFilter,
    filterSocialByCrossFilter,
    filterTimelineToRange
  } from '$lib/utils/investigationFilters';
  import { buildInvestigationQuery, normalizeTimeline } from '$lib/utils/investigationQuery';
  import { saveInvestigation } from '$lib/utils/investigationSave';
  import type { GdeltEvent, InvestigationRecord, RadioSegment, SourceTab, WorkbenchPost } from '$lib/utils/investigationTypes';

  export const ssr = false;

  const GDELT_LIMIT = 200;
  const RADIO_LIMIT = 100;
  const SOCIAL_LIMIT = 200;
  const SAVED_NOTICE_MS = 2000;

  let investigation: InvestigationRecord | null = null;
  let loading = true;
  let timelineData: TimelineEntry[] = [];
  let timelineLoading = true;
  let gdeltEvents: GdeltEvent[] = [];
  let radioSegments: RadioSegment[] = [];
  let socialPosts: WorkbenchPost[] = [];
  let keywordData: any[] = [];
  let gdeltLoading = true;
  let radioLoading = true;
  let socialLoading = true;

  // Tabs
  let activeTab: SourceTab = 'gdelt';

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
  $: filteredTimelineData = filterTimelineToRange(timelineData, $investigationSelection.timeRange, dateStart, dateEnd);

  // Cross-filter: active filter from portal clicks, applied to the detail records
  $: activeCrossFilter = $investigationSelection.crossFilter;
  $: crossFilteredGdelt = filterGdeltByCrossFilter(gdeltEvents, activeCrossFilter);
  $: crossFilteredRadio = filterRadioByCrossFilter(radioSegments, activeCrossFilter);
  $: crossFilteredSocial = filterSocialByCrossFilter(socialPosts, activeCrossFilter);

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
      const response = await fetch(buildInvestigationQuery('investigation-timeline', kw, ds, de));
      const result = await response.json();
      if (result.success) timelineData = normalizeTimeline(result.data || result.timeline || []);
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
      const response = await fetch(buildInvestigationQuery('investigation-gdelt-events', kw, ds, de, GDELT_LIMIT));
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
      const response = await fetch(buildInvestigationQuery('investigation-radio-segments', kw, ds, de, RADIO_LIMIT));
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
      const response = await fetch(buildInvestigationQuery('investigation-social-posts', kw, ds, de, SOCIAL_LIMIT));
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
      const response = await fetch(buildInvestigationQuery('investigation-keyword-overlap', kw, ds, de));
      const result = await response.json();
      if (result.success) keywordData = result.data || [];
    } catch (error) {
      console.error('Error loading keyword data:', error);
    }
  }

  function narrowTo(start: string, end: string) {
    setTimeRange(start, end);
    loadDetailPanels(keywords, start, end);
    loadKeywordData(keywords, start, end);
  }

  function handleBrushChange(event: CustomEvent<{ start: Date; end: Date }>) {
    const { start, end } = event.detail;
    narrowTo(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  }

  function handleDayClick(event: CustomEvent<{ date: string }>) {
    const { date } = event.detail;
    narrowTo(date, date);
  }

  function resetBrush() {
    if (dateStart && dateEnd) narrowTo(dateStart, dateEnd);
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

  // Quotes a post into the notes with its citation; a post already cited there is not added twice
  function addPostToNotes(post: WorkbenchPost) {
    if (isPostNoted(annotations, post)) return;
    annotations = [...annotations, noteFromPost(post, crypto.randomUUID(), new Date().toISOString())];
    showAnnotations = true;
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
    const outcome = await saveInvestigation({
      id: investigationId,
      annotations: toSave,
      queryConfig: includeConfig ? { base: investigation?.query_config, keywords, dateStart, dateEnd } : undefined
    });
    if (outcome.ok) {
      savedSnapshot = JSON.stringify(toSave);
      saveStatus = 'saved';
      setTimeout(() => { if (saveStatus === 'saved') saveStatus = ''; }, SAVED_NOTICE_MS);
      return;
    }
    console.error('Error saving investigation:', outcome.error);
    saveErrorMessage = outcome.message;
    saveStatus = 'error';
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

  function handleExport() {
    const report = buildInvestigationReport({
      name: investigation?.name,
      keywords,
      dateStart,
      dateEnd,
      annotations,
      gdeltEvents,
      radioSegments,
      socialPosts,
      timelineDays: timelineData.length
    });
    downloadFile(JSON.stringify(report, null, 2), 'application/json', exportFileName(investigation?.name, 'json'));
  }

  function handleExportNotes() {
    downloadFile(notesToMarkdown(investigation?.name ?? 'Investigation', annotations), 'text/markdown', exportFileName(investigation?.name, 'md'));
  }

  function handleExportCsv() {
    downloadFile(buildPostsCsv(socialPosts), 'text/csv;charset=utf-8', exportFileName(investigation?.name, 'csv'));
  }

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

    <WorkbenchToolbar
      name={investigation.name}
      {keywords}
      {dateStart}
      {dateEnd}
      timeRange={$investigationSelection.timeRange}
      bind:showAnnotations
      annotationCount={annotations.length}
      {saveStatus}
      {saveErrorMessage}
      {unsaved}
      on:resetBrush={resetBrush}
      on:exportCsv={handleExportCsv}
      on:exportJson={handleExport}
      on:save={handleSave}
    />

    {#if showAnnotations}
      <NotesBar
        {annotations}
        bind:newAnnotation
        {saveStatus}
        {saveErrorMessage}
        {unsaved}
        on:add={addAnnotation}
        on:remove={(e) => removeAnnotation(e.detail)}
        on:exportNotes={handleExportNotes}
      />
    {/if}

    <WorkbenchTimeline
      {timelineData}
      {timelineLoading}
      timeRange={$investigationSelection.timeRange}
      on:brushChange={handleBrushChange}
      on:dayClick={handleDayClick}
    />

    <SourceTabs bind:activeTab {activeCrossFilter} {tabCounts} />

    <!-- ============ TAB CONTENT ============ -->
    <div class="flex-1 min-h-0 overflow-hidden">
      {#if activeTab === 'gdelt'}
        <GdeltEventTable
          loading={gdeltLoading}
          events={crossFilteredGdelt}
          {activeCrossFilter}
          tabCount={tabCounts.gdelt}
          bind:expandedId={expandedGdeltId}
        />
      {/if}

      {#if activeTab === 'radio'}
        <RadioSegmentList
          loading={radioLoading}
          segments={crossFilteredRadio}
          {keywords}
          bind:expandedId={expandedTranscriptId}
        />
      {/if}

      {#if activeTab === 'social'}
        <SocialPostList
          loading={socialLoading}
          posts={crossFilteredSocial}
          {annotations}
          tabCount={tabCounts.social}
          bind:expandedId={expandedSocialId}
          on:addToNotes={(e) => addPostToNotes(e.detail)}
        />
      {/if}

      <!-- Visualizations Tab — Analytical Portals -->
      {#if activeTab === 'visualizations'}
        <PortalsPanel
          timelineData={filteredTimelineData}
          gdeltEvents={crossFilteredGdelt}
          radioSegments={crossFilteredRadio}
          socialPosts={crossFilteredSocial}
          gdeltTotal={gdeltEvents.length}
          {gdeltLoading}
          {keywordData}
          {keywords}
          {dateStart}
          {dateEnd}
          {activeCrossFilter}
        />
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
