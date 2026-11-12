<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import {
    getDataAvailabilityIcon,
    getDataAvailabilityTooltip,
    hasRequiredData,
    type DataFlags,
    type NavItem,
    type NavWorkspace
  } from './navItems';

  export let items: NavItem[];
  export let openDropdowns: Record<string, boolean>;
  export let currentWorkspace: NavWorkspace | null;
  export let dataFlags: DataFlags;

  const dispatch = createEventDispatcher();
</script>

<!-- Desktop Nav Links -->
<div class="hidden xl:flex xl:items-center xl:space-x-1 border-l border-ink-200 pl-4">
  {#each items as item, ni}
    {#if item.hasDropdown}
      <div class="relative nav-dropdown">
        <button
          on:click={() => dispatch('toggle', item.name)}
          aria-expanded={openDropdowns[item.name] || false}
          aria-haspopup="true"
          class="flex items-center px-2.5 py-2 rounded-lg text-sm font-medium transition-colors {item.current
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
        >
          {item.name}
          <svg class="ml-1 w-3.5 h-3.5 transition-transform {openDropdowns[item.name] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        {#if openDropdowns[item.name]}
          <div class="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {#each (item.dropdownItems ?? []) as dropdownItem, di}
              <a
                href={dropdownItem.href}
                on:click={(e) => dispatch('navigate', { item: dropdownItem, event: e })}
                class="block px-4 py-2.5 text-sm transition-colors {
                  (dropdownItem.requiresProject && !$currentProject) ||
                  (dropdownItem?.requiresWorkspace && !currentWorkspace) ||
                  (dropdownItem?.requiresDataType && !hasRequiredData(dropdownItem, currentWorkspace, dataFlags))
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }"
                title={getDataAvailabilityTooltip(dropdownItem, currentWorkspace, dataFlags)}
              >
                <div class="flex items-center justify-between">
                  <span>{dropdownItem.name}</span>
                  {#if dropdownItem?.requiresDataType && currentWorkspace}
                    <span class="text-xs {hasRequiredData(dropdownItem, currentWorkspace, dataFlags) ? 'text-emerald-500' : 'text-signal-700'}">
                      {getDataAvailabilityIcon(dropdownItem, currentWorkspace, dataFlags)}
                    </span>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <a
        href={item.href}
        on:click={(e) => dispatch('navigate', { item, event: e })}
        class="px-2.5 py-2 rounded-lg text-sm font-medium transition-colors {item.current
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
        aria-current={item.current ? 'page' : undefined}
      >
        {item.name}
      </a>
    {/if}
  {/each}
</div>
