import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'super-http',
  description: 'A resilient HTTP client — circuit breaker, connection pooling, keep-alive and smart retry.',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'og:title', content: 'super-http' }],
    ['meta', { name: 'og:description', content: 'A resilient HTTP client built on top of Axios.' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'super-http',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/' },
      {
        text: '1.0.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/jhonesgoncalves/super-http-ts/blob/main/CHANGELOG.md' },
          { text: 'Contributing', link: 'https://github.com/jhonesgoncalves/super-http-ts/blob/main/CONTRIBUTING.md' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Why super-http?', link: '/guide/why' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Connection Pooling', link: '/guide/connection-pool' },
            { text: 'Retry', link: '/guide/retry' },
            { text: 'Circuit Breaker', link: '/guide/circuit-breaker' },
          ],
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Full Reference', link: '/guide/configuration' },
            { text: 'Recipes', link: '/guide/recipes' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'HttpClientFactory', link: '/api/http-client-factory' },
            { text: 'HttpClient', link: '/api/http-client' },
            { text: 'CircuitBreaker', link: '/api/circuit-breaker' },
            { text: 'PoolConfig', link: '/api/pool-config' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jhonesgoncalves/super-http-ts' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/super-http' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Jhones Gonçalves',
    },

    editLink: {
      pattern: 'https://github.com/jhonesgoncalves/super-http-ts/edit/main/website/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },
  },
})
