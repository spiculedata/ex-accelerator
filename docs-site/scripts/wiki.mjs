// Builds GitHub wiki pages from the VitePress docs, so the wiki mirrors docs-site/ and is never edited by hand.
//   node scripts/wiki.mjs [outputDir]      (default: .wiki)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALERT_TYPES = { tip: 'TIP', info: 'NOTE', warning: 'WARNING', danger: 'CAUTION' };
const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** 'guide/getting-started.md' -> 'Guide-Getting-started'; index pages take their folder's name. */
export function wikiPageName(docPath) {
  const parts = docPath.replace(/\\/g, '/').replace(/\.md$/, '').split('/');
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts.length === 0 ? 'Home' : parts.map(capitalise).join('-');
}

/** Rewrites page links (absolute or relative) to wiki page names and screenshots to the wiki images folder. */
export function convertLinks(markdown, docPath = 'index.md') {
  // Images written as HTML (logo tiles on the brand pages) need the same move as markdown images
  const rewriteHtmlImages = (text) =>
    text
      .replace(/(src=")\/screenshots\//g, '$1images/')
      .replace(/(src=")\/brand\//g, '$1images/brand/');
  const rewrite = (text) =>
    rewriteHtmlImages(text).replace(/(!?\[[^\]]*\]\()([^)\s]+)\)/g, (match, prefix, target) => {
      if (/^(https?:|mailto:|#)/.test(target)) return match;
      if (target.startsWith('/screenshots/')) return `${prefix}images/${target.slice('/screenshots/'.length)})`;
      if (target.startsWith('/brand/') && /\.(svg|png|jpe?g)$/.test(target)) return `${prefix}images${target})`;

      const [path, anchor] = target.split('#');
      const absolute = path.startsWith('/') ? path : posix.join(posix.dirname(docPath), path);
      // VitePress accepts .md and .html links; both mean the same page
      const page = wikiPageName(`${absolute.replace(/^\/|\/$/g, '').replace(/\.(md|html)$/, '')}.md`);
      return `${prefix}${page}${anchor ? `#${anchor}` : ''})`;
    });

  // Leave fenced blocks and inline code exactly as written
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.split(/(`[^`]*`)/).map((part, index) => (index % 2 === 1 ? part : rewrite(part))).join('');
    })
    .join('\n');
}

/**
 * ::: tip|info|warning|danger blocks become GitHub alerts (> [!TIP]). Fenced code is left alone.
 * Other containers (details, code-group) and nested containers are not supported; the wiki tests fail
 * if one is left behind, so add support here when a page needs it.
 */
export function convertContainers(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let inFence = false;
  let alert = null;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
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

const normalizeNewlines = (markdown) => markdown.replace(/\r\n/g, '\n');
const stripFrontMatter = (markdown) => markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');

export function convertPage(markdown, docPath = 'index.md') {
  return convertContainers(convertLinks(stripFrontMatter(normalizeNewlines(markdown)), docPath)).trimEnd() + '\n';
}

/**
 * _Sidebar.md from the sidebar section of the VitePress config. This reads the file as text, so it
 * expects single-quoted strings and `{ text, link }` items grouped under `{ text, items }` headings.
 */
export function buildSidebar(configSource) {
  const start = configSource.indexOf('sidebar:');
  if (start < 0) throw new Error('No sidebar found in the VitePress config; update scripts/wiki.mjs to match it');
  // Only the sidebar array: later config (editLink, footer) also has `text:` entries
  const open = configSource.indexOf('[', start);
  let depth = 0;
  let end = configSource.length;
  for (let i = open; i < configSource.length; i++) {
    if (configSource[i] === '[') depth++;
    if (configSource[i] === ']' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  const section = configSource.slice(start, end);
  const lines = ['**[Home](Home)**', ''];
  let emittedLinks = 0;
  for (const match of section.matchAll(/text:\s*'([^']+)'(?:\s*,\s*link:\s*'([^']+)')?/g)) {
    const [, text, link] = match;
    if (link) emittedLinks++;
    if (link) lines.push(`- [${text}](${link.startsWith('http') ? link : wikiPageName(`${link.replace(/^\/|\/$/g, '')}.md`)})`);
    else lines.push('', `**${text}**`, '');
  }
  const declaredLinks = (section.match(/\blink:/g) ?? []).length;
  if (declaredLinks !== emittedLinks) {
    throw new Error(`Sidebar has ${declaredLinks} links but ${emittedLinks} were converted; scripts/wiki.mjs only understands \`text: '...', link: '...'\` items`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Home.md from the VitePress home page's front matter (hero, actions and features). */
export function buildHome(indexSource) {
  const front = normalizeNewlines(indexSource).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  // Hero fields only: the lookup stops before `actions:` so an action's `text:` is never mistaken for the hero text
  const hero = front.split(/^\s*actions:/m)[0].split(/^features:/m)[0];
  const field = (name) => hero.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
  const lines = [`# ${field('name')}`, '', `**${field('text')}**`, '', field('tagline'), ''];

  const actions = [...front.matchAll(/-\s*theme:\s*\w+\s*\n\s*text:\s*(.+)\n\s*link:\s*(\S+)/g)];
  for (const [, text, link] of actions) {
    lines.push(`- [${text.trim()}](${link.startsWith('http') ? link : wikiPageName(`${link.replace(/^\/|\/$/g, '')}.md`)})`);
  }
  if (actions.length > 0) lines.push('');

  // A feature may carry a link (and its text) on the lines after its details
  for (const [, title, details, link, linkText] of front.matchAll(/-\s*title:\s*(.+)\n\s*details:\s*(.+)(?:\n\s*link:\s*(\S+))?(?:\n\s*linkText:\s*(.+))?/g)) {
    const more = link ? ` [${(linkText ?? 'Read more').trim()}](${link.startsWith('http') ? link : wikiPageName(`${link.replace(/^\/|\/$/g, '')}.md`)})` : '';
    lines.push(`**${title.trim()}**. ${details.trim()}${more}`, '');
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
    return name.endsWith('.md') ? [relative(root, path).split(sep).join('/')] : [];
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
    'This wiki is generated from [`docs-site/`](https://github.com/spiculedata/social-explorer/tree/main/docs-site). Edit the docs there; changes made here are overwritten.\n'
  );

  const screenshots = join(docsDir, 'public', 'screenshots');
  if (existsSync(screenshots)) cpSync(screenshots, join(outputDir, 'images'), { recursive: true });
  const brand = join(docsDir, 'public', 'brand');
  if (existsSync(brand)) cpSync(brand, join(outputDir, 'images', 'brand'), { recursive: true });
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const output = process.argv[2] ?? join(docsDir, '.wiki');
  const pages = buildWiki(docsDir, output);
  console.log(`Wrote ${pages.length} pages and the sidebar to ${output}`);
}
