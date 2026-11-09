import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHome, buildSidebar, buildWiki, convertContainers, convertLinks, convertPage, wikiPageName } from './wiki.mjs';

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

test('convertLinks moves brand assets into the wiki images folder, in markdown and HTML', () => {
  assert.equal(convertLinks('[logo](/brand/logo.svg)', 'x.md'), '[logo](images/brand/logo.svg)');
  assert.equal(convertLinks('<img src="/brand/mark.svg" alt="m">', 'x.md'), '<img src="images/brand/mark.svg" alt="m">');
  assert.equal(convertLinks('<img src="/screenshots/home.png">', 'x.md'), '<img src="images/home.png">');
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

test('buildSidebar stops at the end of the sidebar and ignores later config text', () => {
  const config = `sidebar: [ { text: 'Guide', items: [ { text: 'Start', link: '/guide/start' } ] } ],
    editLink: { pattern: 'x', text: 'Edit this page on GitHub' },
    footer: { message: 'Released' }`;
  const out = buildSidebar(config);
  assert.ok(!out.includes('Edit this page'));
  assert.ok(out.includes('[Start](Guide-Start)'));
});

test('wikiPageName only drops a trailing index, and accepts Windows separators', () => {
  assert.equal(wikiPageName('index/foo.md'), 'Index-Foo');
  assert.equal(wikiPageName('guide\\getting-started.md'), 'Guide-Getting-started');
});

test('convertPage handles CRLF line endings', () => {
  const out = convertPage('---\r\ntitle: x\r\n---\r\n# Hi\r\n\r\n::: tip\r\nok\r\n:::\r\n', 'a.md');
  assert.ok(!out.includes('title: x'));
  assert.ok(out.includes('> [!TIP]'));
});

test('convertLinks leaves fenced code and inline code untouched', () => {
  const input = 'Use `[a](/guide/x)` or:\n```md\n[b](/guide/y)\n```\n[real](/guide/z)';
  const out = convertLinks(input, 'index.md');
  assert.ok(out.includes('`[a](/guide/x)`'));
  assert.ok(out.includes('[b](/guide/y)'));
  assert.ok(out.includes('[real](Guide-Z)'));
});

test('buildSidebar fails loudly when the config has no sidebar', () => {
  assert.throws(() => buildSidebar("export default { title: 'x' }"), /sidebar/i);
});

test('buildHome takes the hero text from the hero block, not an action', () => {
  const index = '---\nhero:\n  name: x\n  tagline: t\n  actions:\n    - theme: brand\n      text: Get started\n      link: /guide/a\n---\n';
  assert.ok(!buildHome(index).includes('**Get started**'));
});

test('buildHome turns the home page hero and features into plain markdown', () => {
  const index = `---
layout: home
hero:
  name: Social Explorer
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
  assert.match(out, /^# Social Explorer/);
  assert.ok(out.includes('Social media analytics, end to end'));
  assert.ok(out.includes('Collect and analyse.'));
  assert.ok(out.includes('**Collect**'));
  assert.ok(out.includes('Sentiment and topics.'));
  assert.ok(out.includes('[Get started](Guide-Getting-started)'));
});

// --- the real docs, converted ---
const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
let outputDir;
let pages;

before(() => {
  outputDir = mkdtempSync(join(tmpdir(), 'wiki-'));
  pages = buildWiki(docsDir, outputDir);
});

after(() => rmSync(outputDir, { recursive: true, force: true }));

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
    assert.ok(!text.startsWith('---\n'), `${file} still has front matter`);
  }
});

test('the sidebar links to pages that exist', () => {
  const sidebar = readFileSync(join(outputDir, '_Sidebar.md'), 'utf8');
  for (const [, target] of sidebar.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (target.startsWith('http')) continue;
    assert.ok(existsSync(join(outputDir, `${target}.md`)), `sidebar link ${target}`);
  }
});

test('convertLinks treats .html links like .md links', () => {
  assert.equal(convertLinks('[x](/guide/deployment.html#backups)', 'index.md'), '[x](Guide-Deployment#backups)');
});

test('buildWiki refuses two docs that flatten to the same page name', () => {
  const docs = mkdtempSync(join(tmpdir(), 'wiki-docs-'));
  try {
    mkdirSync(join(docs, '.vitepress'));
    mkdirSync(join(docs, 'foo'));
    mkdirSync(join(docs, 'foo-bar'));
    writeFileSync(join(docs, 'index.md'), '---\nhero:\n  name: x\n---\n');
    writeFileSync(join(docs, '.vitepress', 'config.ts'), "sidebar: []");
    writeFileSync(join(docs, 'foo', 'bar-baz.md'), '# a');
    writeFileSync(join(docs, 'foo-bar', 'baz.md'), '# b');
    assert.throws(() => buildWiki(docs, join(docs, 'out')), /collision/i);
  } finally {
    rmSync(docs, { recursive: true, force: true });
  }
});

test('buildWiki keeps pages in folders that merely share a name with tooling folders', () => {
  const docs = mkdtempSync(join(tmpdir(), 'wiki-docs-'));
  try {
    mkdirSync(join(docs, '.vitepress'));
    mkdirSync(join(docs, 'guide', 'public'), { recursive: true });
    writeFileSync(join(docs, 'index.md'), '---\nhero:\n  name: x\n---\n');
    writeFileSync(join(docs, '.vitepress', 'config.ts'), 'sidebar: []');
    writeFileSync(join(docs, 'guide', 'public', 'visibility.md'), '# v');
    assert.ok(buildWiki(docs, join(docs, 'out')).includes('Guide-Public-Visibility'));
  } finally {
    rmSync(docs, { recursive: true, force: true });
  }
});

test('buildSidebar fails when a sidebar item uses a shape it cannot convert', () => {
  const config = `sidebar: [{ text: 'Guide', items: [{ link: '/guide/a', text: 'A' }] }]`;
  assert.throws(() => buildSidebar(config), /links but/);
});
