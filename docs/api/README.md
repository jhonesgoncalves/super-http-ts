**super-http v2.0.0**

***

# super-http v2.0.0

## Classes

- [Bulkhead](classes/Bulkhead.md)
- [CircuitBreaker](classes/CircuitBreaker.md)
- [DeadlineExceededError](classes/DeadlineExceededError.md)
- [ExponentialJitterRetryStrategy](classes/ExponentialJitterRetryStrategy.md)
- [ExponentialRetryStrategy](classes/ExponentialRetryStrategy.md)
- [FixedRetryStrategy](classes/FixedRetryStrategy.md)
- [HttpClient](classes/HttpClient.md)
- [HttpClientFactory](classes/HttpClientFactory.md)
- [RateLimiter](classes/RateLimiter.md)
- [RequestAbortedError](classes/RequestAbortedError.md)
- [RequestDedup](classes/RequestDedup.md)
- [RetryAfterStrategy](classes/RetryAfterStrategy.md)

## Interfaces

- [BulkheadConfig](interfaces/BulkheadConfig.md)
- [BulkheadRejectEvent](interfaces/BulkheadRejectEvent.md)
- [CircuitBreakerConfig](interfaces/CircuitBreakerConfig.md)
- [CircuitStateChangeEvent](interfaces/CircuitStateChangeEvent.md)
- [ClientState](interfaces/ClientState.md)
- [CorrelationOptions](interfaces/CorrelationOptions.md)
- [CreateClientOptions](interfaces/CreateClientOptions.md)
- [DedupOptions](interfaces/DedupOptions.md)
- [FallbackEvent](interfaces/FallbackEvent.md)
- [HttpClientRequestConfig](interfaces/HttpClientRequestConfig.md)
- [LoggerPluginOptions](interfaces/LoggerPluginOptions.md)
- [MetricsSnapshot](interfaces/MetricsSnapshot.md)
- [PoolConfig](interfaces/PoolConfig.md)
- [RateLimitConfig](interfaces/RateLimitConfig.md)
- [RateLimitRejectEvent](interfaces/RateLimitRejectEvent.md)
- [RequestPolicy](interfaces/RequestPolicy.md)
- [ResilienceEvents](interfaces/ResilienceEvents.md)
- [RetryEvent](interfaces/RetryEvent.md)
- [RetryOptions](interfaces/RetryOptions.md)
- [RetryStrategy](interfaces/RetryStrategy.md)
- [SuperHttpPlugin](interfaces/SuperHttpPlugin.md)

## Type Aliases

- [CircuitState](type-aliases/CircuitState.md)
- [HttpClientResponse](type-aliases/HttpClientResponse.md)
- [Preset](type-aliases/Preset.md)

## Variables

- [DEFAULT\_DEDUP\_METHODS](variables/DEFAULT_DEDUP_METHODS.md)

## Functions

- [createClient](functions/createClient.md)
- [isCancellation](functions/isCancellation.md)
- [LoggerPlugin](functions/LoggerPlugin.md)
- [MetricsReporterPlugin](functions/MetricsReporterPlugin.md)
