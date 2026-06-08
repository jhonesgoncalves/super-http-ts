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
    SuperHttpModule.forFeature([
      {
        name: 'POSTS',
        baseURL: 'https://jsonplaceholder.typicode.com',
        timeout: 8_000,
        retry: {
          attempts: 3,
          delay: 300,
          backoff: 'exponential',
          retryOn: [500, 502, 503, 504],
        },
        bulkhead: { maxConcurrent: 15, maxQueue: 30 },
      },
      {
        name: 'COMMENTS',
        baseURL: 'https://jsonplaceholder.typicode.com',
        timeout: 5_000,
        retry: { attempts: 2, delay: 200, backoff: 'exponential' },
        circuitBreaker: {
          failureThreshold: 5,
          successThreshold: 2,
          timeoutMs: 10_000,
        },
      },
    ]),
  ],
  controllers: [PostsController],
  providers:   [PostsService],
  exports:     [PostsService],
})
export class PostsModule {}
