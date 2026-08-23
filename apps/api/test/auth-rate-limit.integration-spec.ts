import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestIdMiddleware } from '../src/common/request-id.middleware';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)('Auth login rate limit against MySQL', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = 'rate-limit-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'rate-limit-refresh-secret-at-least-32-characters';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.setGlobalPrefix('api/v2', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('allows recovery from one bad password and returns 429 at the configured burst threshold', async () => {
    const server = app.getHttpServer();
    const username = process.env.ADMIN_USERNAME ?? 'acceptance_admin';
    await request(server)
      .post('/api/v2/auth/login')
      .send({ username, password: 'one-wrong-password' })
      .expect(401);
    await request(server)
      .post('/api/v2/auth/login')
      .send({ username, password: process.env.ADMIN_PASSWORD ?? 'acceptance-admin-password' })
      .expect(200);
    for (let attempt = 0; attempt < 3; attempt += 1)
      await request(server)
        .post('/api/v2/auth/login')
        .send({ username: `missing-user-${attempt}`, password: 'another-wrong-password' })
        .expect(401);
    const throttled = await request(server)
      .post('/api/v2/auth/login')
      .send({ username: 'missing-user-final', password: 'another-wrong-password' })
      .expect(429);
    expect(throttled.body.code).toBe('RATE_LIMITED');
  });
});
