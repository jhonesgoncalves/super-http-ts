[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / Preset

# Type Alias: Preset

> **Preset** = `"high-throughput"` \| `"resilient-api"` \| `"low-latency"`

Defined in: [src/presets/index.ts:15](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/presets/index.ts#L15)

Built-in configuration presets.

| Preset | Best for |
|---|---|
| `high-throughput` | Internal services, small payloads, max req/s |
| `resilient-api` | External APIs, payment gateways, critical paths |
| `low-latency` | Real-time features, sub-10ms p99 requirements |
