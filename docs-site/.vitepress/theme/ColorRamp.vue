<script setup lang="ts">
import palette from './palette.json';

const props = defineProps<{ name: 'ink' | 'primary' | 'signal' | 'success' | 'danger'; note?: string }>();
const ramp = (palette as Record<string, Record<string, string>>)[props.name];
// Choose a readable label colour for each chip from its steps: dark text on light steps, white on dark ones
const light = new Set(['50', '100', '200', '300', '400']);
</script>

<template>
  <div class="ramp">
    <div class="ramp-head"><b>{{ name }}</b><span v-if="note">{{ note }}</span></div>
    <div class="chips">
      <div v-for="(hex, step) in ramp" :key="step" class="chip" :style="{ background: `var(--se-${name}-${step})`, color: light.has(String(step)) ? '#0f1926' : '#ffffff' }">
        <span class="step">{{ step }}</span>
        <span class="hex">{{ hex }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ramp { margin: 20px 0; }
.ramp-head { display: flex; gap: 12px; align-items: baseline; margin-bottom: 8px; font-size: 14px; }
.ramp-head span { color: var(--vp-c-text-2); }
.chips { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 1px var(--vp-c-divider); }
.chip { display: flex; flex-direction: column; justify-content: flex-end; min-height: 76px; padding: 6px 6px 7px; font-size: 11px; line-height: 1.25; }
.step { font-weight: 700; }
.hex { font-family: var(--se-font-mono); font-size: 10px; opacity: 0.9; }
@media (max-width: 720px) { .chips { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
</style>
