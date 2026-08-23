import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)('API core flow integration', () => {
  let app: INestApplication;
  let prisma: PrismaServiceType;
  let agent: ReturnType<typeof request.agent>;
  let csrfToken = '';
  let userId = '';
  let projectId = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'integration-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'integration-refresh-secret-at-least-32-characters';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.AI_ENABLED = 'false';
    process.env.AI_FAKE_ENABLED = 'false';
    const { AppModule } = await import('../src/app.module');
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.setGlobalPrefix('api/v2', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (app) await app.close();
  });

  it('authenticates the seeded administrator and rotates secure session state', async () => {
    const response = await agent
      .post('/api/v2/auth/login')
      .send({
        username: process.env.ADMIN_USERNAME ?? 'admin',
        password: process.env.ADMIN_PASSWORD ?? 'integration-admin-password',
      })
      .expect(200);
    expect(response.body.data.user.isAdministrator).toBe(true);
    userId = response.body.data.user.id as string;
    const csrfCookie = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith('csrf_token='),
    );
    csrfToken = csrfCookie?.split(';')[0]?.split('=')[1] ?? '';
    expect(csrfToken).not.toBe('');
    await agent.get('/api/v2/auth/me').expect(200);
  });

  it('creates a project and enforces the project lifecycle precondition', async () => {
    const code = `IT${Date.now()}`;
    const created = await agent
      .post('/api/v2/projects')
      .set('x-csrf-token', csrfToken)
      .send({ code, name: '集成测试项目', customerName: '测试客户', managerUserId: userId })
      .expect(201);
    projectId = created.body.data.id as string;
    expect(created.body.data.members).toHaveLength(1);
    const start = await agent
      .post(`/api/v2/projects/${projectId}/start`)
      .set('x-csrf-token', csrfToken)
      .send({})
      .expect(409);
    expect(start.body.code).toBe('PROJECT_PLAN_REQUIRED');
  });

  it('keeps AI explicitly unavailable when no key is configured', async () => {
    const status = await agent.get('/api/v2/messages/ai-status').expect(200);
    expect(status.body.data).toMatchObject({ configured: false, provider: 'openai-compatible' });
  });
});
