import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end tests for the super-http NestJS example application.
 *
 * These tests spin up the full NestJS application and make real HTTP requests
 * to JSONPlaceholder (https://jsonplaceholder.typicode.com). Run them only in
 * environments with internet access.
 *
 * To run: npm run test:e2e
 */
describe('AppModule (e2e)', () => {
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
    it('returns welcome message', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api')
        .expect(200);

      expect(body.message).toContain('super-http');
      expect(body.docs).toBeDefined();
    });
  });

  // ── Health ────────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns a health object with status ok', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(body.status).toMatch(/^(ok|degraded)$/);
      expect(typeof body.uptime).toBe('number');
      expect(body.http).toBeDefined();
      expect(body.http.successRate).toMatch(/\d+\.\d+%/);
    });
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('returns an array of users from JSONPlaceholder', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/users')
        .expect(200);

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
    it('returns a single user', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/users/1')
        .expect(200);

      expect(body.id).toBe(1);
      expect(body.name).toBeDefined();
    }, 15_000);

    it('returns 404 for a non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/api/users/99999')
        .expect(404);
    }, 15_000);
  });

  // ── Posts ─────────────────────────────────────────────────────────────────

  describe('GET /api/posts', () => {
    it('returns an array of posts', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/posts')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    }, 15_000);
  });

  describe('GET /api/posts/:id/with-comments', () => {
    it('returns a post with its comments embedded', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/posts/1/with-comments')
        .expect(200);

      expect(body.id).toBe(1);
      expect(Array.isArray(body.comments)).toBe(true);
      expect(body.comments.length).toBeGreaterThan(0);
    }, 20_000);
  });
});
