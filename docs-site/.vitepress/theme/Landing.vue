<script setup lang="ts">
import { computed, ref } from 'vue';
import { useData, withBase } from 'vitepress';

const { frontmatter } = useData();

const tabs = [
  { id: 'sentiment', label: 'Sentiment', src: '/screenshots/sentiment-analysis.png', alt: 'Sentiment analysis dashboard: positive, negative and neutral shares, emotion breakdown and trend over time' },
  { id: 'topics', label: 'Topics', src: '/screenshots/topic-modeling.png', alt: 'Topic modelling page with a topic network and a table of topics, weights and keywords' },
  { id: 'investigation', label: 'Investigation', src: '/screenshots/tutorials/investigation-workbench.png', alt: 'Investigation workbench with a timeline across GDELT, radio and social posts and a feed of matching posts' },
  { id: 'workflows', label: 'Workflows', src: '/screenshots/tutorials/workflow-connected.png', alt: 'Visual workflow builder connecting a dataset input to sentiment analysis' }
];
const active = ref(tabs[0].id);

// Images in tabs the visitor has not opened are lazy and hidden, so they would only start loading on click.
// Warm the cache when a tab is hovered, focused or pressed so the switch is instant.
const warmed = new Set<string>();
function warm(src: string) {
  if (typeof Image === 'undefined' || warmed.has(src)) return;
  warmed.add(src);
  new Image().src = withBase(src);
}

const tabRefs = ref<HTMLButtonElement[]>([]);
function selectTab(index: number, shouldFocus = false) {
  const position = (index + tabs.length) % tabs.length;
  active.value = tabs[position].id;
  warm(tabs[position].src);
  if (shouldFocus) tabRefs.value[position]?.focus();
}
function onTabKeydown(event: KeyboardEvent, index: number) {
  const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
  if (target === undefined) return;
  event.preventDefault();
  selectTab(target, true);
}

// The first three front matter features (Collect, Analyse, Investigate) are the steps, so the wiki Home and this page share one source
const steps = computed(() =>
  (frontmatter.value.features ?? []).slice(0, 3).map((f: { title: string; details: string }, i: number) => ({ n: String(i + 1), title: f.title, text: f.details }))
);

const features = [
  {
    kicker: 'Sentiment and emotion',
    title: 'Know how people feel, and when it turned',
    text: 'See the positive, negative and neutral split and the emotions behind it. Filter by source, then read the individual posts and the confidence behind each label.',
    points: ['Positive, negative and neutral share at a glance', 'Compare Telegram, YouTube and Bluesky', 'Read the posts behind the numbers, with a confidence score for each'],
    src: '/screenshots/sentiment-analysis.png',
    alt: 'Sentiment analysis dashboard'
  },
  {
    kicker: 'Topic modelling',
    title: 'Find the themes you did not search for',
    text: 'Topics are surfaced from the data itself, with their volume, weight and keywords, so you can see what a community is actually talking about before you decide what to dig into.',
    points: ['Topics ranked by number of posts', 'Keywords and weight for each topic', 'Network and treemap views'],
    src: '/screenshots/topic-modeling.png',
    alt: 'Topic modelling page'
  },
  {
    kicker: 'Investigations',
    title: 'Follow a story across social, news and radio',
    text: 'Name the keywords and the dates, and the workbench lines up matching social posts, GDELT news events and radio segments on one timeline, with the posts themselves underneath.',
    points: ['Social, GDELT and radio lanes on one timeline', 'Expand any post for engagement, sentiment and emotion', 'Export the evidence set as JSON'],
    src: '/screenshots/tutorials/investigation-workbench.png',
    alt: 'Investigation workbench'
  },
  {
    kicker: 'Notebooks and workflows',
    title: 'Go deeper in code when you need to',
    text: 'Open the built-in Jupyter notebooks against the same database as the dashboards, or sketch an analysis in the visual workflow builder, which is an early preview.',
    points: ['Starter notebooks for GDELT, sentiment and topics', 'Same database as the dashboards', 'Visual workflow builder (early preview)'],
    src: '/screenshots/tutorials/workflow-connected.png',
    alt: 'Workflow builder'
  },
  {
    kicker: 'Data sharing (optional)',
    title: 'Give a collaborator the exact dataset you published',
    text: 'Publish a dataset as an open Frictionless Data Package over the IPFS network and send one content ID. A collaborator, a reviewer or a replication package gets the same bytes you published, from any IPFS node or public gateway, with no account, while your node or someone who pinned it is online. The ID always resolves to the same bytes, so a paper can cite the exact version and any change gives a new ID. It is off by default, and what you publish is public for good, so it is for open data only.',
    points: ['A plain CSV (opens in Python, R or Excel) plus a datapackage.json schema', 'Import a colleague’s package by ID into a table you can query', 'Opt-in, admin-only, and never for personal data'],
    src: '/screenshots/data-sharing.png',
    alt: 'Data Sharing page with peer-to-peer sharing turned off, the default, no packages yet, and the catalogued datasets a package can be generated from'
  }
];

const more = [
  { title: 'Language detection', text: 'Which languages a conversation is happening in.', src: '/screenshots/language-detection.png' },
  { title: 'Engagement', text: 'What gets likes, shares and replies, and from whom.', src: '/screenshots/engagement-analysis.png' },
  { title: 'Hashtags', text: 'Which tags travel together and how they trend.', src: '/screenshots/hashtag-analysis.png' },
  { title: 'Phrases', text: 'The recurring three-word phrases behind a topic.', src: '/screenshots/trigram-analysis.png' }
];

const stack = [
  { name: 'PostgreSQL + pg_duckdb', note: 'One database, with a columnar engine for fast analytics' },
  { name: 'SvelteKit', note: 'A fast web app with roles: admin, user and viewer' },
  { name: 'Jupyter', note: 'Notebooks next to your data' },
  { name: 'Docker Compose', note: 'Self-host the whole stack' }
];

const demoCommands = 'git clone https://github.com/spiculedata/social-explorer.git\ncd social-explorer/ex-accell-ui\nnpm run demo';
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCommands() {
  try {
    await navigator.clipboard.writeText(demoCommands);
    copied.value = true;
    // Restart the timer on repeated clicks so an earlier one cannot reset the label early
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Clipboard access can be blocked; the commands are still selectable
  }
}
</script>

<template>
  <div class="landing">
    <!-- Hero -->
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="pill">Open source · Apache-2.0 · Self-hosted</p>
          <h1>{{ frontmatter.hero?.text }}</h1>
          <p class="lede">{{ frontmatter.hero?.tagline }}</p>
          <div class="actions">
            <a class="btn primary" href="#try">Try the demo</a>
            <a class="btn" :href="withBase('/guide/getting-started')">Read the docs</a>
            <a class="btn ghost" href="https://github.com/spiculedata/social-explorer">GitHub</a>
          </div>
          <p class="fine">No accounts or API keys. One command, about five minutes.</p>
        </div>

        <div class="showcase">
          <div class="frame">
            <div class="chrome" role="tablist" aria-label="Product views">
              <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <button
                v-for="(t, i) in tabs"
                :id="`tab-${t.id}`"
                :key="t.id"
                ref="tabRefs"
                type="button"
                role="tab"
                class="tab"
                :class="{ on: active === t.id }"
                :aria-selected="active === t.id"
                aria-controls="showcase-panel"
                :tabindex="active === t.id ? 0 : -1"
                @click="selectTab(i)"
                @keydown="onTabKeydown($event, i)"
                @mouseenter="warm(t.src)"
                @focus="warm(t.src)"
                @pointerdown="warm(t.src)"
              >{{ t.label }}</button>
            </div>
            <div id="showcase-panel" class="screen" role="tabpanel" :aria-labelledby="`tab-${active}`">
              <img
                v-for="t in tabs"
                v-show="active === t.id"
                :key="t.id"
                :src="withBase(t.src)"
                :alt="t.alt"
                width="1440"
                height="900"
                :loading="t.id === tabs[0].id ? 'eager' : 'lazy'"
              />
            </div>
          </div>
          <p class="caption">Screenshots use synthetic demo data about a fictional city.</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="band">
      <div class="container">
        <h2 class="section-title">From raw posts to an answer you can defend</h2>
        <div class="steps">
          <div v-for="s in steps" :key="s.n" class="step">
            <span class="num">{{ s.n }}</span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Feature rows -->
    <section class="container rows">
      <article v-for="(f, i) in features" :key="f.title" class="row" :class="{ flip: i % 2 === 1 }">
        <div class="row-copy">
          <p class="kicker">{{ f.kicker }}</p>
          <h2>{{ f.title }}</h2>
          <p>{{ f.text }}</p>
          <ul>
            <li v-for="p in f.points" :key="p">{{ p }}</li>
          </ul>
        </div>
        <div class="shot">
          <img :src="withBase(f.src)" :alt="f.alt" width="1440" height="900" loading="lazy" />
        </div>
      </article>
    </section>

    <!-- More views -->
    <section class="band">
      <div class="container">
        <h2 class="section-title">And the views you reach for next</h2>
        <div class="more">
          <div v-for="m in more" :key="m.title" class="more-card">
            <div class="thumb"><img :src="withBase(m.src)" :alt="m.title" width="1440" height="900" loading="lazy" /></div>
            <h3>{{ m.title }}</h3>
            <p>{{ m.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Try it -->
    <section id="try" class="try">
      <div class="container try-grid">
        <div>
          <p class="kicker">Try it</p>
          <h2>See it with data in one command</h2>
          <p class="try-lede">
            The demo starts a throwaway database, loads about 1,500 synthetic posts across 90 days for a
            fictional coastal city, and opens the app on your machine with a generated sign-in.
          </p>
          <ul class="checks">
            <li>Needs Node 22 and Docker, nothing else</li>
            <li>Runs on localhost only</li>
            <li>Remove it any time with <code>npm run demo -- --reset</code></li>
          </ul>
        </div>
        <div class="terminal">
          <div class="term-bar">
            <span>Terminal</span>
            <button type="button" class="copy" @click="copyCommands">{{ copied ? 'Copied' : 'Copy' }}</button>
          </div>
          <pre><code><span class="c"># get it</span>
<span class="p">$</span> git clone https://github.com/spiculedata/social-explorer.git
<span class="p">$</span> cd social-explorer/ex-accell-ui

<span class="c"># start the demo, then open http://localhost:5173</span>
<span class="p">$</span> npm run demo</code></pre>
        </div>
      </div>
    </section>

    <!-- Stack -->
    <section class="container stack">
      <h2 class="section-title">Built on parts you already trust</h2>
      <div class="stack-grid">
        <div v-for="s in stack" :key="s.name" class="stack-item">
          <h3>{{ s.name }}</h3>
          <p>{{ s.note }}</p>
        </div>
      </div>
    </section>

    <!-- Closing -->
    <section class="closing">
      <div class="container">
        <h2>Your data, your server, your analysis</h2>
        <p>
          Social Explorer is Apache-2.0 licensed and runs wherever you can run Docker. It is young, and the
          gaps are tracked in the open.
        </p>
        <div class="actions center">
          <a class="btn primary" href="#try">Try the demo</a>
          <a class="btn" :href="withBase('/guide/deployment')">Deploy it</a>
          <a class="btn ghost" href="https://github.com/spiculedata/social-explorer/issues">See what is next</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing { --radius: 14px; overflow-x: clip; }
.landing h1, .landing h2 { font-family: var(--se-font-display); font-weight: 600; }
.landing h3 { font-weight: 600; }
.container { max-width: 1240px; margin: 0 auto; padding: 0 24px; }

/* Hero */
.hero { position: relative; padding: 72px 0 56px; background:
  radial-gradient(60% 50% at 80% 0%, color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent), transparent 70%),
  radial-gradient(40% 40% at 0% 30%, color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent), transparent 70%); }
.hero-grid { display: grid; grid-template-columns: minmax(0, 4.4fr) minmax(0, 7.6fr); gap: 40px; align-items: center; }
.pill { display: inline-block; margin: 0 0 20px; padding: 4px 12px; border: 1px solid var(--vp-c-divider); border-radius: 999px; font-size: 13px; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); }
h1 { margin: 0; font-size: clamp(34px, 4.6vw, 54px); line-height: 1.08; letter-spacing: -0.02em; font-weight: 700; }
.lede { margin: 20px 0 0; font-size: 18px; line-height: 1.6; color: var(--vp-c-text-2); }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.actions.center { justify-content: center; }
.btn { display: inline-block; padding: 11px 20px; border: 1px solid var(--vp-c-divider); border-radius: 999px; font-weight: 600; font-size: 15px; color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); text-decoration: none; transition: transform .15s, background .15s; }
.btn:hover { transform: translateY(-1px); background: var(--vp-c-default-soft); }
.btn.primary { color: var(--vp-c-white); background: var(--vp-c-brand-3); border-color: var(--vp-c-brand-3); box-shadow: 0 6px 20px color-mix(in srgb, var(--vp-c-brand-3) 35%, transparent); }
.btn.primary:hover { background: var(--vp-c-brand-2); }
.btn.ghost { background: transparent; }
.fine { margin: 14px 0 0; font-size: 14px; color: var(--vp-c-text-3); }

/* Browser frame */
.frame { border: 1px solid var(--vp-c-divider); border-radius: var(--radius); overflow: hidden; background: var(--vp-c-bg); box-shadow: 0 30px 60px -20px rgba(0, 0, 0, .35), 0 0 0 1px rgba(255, 255, 255, .02); }
.chrome { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--vp-c-bg-soft); border-bottom: 1px solid var(--vp-c-divider); overflow-x: auto; }
.dots { display: flex; gap: 6px; margin-right: 10px; }
.dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--vp-c-divider); display: block; }
.tab { padding: 5px 12px; border: 0; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--vp-c-text-2); background: transparent; cursor: pointer; white-space: nowrap; }
.tab:hover { color: var(--vp-c-text-1); }
.tab.on { color: var(--vp-c-text-1); background: var(--vp-c-bg); box-shadow: 0 0 0 1px var(--vp-c-divider); }
.tab:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 1px; }
.screen { aspect-ratio: 1440 / 900; overflow: hidden; background: var(--vp-c-bg-alt); }
.screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.caption { margin: 12px 0 0; text-align: center; font-size: 13px; color: var(--vp-c-text-3); }

/* Sections */
.band { padding: 72px 0; background: var(--vp-c-bg-soft); border-block: 1px solid var(--vp-c-divider); }
.section-title { margin: 0 0 36px; text-align: center; font-size: clamp(24px, 3vw, 32px); letter-spacing: -0.01em; border: 0; padding: 0; }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.step { padding: 24px; border: 1px solid var(--vp-c-divider); border-radius: var(--radius); background: var(--vp-c-bg); }
.step h3 { margin: 12px 0 8px; font-size: 18px; }
.step p { margin: 0; color: var(--vp-c-text-2); line-height: 1.6; font-size: 15px; }
.num { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; font-weight: 700; font-size: 14px; color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }

.rows { padding-block: 40px 24px; }
.row { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 6fr); gap: 56px; align-items: center; padding: 48px 0; }
.row.flip { grid-template-columns: minmax(0, 6fr) minmax(0, 4fr); }
.row.flip .row-copy { order: 2; }
.kicker { margin: 0 0 8px; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vp-c-brand-1); }
.row h2, .try h2 { margin: 0 0 14px; font-size: clamp(24px, 3vw, 32px); line-height: 1.2; letter-spacing: -0.01em; border: 0; padding: 0; }
.row-copy p { margin: 0 0 16px; color: var(--vp-c-text-2); line-height: 1.65; }
.row ul, .checks { margin: 0; padding: 0; list-style: none; }
.row li, .checks li { position: relative; padding: 5px 0 5px 26px; font-size: 15px; color: var(--vp-c-text-1); }
.row li::before, .checks li::before { content: ''; position: absolute; left: 4px; top: 12px; width: 6px; height: 11px; border: solid var(--vp-c-brand-1); border-width: 0 2px 2px 0; transform: rotate(40deg) scale(.8); }
.shot { aspect-ratio: 1440 / 900; overflow: hidden; border: 1px solid var(--vp-c-divider); border-radius: var(--radius); box-shadow: 0 24px 48px -24px rgba(0, 0, 0, .35); background: var(--vp-c-bg-alt); }
.shot img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }

.more { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.more-card h3 { margin: 14px 0 4px; font-size: 16px; }
.more-card p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--vp-c-text-2); }
.thumb { aspect-ratio: 16 / 10; overflow: hidden; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg-alt); }
.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; transition: transform .3s; }
.more-card:hover .thumb img { transform: scale(1.03); }

/* Try it */
.try { padding: 88px 0; color: var(--se-ink-100); background: linear-gradient(135deg, var(--se-ink-950), var(--se-primary-900)); }
.try .kicker { color: var(--se-primary-300); }
.try h2 { color: #fff; }
.try-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 56px; align-items: center; }
.try-lede { margin: 0 0 20px; line-height: 1.65; color: var(--se-ink-300); }
.checks li { color: var(--se-ink-100); }
.checks li::before { border-color: var(--se-primary-300); }
.checks code { padding: 2px 6px; border-radius: 6px; font-size: 13px; color: #fff; background: rgba(255, 255, 255, .1); }
.terminal { border-radius: var(--radius); overflow: hidden; background: var(--se-ink-950); border: 1px solid rgba(255, 255, 255, .12); box-shadow: 0 30px 60px -20px rgba(0, 0, 0, .6); }
.term-bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; font-size: 12px; color: #8b90a6; border-bottom: 1px solid rgba(255, 255, 255, .08); }
.copy { padding: 3px 10px; border: 1px solid rgba(255, 255, 255, .2); border-radius: 6px; font-size: 12px; color: #e7e9ee; background: transparent; cursor: pointer; }
.copy:hover { background: rgba(255, 255, 255, .08); }
.terminal pre { margin: 0; padding: 18px 20px; overflow-x: auto; }
.terminal code { font-size: 13.5px; line-height: 1.9; color: #e7e9ee; background: transparent; }
.terminal .c { color: #6b7194; }
.terminal .p { color: var(--se-primary-300); user-select: none; }

/* Stack */
.stack { padding-block: 72px 24px; }
.stack-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stack-item { padding: 20px; border: 1px solid var(--vp-c-divider); border-radius: var(--radius); background: var(--vp-c-bg-soft); }
.stack-item h3 { margin: 0 0 6px; font-size: 15px; }
.stack-item p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--vp-c-text-2); }

/* Closing */
.closing { padding: 72px 0 24px; text-align: center; }
.closing h2 { margin: 0 0 12px; font-size: clamp(26px, 3.4vw, 36px); letter-spacing: -0.01em; border: 0; padding: 0; }
.closing p { max-width: 560px; margin: 0 auto; line-height: 1.65; color: var(--vp-c-text-2); }

@media (max-width: 960px) {
  .hero { padding-top: 40px; }
  .hero-grid, .try-grid, .row, .row.flip { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .row.flip .row-copy { order: 0; }
  .steps { grid-template-columns: minmax(0, 1fr); }
  .more, .stack-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .row { padding: 32px 0; }
}
@media (max-width: 520px) {
  .more, .stack-grid { grid-template-columns: minmax(0, 1fr); }
  .btn { flex: 1 1 100%; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .btn, .thumb img { transition: none; }
}
</style>
