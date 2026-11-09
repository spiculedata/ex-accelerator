import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Social Explorer',
  description: 'Open-source social media analytics platform for collecting, analysing and investigating online data.',
  base: '/social-explorer/',
  cleanUrls: true,
  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Social Explorer: follow a story across social, news and radio' }],
    ['meta', { property: 'og:description', content: 'Open-source platform that brings posts, news events and broadcasts into one database and scores them for sentiment, topics and language. Try it with one command.' }],
    ['meta', { property: 'og:image', content: 'https://spiculedata.github.io/social-explorer/screenshots/sentiment-analysis.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }]
  ],
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Tutorials', link: '/tutorials/' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Reference', link: '/reference/api' },
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
