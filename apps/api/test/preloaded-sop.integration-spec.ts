import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PIS_IMPLEMENTATION_SOP_CODE,
  PIS_IMPLEMENTATION_SOP_VERSION,
  seedPisImplementationSop,
} from '../prisma/seed-sop-v1.9.2';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)('preloaded PIS implementation SOP', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  });
  let storagePath = '';

  beforeAll(async () => {
    storagePath = await mkdtemp(join(tmpdir(), 'pmp-sop-seed-'));
    process.env.STORAGE_PATH = storagePath;
    const administrator = await prisma.user.findFirstOrThrow({
      where: { roles: { some: { role: { code: 'ADMINISTRATOR' } } } },
      select: { id: true },
    });
    await seedPisImplementationSop(prisma, administrator.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (storagePath) await rm(storagePath, { recursive: true, force: true });
  });

  it('preloads the published V1.9.2 five-stage structure and all formal deliverables', async () => {
    const template = await prisma.sopTemplate.findUniqueOrThrow({
      where: { code: PIS_IMPLEMENTATION_SOP_CODE },
      include: {
        versions: {
          where: { version: PIS_IMPLEMENTATION_SOP_VERSION },
          include: {
            stages: {
              orderBy: { sortOrder: 'asc' },
              include: {
                tasks: {
                  orderBy: { sortOrder: 'asc' },
                  include: { checklistItems: true, deliverables: { include: { templates: true } } },
                },
              },
            },
          },
        },
      },
    });
    const version = template.versions[0];
    expect(version?.status).toBe('PUBLISHED');
    expect(version?.stages.map((stage) => stage.name)).toEqual([
      '01 事前准备',
      '02 实施执行',
      '03 试行验证',
      '04 上线切换',
      '05 验收交付',
    ]);
    const tasks = version?.stages.flatMap((stage) => stage.tasks) ?? [];
    const deliverables = tasks.flatMap((task) => task.deliverables);
    const templateFiles = deliverables.flatMap((deliverable) => deliverable.templates);
    expect(tasks).toHaveLength(36);
    expect(deliverables).toHaveLength(16);
    expect(templateFiles).toHaveLength(17);
    expect(deliverables.every((item) => item.required)).toBe(true);
    expect(deliverables.every((item) => item.reviewMode === 'HUMAN_ONLY')).toBe(true);
    expect(deliverables.every((item) => item.aiReviewEnabled === false)).toBe(true);
    expect(
      version?.stages.map((stage) =>
        stage.tasks.reduce((sum, task) => sum + task.deliverables.length, 0),
      ),
    ).toEqual([6, 3, 3, 2, 2]);
    const goLivePlan = deliverables.find((item) => item.name === '上线实施方案');
    expect(goLivePlan?.templates.map((item) => item.fileName).sort()).toEqual(
      ['上线实施方案_儿童医院.docx', '上线实施方案_标准模板_V1.0.docx'].sort(),
    );
  });

  it('materializes every seeded template into object storage with matching checksum and size', async () => {
    const files = await prisma.sopDeliverableTemplate.findMany({
      where: {
        deliverable: {
          task: {
            stage: {
              version: {
                template: { code: PIS_IMPLEMENTATION_SOP_CODE },
                version: PIS_IMPLEMENTATION_SOP_VERSION,
              },
            },
          },
        },
      },
      orderBy: { objectKey: 'asc' },
    });
    expect(files).toHaveLength(17);
    for (const file of files) {
      const content = await readFile(join(storagePath, file.objectKey));
      expect(BigInt(content.length)).toBe(file.size);
      expect(createHash('sha256').update(content).digest('hex')).toBe(file.checksum);
    }
  });
});
