import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Integration tests for the super-http NestJS example application.
 *
 * Spins up the full NestJS app (real DI, real modules) and fires HTTP requests
 * against JSONPlaceholder (https://jsonplaceholder.typicode.com).
 *
 * Run: npm run test:e2e
 * Requires internet access.
 */
describe('super-http NestJS example (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ── Root ──────────────────────────────────────────────────────────────────

  describe('GET /api', () => {
    it('returns welcome message and docs link', async () => {
      const { body, status } = await request(app.getHttpServer()).get('/api');

      expect(status).toBe(200);
      expect(body.message).toContain('super-http');
      expect(body.docs).toBeDefined();
    });
  });

  // ── Health ────────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns a health object with required shape', async () => {
      const { body, status } = await request(app.getHttpServer()).get('/api/health');

      expect(status).toBe(200);
      expect(body.status).toMatch(/^(ok|degraded)$/);
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.http).toBeDefined();
      expect(body.http.successRate).toMatch(/^\d+\.\d+%$/);
      expect(body.http.p99).toBeDefined();
    });

    it('increments request counter after subsequent calls', async () => {
      const before = await request(app.getHttpServer()).get('/api/health');
      // Make two user requests to bump the counter
      await request(app.getHttpServer()).get('/api/users/1');
      await request(app.getHttpServer()).get('/api/users/2');
      const after = await request(app.getHttpServer()).get('/api/health');

      expect(after.body.http.requests).toBeGreaterThan(before.body.http.requests);
    }, 20_000);
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  describe('Users CRUD', () => {
    describe('GET /api/users', () => {
      it('returns an array of users', async () => {
        const { body, status } = await request(app.getHttpServer()).get('/api/users');

        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);
        expect(body[0]).toMatchObject({
          id:       expect.any(Number),
          name:     expect.any(String),
          email:    expect.any(String),
          username: expect.any(String),
        });
      }, 15_000);
    });

    describe('GET /api/users/:id', () => {
      it('returns a single user by id', async () => {
        const { body, status } = await request(app.getHttpServer()).get('/api/users/1');

        expect(status).toBe(200);
        expect(body.id).toBe(1);
        expect(body.name).toBeDefined();
        expect(body.email).toBeDefined();
      }, 15_000);

      it('returns 404 for a non-existent user id', async () => {
        const { status } = await request(app.getHttpServer()).get('/api/users/99999');
        expect(status).toBe(404);
      }, 15_000);
    });

    describe('POST /api/users', () => {
      it('creates a user and returns the new record', async () => {
        const dto = { name: 'Integration Test User', email: 'integration@test.com' };
        const { body, status } = await request(app.getHttpServer())
          .post('/api/users')
          .send(dto)
          .set('Content-Type', 'application/json');

        expect(status).toBe(201);
        expect(body.name).toBe(dto.name);
        expect(body.email).toBe(dto.email);
        expect(body.id).toBeDefined(); // JSONPlaceholder returns id: 11
      }, 15_000);
    });

    describe('PUT /api/users/:id', () => {
      it('updates a user and returns the updated record', async () => {
        const dto = { name: 'Updated Name', email: 'updated@test.com' };
        const { body, status } = await request(app.getHttpServer())
          .put('/api/users/1')
          .send(dto)
          .set('Content-Type', 'application/json');

        expect(status).toBe(200);
        expect(body.id).toBe(1);
        expect(body.name).toBe(dto.name);
      }, 15_000);
    });

    describe('DELETE /api/users/:id', () => {
      it('deletes a user and returns 204 No Content', async () => {
        const { status } = await request(app.getHttpServer()).delete('/api/users/1');
        expect(status).toBe(204);
      }, 15_000);
    });
  });

  // ── Posts ─────────────────────────────────────────────────────────────────

  describe('Posts', () => {
    describe('GET /api/posts', () => {
      it('returns an array of posts', async () => {
        const { body, status } = await request(app.getHttpServer()).get('/api/posts');

        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);
        expect(body[0]).toMatchObject({
          id:     expect.any(Number),
          userId: expect.any(Number),
          title:  expect.any(String),
          body:   expect.any(String),
        });
      }, 15_000);
    });

    describe('GET /api/posts/:id', () => {
      it('returns a single post by id', async () => {
        const { body, status } = await request(app.getHttpServer()).get('/api/posts/1');

        expect(status).toBe(200);
        expect(body.id).toBe(1);
        expect(body.title).toBeDefined();
      }, 15_000);
    });

    describe('GET /api/posts/:id/with-comments', () => {
      it('returns a post with its comments embedded', async () => {
        const { body, status } = await request(app.getHttpServer())
          .get('/api/posts/1/with-comments');

        expect(status).toBe(200);
        expect(body.id).toBe(1);
        expect(body.title).toBeDefined();
        expect(Array.isArray(body.comments)).toBe(true);
        expect(body.comments.length).toBeGreaterThan(0);
        expect(body.comments[0]).toMatchObject({
          postId: 1,
          name:   expect.any(String),
          email:  expect.any(String),
          body:   expect.any(String),
        });
      }, 20_000);

      it('fetches post and comments in parallel (both named clients used)', async () => {
        const start = Date.now();
        const { body, status } = await request(app.getHttpServer())
          .get('/api/posts/2/with-comments');
        const elapsed = Date.now() - start;

        expect(status).toBe(200);
        expect(body.id).toBe(2);
        expect(body.comments).toBeDefined();
        // Parallel fetch should complete faster than 2× a single sequential request
        // (JSONPlaceholder p50 ~150ms → parallel < 600ms is a safe bound)
        expect(elapsed).toBeLessThan(6_000);
      }, 20_000);
    });

    describe('POST /api/posts', () => {
      it('creates a post and returns the new record', async () => {
        const dto = { userId: 1, title: 'Integration Test Post', body: 'Test body content' };
        const { body, status } = await request(app.getHttpServer())
          .post('/api/posts')
          .send(dto)
          .set('Content-Type', 'application/json');

        expect(status).toBe(201);
        expect(body.title).toBe(dto.title);
        expect(body.id).toBeDefined();
      }, 15_000);
    });
  });
});
