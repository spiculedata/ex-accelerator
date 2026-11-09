<script lang="ts">
  /**
   * A short "use responsibly" note for tools that look at people or classify images. Say what the tool does,
   * what it cannot do, and who is responsible for the outcome. Shown on every view of those tools.
   */
  export let tool: 'face detection' | 'content moderation';

  const points: Record<string, string[]> = {
    'face detection': [
      'It counts faces in an image. It does not identify who anyone is.',
      'Detection makes mistakes, and it can be less accurate for some groups of people than others. Treat counts as an estimate.',
      'You are responsible for having a lawful and ethical reason to analyse an image, including consent where it applies.'
    ],
    'content moderation': [
      'Labels come from an automated classifier. It makes mistakes in both directions, and it can be biased across groups, languages and cultures.',
      'Use a flag as a prompt for human review, not as a decision about an image or a person.',
      'Flagged images are blurred by default. You are responsible for handling them lawfully and with care.'
    ]
  };
</script>

<aside class="mb-6 rounded-xl border border-ink-200 bg-ink-50 px-5 py-4" aria-label="Use {tool} responsibly">
  <h2 class="text-sm font-semibold text-ink-900">Use {tool} responsibly</h2>
  <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
    {#each points[tool] as point}
      <li>{point}</li>
    {/each}
  </ul>
</aside>
