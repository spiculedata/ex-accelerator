<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import MobileUserPanel from './MobileUserPanel.svelte';
  import {
    getDataAvailabilityIcon,
    getDataAvailabilityTooltip,
    hasRequiredData,
    type DataFlags,
    type NavItem,
    type NavUser,
    type NavWorkspace
  } from './navItems';

  export let items: NavItem[];
  export let openDropdowns: Record<string, boolean>;
  export let currentWorkspace: NavWorkspace | null;
  export let dataFlags: DataFlags;
  export let user: NavUser | null | undefined;

  const dispatch = createEventDispatcher();
</script>

<!-- Mobile menu -->
<div class="xl:hidden border-t border-ink-200 bg-white mobile-menu">
  <div class="px-2 pt-2 pb-3 space-y-1">
    {#each items as item, ni}
      {#if item.hasDropdown}
        <!-- Mobile dropdown navigation item -->
        <div class="space-y-1">
          <button
            on:click={() => dispatch('toggle', item.name)}
            class="w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {item.requiresProject && !$currentProject 
              ? 'text-gray-500 opacity-60 hover:text-gray-500 cursor-not-allowed' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
          >
            <span>
              {item.name}
              {#if item.requiresProject && !$currentProject}
                <span class="ml-1 text-xs text-gray-500">*</span>
              {/if}
            </span>
            <svg class="w-4 h-4 transition-transform {openDropdowns[item.name] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          {#if openDropdowns[item.name]}
            <div class="pl-6 space-y-1">
              {#each (item.dropdownItems ?? []) as dropdownItem, di}
                <a
                  href={dropdownItem.href}
                  on:click={(e) => dispatch('navigate', { item: dropdownItem, event: e, collapse: true })}
                  class="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {
                    (dropdownItem.requiresProject && !$currentProject) ||
                    (dropdownItem?.requiresWorkspace && !currentWorkspace) ||
                    (dropdownItem?.requiresDataType && !hasRequiredData(dropdownItem, currentWorkspace, dataFlags))
                    ? 'text-gray-500 opacity-60 hover:text-gray-500 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
                  title={getDataAvailabilityTooltip(dropdownItem, currentWorkspace, dataFlags)}
                >
                  <span>{dropdownItem.name}</span>
                  <div class="flex items-center space-x-1">
                    {#if dropdownItem?.requiresDataType && currentWorkspace}
                      <span class="text-xs {hasRequiredData(dropdownItem, currentWorkspace, dataFlags) ? 'text-emerald-600' : 'text-signal-700'}">
                        {getDataAvailabilityIcon(dropdownItem, currentWorkspace, dataFlags)}
                      </span>
                    {/if}
                    {#if dropdownItem?.requiresWorkspace && !currentWorkspace}
                      <span class="text-xs text-signal-700">↻</span>
                    {:else if dropdownItem.requiresProject && !$currentProject}
                      <span class="text-xs text-gray-500">*</span>
                    {/if}
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Regular mobile navigation item -->
        <a
          href={item.href}
          on:click={(e) => dispatch('navigate', { item, event: e, collapse: false })}
          class="flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {item.current
            ? 'bg-blue-100 text-blue-700'
            : (item.requiresProject && !$currentProject) || (item?.requiresDataType && !hasRequiredData(item, currentWorkspace, dataFlags))
              ? 'text-gray-500 opacity-60 hover:text-gray-500 cursor-not-allowed'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
          title={getDataAvailabilityTooltip(item, currentWorkspace, dataFlags)}
          aria-current={item.current ? 'page' : undefined}
        >
          <span>{item.name}</span>
          <div class="flex items-center space-x-1">
            {#if item?.requiresDataType && currentWorkspace}
              <span class="text-xs {hasRequiredData(item, currentWorkspace, dataFlags) ? 'text-emerald-600' : 'text-signal-700'}">
                {getDataAvailabilityIcon(item, currentWorkspace, dataFlags)}
              </span>
            {:else if item.requiresProject && !$currentProject}
              <span class="text-xs text-gray-500">*</span>
            {/if}
          </div>
        </a>
      {/if}
    {/each}
    
    <!-- Project requirement notice (mobile) -->
    {#if !$currentProject}
      <div class="px-3 py-1 text-xs text-gray-500">
        * Requires project selection
      </div>
    {/if}
    
    <MobileUserPanel {user} />
  </div>
</div>
