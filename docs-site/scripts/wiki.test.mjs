import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHome, buildSidebar, convertContainers, convertLinks, convertPage, wikiPageName } from './wiki.mjs';

test('wikiPageName flattens paths into wiki page names', () => {
  assert.equal(wikiPageName('index.md'), 'Home');
  assert.equal(wikiPageName('guide/getting-started.md'), 'Guide-Getting-started');
  assert.equal(wikiPageName('tutorials/first-project.md'), 'Tutorials-First-project');
  assert.equal(wikiPageName('tutorials/index.md'), 'Tutorials');
  assert.equal(wikiPageName('reference/api.md'), 'Reference-Api');
});

test('convertLinks rewrites site links to wiki pages and keeps anchors', () => {
  const out = convertLinks('See [start](/guide/getting-started) and [deploy](/guide/deployment#backups).', 'index.md');
  assert.equal(out, 'See [start](Guide-Getting-started) and [deploy](Guide-Deployment#backups).');
});

test('convertLinks maps a trailing-slash section link to its index page', () => {
  assert.equal(convertLinks('[all](/tutorials/)', 'x.md'), '[all](Tutorials)');
});

test('convertLinks resolves relative links against the page that contains them', () => {
  assert.equal(convertLinks('[c](./configuration)', 'guide/getting-started.md'), '[c](Guide-Configuration)');
  assert.equal(convertLinks('[o](../architecture/overview#data)', 'guide/getting-started.md'), '[o](Architecture-Overview#data)');
  assert.equal(convertLinks('[s](configuration.md)', 'guide/getting-started.md'), '[s](Guide-Configuration)');
});

test('convertLinks leaves external, anchor-only and mailto links alone', () => {
  const input = '[a](https://example.com/x) [b](#top) [c](mailto:a@b.co)';
  assert.equal(convertLinks(input, 'x.md'), input);
});

test('convertLinks moves screenshots into the wiki images folder', () => {
  assert.equal(convertLinks('![alt](/screenshots/tutorials/new-project.png)', 'x.md'), '![alt](images/tutorials/new-project.png)');
  assert.equal(convertLinks('![alt](/screenshots/home.png)', 'x.md'), '![alt](images/home.png)');
});

test('convertContainers turns VitePress containers into GitHub alerts', () => {
  const input = '::: tip What you learned\n- one\n- two\n:::\n\nafter';
  assert.equal(convertContainers(input), '> [!TIP]\n> **What you learned**\n>\n> - one\n> - two\n\nafter');
});

test('convertContainers maps every container type and handles a missing title', () => {
  assert.match(convertContainers('::: warning\nCareful\n:::'), /^> \[!WARNING\]\n> Careful$/);
  assert.match(convertContainers('::: danger\nNo\n:::'), /^> \[!CAUTION\]/);
  assert.match(convertContainers('::: info Heads up\nx\n:::'), /^> \[!NOTE\]/);
});

test('convertContainers does not touch fenced code that mentions colons', () => {
  const input = '```bash\necho ::: not a container\n```';
  assert.equal(convertContainers(input), input);
});

test('convertPage strips front matter and applies every conversion', () => {
  const md = '---\ntitle: x\n---\n# Heading\n\n[go](/guide/configuration)\n\n::: tip\nhi\n:::\n';
  const out = convertPage(md, 'guide/getting-started.md');
  assert.ok(!out.includes('title: x'));
  assert.ok(out.includes('[go](Guide-Configuration)'));
  assert.ok(out.includes('> [!TIP]'));
});

test('buildSidebar groups links by their section in the VitePress config', () => {
  const config = `sidebar: [
    { text: 'Guide', items: [
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Deployment', link: '/guide/deployment' } ] },
    { text: 'Tutorials', items: [ { text: 'Overview', link: '/tutorials/' } ] }
  ],`;
  const out = buildSidebar(config);
  assert.ok(out.includes('**Guide**'));
  assert.ok(out.includes('[Getting started](Guide-Getting-started)'));
  assert.ok(out.includes('[Overview](Tutorials)'));
  assert.ok(out.indexOf('**Guide**') < out.indexOf('**Tutorials**'));
});

test('buildHome turns the home page hero and features into plain markdown', () => {
  const index = `---
layout: home
hero:
  name: ex-accelerator
  text: Social media analytics, end to end
  tagline: Collect and analyse.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
features:
  - title: Collect
    details: Schedule crawls.
  - title: Analyse
    details: Sentiment and topics.
---
`;
  const out = buildHome(index);
  assert.match(out, /^# ex-accelerator/);
  assert.ok(out.includes('Social media analytics, end to end'));
  assert.ok(out.includes('Collect and analyse.'));
  assert.ok(out.includes('**Collect**'));
  assert.ok(out.includes('Sentiment and topics.'));
  assert.ok(out.includes('[Get started](Guide-Getting-started)'));
});

// --- the real docs, converted ---
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWiki } from './wiki.mjs';

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = mkdtempSync(join(tmpdir(), 'wiki-'));
const pages = buildWiki(docsDir, outputDir);
const allMarkdown = () => readdirSync(outputDir).filter((f) => f.endsWith('.md'));

test('the real docs produce a page for every source page plus Home, sidebar and footer', () => {
  assert.ok(pages.length >= 15, `expected many pages, got ${pages.length}`);
  for (const special of ['Home.md', '_Sidebar.md', '_Footer.md']) assert.ok(existsSync(join(outputDir, special)), special);
  assert.ok(existsSync(join(outputDir, 'Tutorials-First-project.md')));
});

test('every internal link and image in the generated wiki resolves', () => {
  const broken = [];
  for (const file of allMarkdown()) {
    const text = readFileSync(join(outputDir, file), 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = target.split('#')[0];
      const ok = path.startsWith('images/') ? existsSync(join(outputDir, path)) : existsSync(join(outputDir, `${path}.md`));
      if (!ok) broken.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('no VitePress-only syntax is left in the wiki', () => {
  for (const file of allMarkdown()) {
    const text = readFileSync(join(outputDir, file), 'utf8');
    assert.ok(!/^:::/m.test(text), `${file} still has a ::: container`);
    assert.ok(!/^---\nlayout:/m.test(text), `${file} still has front matter`);
  }
});

test('the sidebar links to pages that exist', () => {
  const sidebar = readFileSync(join(outputDir, '_Sidebar.md'), 'utf8');
  for (const [, target] of sidebar.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (target.startsWith('http')) continue;
    assert.ok(existsSync(join(outputDir, `${target}.md`)), `sidebar link ${target}`);
  }
});
