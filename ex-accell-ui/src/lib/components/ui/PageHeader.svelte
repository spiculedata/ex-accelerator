<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentProject } from '$lib/stores/projectStore';

  export let title: string;
  export let subtitle: string = '';
  export let accentColor: string = 'blue';
  export let backHref: string = '';
  export let showProject: boolean = true;

  const colorMap: Record<string, string> = {
    blue: 'from-slate-900 via-blue-900 to-slate-900',
    emerald: 'from-slate-900 via-emerald-900 to-slate-900',
    indigo: 'from-slate-900 via-indigo-900 to-slate-900',
    amber: 'from-slate-900 via-amber-900 to-slate-900',
    cyan: 'from-slate-900 via-cyan-900 to-slate-900',
    pink: 'from-slate-900 via-pink-900 to-slate-900',
    teal: 'from-slate-900 via-teal-900 to-slate-900',
    purple: 'from-slate-900 via-purple-900 to-slate-900',
    red: 'from-slate-900 via-red-900 to-slate-900',
  };

  $: gradientClass = colorMap[accentColor] || colorMap.blue;
</script>

<div class="relative bg-gradient-to-br {gradientClass} overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-{accentColor}-900/10 to-slate-900/10 opacity-40"></div>

  <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        {#if backHref}
          <button
            on:click={() => goto(backHref)}
            class="mr-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm"
            aria-label="Go back">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
        {/if}

        <slot name="icon">
          <div class="w-16 h-16 bg-gradient-to-br from-{accentColor}-400 to-{accentColor}-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
        </slot>

        <div>
          <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">{title}</h1>
          {#if subtitle}
            <p class="text-slate-300 text-lg font-medium">{subtitle}</p>
          {/if}
          {#if showProject && $currentProject}
            <div class="flex items-center mt-3">
              <span class="text-sm text-slate-400">Project:</span>
              <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                {$currentProject.name}
              </span>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</div>
