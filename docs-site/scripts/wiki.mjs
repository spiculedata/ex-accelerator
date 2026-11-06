// Builds GitHub wiki pages from the VitePress docs, so the wiki mirrors docs-site/ and is never edited by hand.
//   node scripts/wiki.mjs [outputDir]      (default: .wiki)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALERT_TYPES = { tip: 'TIP', info: 'NOTE', warning: 'WARNING', danger: 'CAUTION' };
const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** 'guide/getting-started.md' -> 'Guide-Getting-started'; index pages take their folder's name. */
export function wikiPageName(docPath) {
  const parts = docPath.replace(/\.md$/, '').split('/').filter((part) => part !== 'index');
  return parts.length === 0 ? 'Home' : parts.map(capitalise).join('-');
}

/** Rewrites page links (absolute or relative) to wiki page names and screenshots to the wiki images folder. */
export function convertLinks(markdown, docPath = 'index.md') {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)\s]+)\)/g, (match, prefix, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return match;
    if (target.startsWith('/screenshots/')) return `${prefix}images/${target.slice('/screenshots/'.length)})`;

    const [path, anchor] = target.split('#');
    const absolute = path.startsWith('/') ? path : posix.join(posix.dirname(docPath), path);
    // VitePress accepts .md and .html links; both mean the same page
    const page = wikiPageName(`${absolute.replace(/^\/|\/$/g, '').replace(/\.(md|html)$/, '')}.md`);
    return `${prefix}${page}${anchor ? `#${anchor}` : ''})`;
  });
}

/** ::: tip Title ... ::: blocks become GitHub alerts (> [!TIP]). Fenced code is left alone. */
export function convertContainers(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let inFence = false;
  let alert = null;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const open = !inFence && !alert && line.match(/^:::\s*(tip|info|warning|danger)\b\s*(.*)$/);
    if (open) {
      alert = ALERT_TYPES[open[1]];
      out.push(`> [!${alert}]`);
      if (open[2].trim()) out.push(`> **${open[2].trim()}**`, '>');
      continue;
    }
    if (alert && !inFence && line.trim() === ':::') {
      alert = null;
      continue;
    }
    out.push(alert ? (line.trim() === '' ? '>' : `> ${line}`) : line);
  }
  return out.join('\n');
}

const stripFrontMatter = (markdown) => markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');

export function convertPage(markdown, docPath = 'index.md') {
  return convertContainers(convertLinks(stripFrontMatter(markdown), docPath)).trimEnd() + '\n';
}

/**
 * _Sidebar.md from the sidebar section of the VitePress config. This reads the file as text, so it
 * expects single-quoted strings and `{ text, link }` items grouped under `{ text, items }` headings.
 */
export function buildSidebar(configSource) {
  const section = configSource.slice(configSource.indexOf('sidebar:'));
  const lines = ['**[Home](Home)**', ''];
  for (const match of section.matchAll(/text:\s*'([^']+)'(?:\s*,\s*link:\s*'([^']+)')?/g)) {
    const [, text, link] = match;
    if (link) lines.push(`- [${text}](${link.startsWith('http') ? link : wikiPageName(`${link.replace(/^\/|\/$/g, '')}.md`)})`);
    else lines.push('', `**${text}**`, '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Home.md from the VitePress home page's front matter (hero, actions and features). */
export function buildHome(indexSource) {
  const front = indexSource.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const field = (name) => front.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
  const lines = [`# ${field('name')}`, '', `**${field('text')}**`, '', field('tagline'), ''];

  const actions = [...front.matchAll(/-\s*theme:\s*\w+\s*\n\s*text:\s*(.+)\n\s*link:\s*(\S+)/g)];
  for (const [, text, link] of actions) {
    lines.push(`- [${text.trim()}](${link.startsWith('http') ? link : wikiPageName(`${link.replace(/^\/|\/$/g, '')}.md`)})`);
  }
  if (actions.length > 0) lines.push('');

  for (const [, title, details] of front.matchAll(/-\s*title:\s*(.+)\n\s*details:\s*(.+)/g)) {
    lines.push(`**${title.trim()}**. ${details.trim()}`, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

// Folders at the top level of docs-site that hold tooling or assets, not pages
const NON_PAGE_FOLDERS = new Set(['node_modules', '.vitepress', 'public', 'scripts', '.wiki']);

function markdownFiles(directory, root = directory) {
  return readdirSync(directory).flatMap((name) => {
    if (directory === root && NON_PAGE_FOLDERS.has(name)) return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return markdownFiles(path, root);
    return name.endsWith('.md') ? [relative(root, path)] : [];
  });
}

/** Writes the whole wiki into outputDir (recreated). Returns the page names written. */
export function buildWiki(docsDir, outputDir) {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const pages = [];
  const owners = new Map();
  for (const file of markdownFiles(docsDir)) {
    const name = wikiPageName(file);
    // Two docs must not flatten to the same wiki page (names are case-insensitive on GitHub)
    const key = name.toLowerCase();
    if (owners.has(key)) throw new Error(`Wiki page name collision: ${file} and ${owners.get(key)} both become "${name}"`);
    owners.set(key, file);
    const source = readFileSync(join(docsDir, file), 'utf8');
    writeFileSync(join(outputDir, `${name}.md`), convertPage(source, file));
    pages.push(name);
  }

  writeFileSync(join(outputDir, 'Home.md'), buildHome(readFileSync(join(docsDir, 'index.md'), 'utf8')));
  writeFileSync(join(outputDir, '_Sidebar.md'), buildSidebar(readFileSync(join(docsDir, '.vitepress', 'config.ts'), 'utf8')));
  writeFileSync(
    join(outputDir, '_Footer.md'),
    'This wiki is generated from [`docs-site/`](https://github.com/spiculedata/ex-accelerator/tree/main/docs-site). Edit the docs there; changes made here are overwritten.\n'
  );

  const screenshots = join(docsDir, 'public', 'screenshots');
  if (existsSync(screenshots)) cpSync(screenshots, join(outputDir, 'images'), { recursive: true });
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const output = process.argv[2] ?? join(docsDir, '.wiki');
  const pages = buildWiki(docsDir, output);
  console.log(`Wrote ${pages.length} pages and the sidebar to ${output}`);
}
