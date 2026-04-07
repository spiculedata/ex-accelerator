<script lang="ts">
  export let selectedTier = 'fast';
  export let compact = false;
  export let disabled = false;

  const tiers = [
    {
      id: 'fast',
      label: 'Quick Scan',
      icon: '\u26A1',
      desc: 'YOLOv8n + Haar',
      speed: '<1s',
      bgActive: 'bg-emerald-50',
      borderActive: 'border-emerald-300',
      textActive: 'text-emerald-700',
    },
    {
      id: 'standard',
      label: 'Standard',
      icon: '\uD83C\uDFAF',
      desc: 'CLIP + YOLOv8s',
      speed: '2-5s',
      bgActive: 'bg-blue-50',
      borderActive: 'border-blue-300',
      textActive: 'text-blue-700',
    },
    {
      id: 'accurate',
      label: 'Deep Analysis',
      icon: '\uD83D\uDD2C',
      desc: 'Gemma Vision',
      speed: '30s+',
      bgActive: 'bg-purple-50',
      borderActive: 'border-purple-300',
      textActive: 'text-purple-700',
    },
  ];
</script>

<div class="flex gap-2">
  {#each tiers as tier}
    <button
      type="button"
      {disabled}
      class="px-3 py-2 rounded-lg text-sm border transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed
        {selectedTier === tier.id
          ? `${tier.bgActive} ${tier.borderActive} ${tier.textActive} shadow-sm`
          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}"
      on:click={() => { selectedTier = tier.id; }}
    >
      <span class="text-base">{tier.icon}</span>
      <span class="font-medium">{tier.label}</span>
      {#if !compact}
        <span class="text-xs opacity-60 ml-0.5">{tier.speed}</span>
      {/if}
    </button>
  {/each}
</div>
{#if !compact}
  <p class="text-xs text-gray-400 mt-1.5">
    {#if selectedTier === 'fast'}YOLOv8n object detection + Haar face detection + heuristic classification
    {:else if selectedTier === 'standard'}CLIP ViT-B/32 classification + YOLOv8s detection + CLIP NSFW moderation
    {:else}Full Gemma 4 multimodal vision analysis (requires GPU for acceptable speed)
    {/if}
  </p>
{/if}
