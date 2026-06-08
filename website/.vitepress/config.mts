import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'super-http',
  description: 'Production-grade HTTP client for Node.js — built for performance, resilience, and observability.',
  lang: 'en-US',
  base: '/super-http-ts/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'og:title', content: 'super-http' }],
    ['meta', { name: 'og:description', content: 'Production-grade HTTP client for Node.js. Built for production, not just requests.' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'super-http',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'NestJS', link: '/guide/nestjs' },
      { text: 'API', link: '/api/' },
      { text: 'Benchmarks', link: '/guide/benchmarks' },
      {
        text: '1.2.1',
        items: [
          { text: 'Changelog', link: 'https://github.com/jhonesgoncalves/super-http-ts/blob/main/CHANGELOG.md' },
          { text: 'Contributing', link: 'https://github.com/jhonesgoncalves/super-http-ts/blob/main/CONTRIBUTING.md' },
          { text: 'npm', link: 'https://www.npmjs.com/package/super-http' },
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
            { text: 'Migrating from Axios', link: '/guide/migration' },
          ],
        },
        {
          text: 'Resilience Features',
          items: [
            { text: 'Connection Pooling', link: '/guide/connection-pool' },
            { text: 'Retry Strategies', link: '/guide/retry' },
            { text: 'Circuit Breaker', link: '/guide/circuit-breaker' },
            { text: 'Bulkhead', link: '/guide/bulkhead' },
            { text: 'Rate Limiter', link: '/guide/rate-limiter' },
            { text: 'Fallback', link: '/guide/fallback' },
            { text: 'Request Dedup', link: '/guide/dedup' },
          ],
        },
        {
          text: 'Observability',
          items: [
            { text: 'Hooks & Events', link: '/guide/observability' },
            { text: 'Built-in Metrics', link: '/guide/observability#metrics' },
            { text: 'Plugins', link: '/guide/plugins' },
          ],
        },
        {
          text: 'Integrations',
          items: [
            { text: 'NestJS', link: '/guide/nestjs' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Presets', link: '/guide/presets' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Recipes', link: '/guide/recipes' },
            { text: 'Production Readiness', link: '/guide/production-readiness' },
            { text: 'Benchmarks', link: '/guide/benchmarks' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'createClient', link: '/api/create-client' },
            { text: 'HttpClientFactory', link: '/api/http-client-factory' },
            { text: 'HttpClient', link: '/api/http-client' },
            { text: 'CircuitBreaker', link: '/api/circuit-breaker' },
            { text: 'Bulkhead', link: '/api/bulkhead' },
            { text: 'RateLimiter', link: '/api/rate-limiter' },
            { text: 'Retry Strategies', link: '/api/retry-strategy' },
            { text: 'RequestDedup', link: '/api/request-dedup' },
            { text: 'ResilienceEvents', link: '/api/resilience-events' },
            { text: 'MetricsSnapshot', link: '/api/metrics' },
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

    search: { provider: 'local' },
  },
})
