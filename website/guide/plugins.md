# Plugins

Plugins are the standard extension point for cross-cutting concerns such as logging, tracing, or metrics exporters.

---

## Installing a plugin

```typescript
import { createClient, LoggerPlugin, MetricsReporterPlugin } from 'super-http'

const api = createClient({ baseURL: 'https://api.example.com' })

api.use(LoggerPlugin({ prefix: '[payments]', level: 'info' }))
api.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
```

Plugins are deduplicated by name — installing the same plugin twice is a no-op.

---

## Built-in plugins

### LoggerPlugin

Logs every request, response, retry, circuit-breaker transition, and fallback to the console.

```typescript
import { LoggerPlugin } from 'super-http'

api.use(LoggerPlugin({
  prefix:        '[my-service]',   // default: '[super-http]'
  level:         'debug',          // default: 'info'
  logRequests:   true,             // default: true
  logResponses:  true,             // default: true
  logResilience: true,             // default: true
}))
```

**Sample output:**
```
[my-service] → GET /users
[my-service] ← 200 /users
[my-service] retry #1 in 237ms
[my-service] circuit closed → open (failures: 5)
[my-service] fallback triggered
```

---

### MetricsReporterPlugin

Periodically logs a metrics summary line suitable for ingestion by log aggregators (Datadog, CloudWatch, etc.).

```typescript
import { MetricsReporterPlugin } from 'super-http'

api.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
```

**Sample output:**
```
[super-http:metrics] requests=1200 success=1180 failed=20 retries=45
  cb_trips=2 avg=12.3ms p95=45ms p99=87ms
```

---

## Writing a custom plugin

A plugin is any object with a `name` string and an `install(client)` method:

```typescript
import { SuperHttpPlugin } from 'super-http'

const DatadogPlugin: SuperHttpPlugin = {
  name: 'datadog',
  install(client) {
    client.on({
      onRetry: ({ attempt, error }) => {
        datadogMetrics.increment('http.retry', { attempt })
      },
      onCircuitStateChange: ({ from, to, failures }) => {
        datadogMetrics.gauge('http.circuit.open', to === 'open' ? 1 : 0)
        if (to === 'open') {
          datadogAlerts.send(`Circuit opened after ${failures} failures`)
        }
      },
      onBulkheadReject: () => datadogMetrics.increment('http.bulkhead.rejected'),
      onFallback: ()        => datadogMetrics.increment('http.fallback'),
      onRateLimitReject: () => datadogMetrics.increment('http.rate_limit.rejected'),
    })
  },
}

api.use(DatadogPlugin)
```

---

## OpenTelemetry example

```typescript
import { trace } from '@opentelemetry/api'
import type { SuperHttpPlugin } from 'super-http'

export function OpenTelemetryPlugin(serviceName: string): SuperHttpPlugin {
  const tracer = trace.getTracer(serviceName)
  const spans = new Map<string, ReturnType<typeof tracer.startSpan>>()

  return {
    name: 'opentelemetry',
    install(client) {
      client.on({
        onRequest(config) {
          const span = tracer.startSpan(`HTTP ${config.method?.toUpperCase()} ${config.url}`)
          span.setAttribute('http.method', config.method ?? 'GET')
          span.setAttribute('http.url', config.url ?? '')
          spans.set(config.url ?? '', span)
        },
        onResponse(res) {
          const span = spans.get(res.config?.url ?? '')
          if (span) { span.setAttribute('http.status_code', res.status); span.end(); spans.delete(res.config?.url ?? '') }
        },
        onError(err) {
          if (err instanceof Error) {
            const span = [...spans.values()][0]
            if (span) { span.recordException(err); span.end() }
          }
        },
      })
    },
  }
}
```

---

## Plugin composition

Plugins compose naturally — each calls `client.on()` or other methods:

```typescript
api
  .use(LoggerPlugin({ level: 'debug' }))
  .use(OpenTelemetryPlugin('checkout-service'))
  .use(DatadogPlugin)
  .use(MetricsReporterPlugin({ intervalMs: 30_000 }))
```
