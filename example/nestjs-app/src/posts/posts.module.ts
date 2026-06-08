import { Module } from '@nestjs/common';
import { SuperHttpModule } from 'super-http/nestjs';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    /**
     * Register two named HTTP clients for PostsService:
     *  - POSTS    → JSONPlaceholder posts endpoint (high-concurrency preset)
     *  - COMMENTS → JSONPlaceholder comments endpoint (with circuit-breaker fallback)
     */
    /**
     * Register two named HTTP clients for PostsService.
     *
     * Retry, bulkhead and circuit-breaker are configured via presets —
     * these behaviours are set up through the fluent HttpClient API under
     * the hood (not as constructor options, which only accept baseURL /
     * timeout / pool / preset).
     *
     *  POSTS    → 'high-throughput' preset (large pool, fast fail, 1 retry)
     *  COMMENTS → 'resilient-api'  preset (3 retries + circuit breaker)
     */
    SuperHttpModule.forFeature([
      {
        name: 'POSTS',
        baseURL: 'https://jsonplaceholder.typicode.com',
        timeout: 8_000,
        preset: 'high-throughput',
      },
      {
        name: 'COMMENTS',
        baseURL: 'https://jsonplaceholder.typicode.com',
        timeout: 5_000,
        preset: 'resilient-api',
      },
    ]),
  ],
  controllers: [PostsController],
  providers:   [PostsService],
  exports:     [PostsService],
})
export class PostsModule {}
