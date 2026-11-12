import { defineConfig, type HeadConfig } from 'vitepress';

export default defineConfig({
  title: 'Social Explorer',
  description: 'Open-source social media analytics platform for collecting, analysing and investigating online data.',
  base: '/social-explorer/',
  cleanUrls: true,
  head: [
    // og:title and og:description come from each page (the landing page sets its own in index.md)
    // The favicon and og:image URLs include the base path; forks or a custom domain should change them
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/social-explorer/brand/mark.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    // Absolute URL: link previews need one. Forks or a custom domain should change it.
    ['meta', { property: 'og:image', content: 'https://spiculedata.github.io/social-explorer/screenshots/sentiment-analysis.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }]
  ],
  // Every page gets og:title and og:description from its own front matter (title, description), falling back to
  // the page heading and the site defaults. A page that sets its own (the landing page) is left as written.
  transformHead({ pageData, head, siteData }) {
    const hasMeta = (property: string) => head.some(([tag, attrs]) => tag === 'meta' && attrs?.property === property);
    const title = pageData.frontmatter.title || pageData.title || siteData.title;
    const description = pageData.frontmatter.description || pageData.description || siteData.description;
    const extra: HeadConfig[] = [];
    if (!hasMeta('og:title')) extra.push(['meta', { property: 'og:title', content: String(title) }]);
    if (!hasMeta('og:description')) extra.push(['meta', { property: 'og:description', content: String(description) }]);
    return extra;
  },
  lastUpdated: true,
  themeConfig: {
    logo: { light: '/brand/mark.svg', dark: '/brand/mark-on-dark.svg', alt: 'Social Explorer' },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Tutorials', link: '/tutorials/' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Reference', link: '/reference/api' },
      { text: 'Brand', link: '/brand/' },
      { text: 'Contributing', link: 'https://github.com/spiculedata/social-explorer/blob/main/CONTRIBUTING.md' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Authentication and roles', link: '/guide/authentication' },
          { text: 'Deployment', link: '/guide/deployment' },
          { text: 'Data sharing over IPFS', link: '/guide/data-sharing' },
          { text: 'Try it with demo data', link: '/guide/demo-data' }
        ]
      },
      {
        text: 'Tutorials',
        items: [
          { text: 'Overview', link: '/tutorials/' },
          { text: 'Your first project', link: '/tutorials/first-project' },
          { text: 'Explore the dashboards', link: '/tutorials/explore-dashboards' },
          { text: 'Investigate a question', link: '/tutorials/investigations' },
          { text: 'Build and publish a workflow', link: '/tutorials/workflows' },
          { text: 'Schedule a crawl', link: '/tutorials/schedule-a-crawl' },
          { text: 'Research in Jupyter', link: '/tutorials/jupyter' },
          { text: 'Troubleshooting and FAQ', link: '/tutorials/troubleshooting' },
          { text: 'Glossary', link: '/tutorials/glossary' }
        ]
      },
      {
        text: 'Brand',
        items: [
          { text: 'Overview', link: '/brand/' },
          { text: 'Logo', link: '/brand/logo' },
          { text: 'Colour', link: '/brand/colour' },
          { text: 'Typography', link: '/brand/typography' },
          { text: 'Layout and components', link: '/brand/components' },
          { text: 'Data visualisation', link: '/brand/data-visualisation' },
          { text: 'Voice and content', link: '/brand/voice' }
        ]
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Overview', link: '/architecture/overview' },
          { text: 'Data model', link: '/architecture/data-model' },
          { text: 'Crawler', link: '/architecture/crawler' }
        ]
      },
      {
        text: 'Reference',
        items: [{ text: 'API', link: '/reference/api' }]
      }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/spiculedata/social-explorer' }],
    editLink: {
      pattern: 'https://github.com/spiculedata/social-explorer/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub'
    },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the Apache License 2.0.'
    }
  }
});
