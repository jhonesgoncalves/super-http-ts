# super-http · NestJS Example Application

A complete reference implementation that demonstrates every feature of the
[super-http](https://superhttp.dev) library inside a production-style NestJS
application.

## What's covered

| Feature | Where |
|---|---|
| `SuperHttpModule.forRootAsync` with `useClass` | `src/app.module.ts` |
| `SuperHttpOptionsFactory` implementation | `src/config/super-http.config.ts` |
| Default `SuperHttpService` injection | `src/users/users.service.ts` |
| Named clients with `SuperHttpModule.forFeature` | `src/posts/posts.module.ts` |
| `@InjectSuperHttp('NAME')` decorator | `src/posts/posts.service.ts` |
| Per-request policy (disable retry on POST/DELETE) | `src/users/users.service.ts` |
| Live metrics endpoint | `src/health/health.controller.ts` |
| Unit tests with mock providers | `**/*.spec.ts` |
| End-to-end tests (real HTTP to JSONPlaceholder) | `test/app.e2e-spec.ts` |

## Project structure

```
src/
├── app.module.ts               # Root module — SuperHttpModule.forRootAsync
├── app.controller.ts           # GET / welcome route
├── config/
│   └── super-http.config.ts   # SuperHttpOptionsFactory (reads env vars)
├── users/
│   ├── users.module.ts         # Uses default SuperHttpService
│   ├── users.controller.ts     # CRUD routes for /users
│   ├── users.service.ts        # Injects SuperHttpService directly
│   └── dto/create-user.dto.ts
├── posts/
│   ├── posts.module.ts         # SuperHttpModule.forFeature([POSTS, COMMENTS])
│   ├── posts.controller.ts     # CRUD + /with-comments route
│   └── posts.service.ts        # @InjectSuperHttp('POSTS') + @InjectSuperHttp('COMMENTS')
└── health/
    ├── health.module.ts
    └── health.controller.ts    # GET /health — live super-http metrics
test/
└── app.e2e-spec.ts             # Full e2e tests (requires internet)
```

## Quick start

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Run unit tests
npm test

# Run e2e tests (requires internet — calls JSONPlaceholder)
npm run test:e2e
```

## Available endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api` | Welcome message |
| GET | `/api/health` | Live HTTP client metrics |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get a user by ID |
| POST | `/api/users` | Create a user |
| PUT | `/api/users/:id` | Update a user |
| DELETE | `/api/users/:id` | Delete a user |
| GET | `/api/posts` | List all posts |
| GET | `/api/posts/:id` | Get a post by ID |
| GET | `/api/posts/:id/with-comments` | Get post + comments (parallel fetch) |
| POST | `/api/posts` | Create a post |

## Configuration

The app reads the following environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `API_BASE_URL` | `https://jsonplaceholder.typicode.com` | Upstream API base URL |
| `HTTP_TIMEOUT` | `10000` | Request timeout in milliseconds |
| `HTTP_RETRY_ATTEMPTS` | `3` | Max retry attempts |
| `HTTP_MAX_CONCURRENT` | `10` | Bulkhead max concurrent requests |

## Key patterns illustrated

### 1. Global default client (`forRootAsync` + `useClass`)

```typescript
// app.module.ts
SuperHttpModule.forRootAsync({
  useClass: SuperHttpConfigService,
})
```

`SuperHttpConfigService` implements `SuperHttpOptionsFactory` and builds the
`CreateClientOptions` from environment variables. The resulting `SuperHttpService`
is available globally via constructor injection.

### 2. Named clients (`forFeature`)

```typescript
// posts.module.ts
SuperHttpModule.forFeature([
  { name: 'POSTS',    baseURL: '...', bulkhead: { maxConcurrent: 15 } },
  { name: 'COMMENTS', baseURL: '...', circuitBreaker: { failureThreshold: 5 } },
])
```

```typescript
// posts.service.ts
constructor(
  @InjectSuperHttp('POSTS')    private readonly postsClient: HttpClient,
  @InjectSuperHttp('COMMENTS') private readonly commentsClient: HttpClient,
) {}
```

### 3. Per-request policy (disable retry on mutations)

```typescript
// users.service.ts
await this.http.instance.post('/users', dto, {
  policy: { retry: false, timeout: 10_000 },
});
```

### 4. Live metrics

```typescript
// health.controller.ts
const m = this.http.metrics();
// { totalRequests, totalErrors, p99, ... }
```

## Testing approach

- **Unit tests** (`*.spec.ts`) use `@nestjs/testing` with a mock provider — no
  real HTTP calls. The mock replaces the service or the named-client token.
- **E2e tests** (`test/app.e2e-spec.ts`) spin up the full app and hit real
  JSONPlaceholder endpoints. Mark them `skip` in CI environments without internet.

### Unit test pattern for named clients

```typescript
import { getSuperHttpClientToken } from 'super-http/nestjs';

const module = await Test.createTestingModule({
  providers: [
    PostsService,
    { provide: getSuperHttpClientToken('POSTS'),    useValue: mockPostsClient    },
    { provide: getSuperHttpClientToken('COMMENTS'), useValue: mockCommentsClient },
  ],
}).compile();
```

### Unit test pattern for default client

```typescript
const module = await Test.createTestingModule({
  providers: [
    UsersService,
    { provide: SuperHttpService, useValue: mockSuperHttpService },
  ],
}).compile();
```

## Learn more

- [super-http NestJS guide](https://superhttp.dev/guide/nestjs)
- [super-http documentation](https://superhttp.dev)
- [NestJS documentation](https://docs.nestjs.com)
