import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main(): Promise<void> {
  const template = await prisma.sopTemplate.upsert({
    where: { code: 'DEMO_MEDICAL_IMPLEMENTATION' },
    create: {
      code: 'DEMO_MEDICAL_IMPLEMENTATION',
      name: '医疗信息化实施标准 SOP',
      description: '显式执行 Demo Seed 创建的样例模板',
    },
    update: {},
  });
  const exists = await prisma.sopVersion.findUnique({
    where: { templateId_version: { templateId: template.id, version: 'V1.0' } },
  });
  if (!exists)
    await prisma.sopVersion.create({
      data: {
        templateId: template.id,
        version: 'V1.0',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        stages: {
          create: [
            {
              name: '事前准备',
              sortOrder: 0,
              defaultDurationDays: 5,
              weight: 20,
              tasks: {
                create: [
                  {
                    name: '环境与资料确认',
                    sortOrder: 0,
                    defaultDurationDays: 5,
                    weight: 100,
                    required: true,
                    deliverables: {
                      create: [
                        {
                          name: '环境与资料确认记录',
                          sortOrder: 0,
                          required: true,
                        },
                      ],
                    },
                    checklistItems: {
                      create: [{ name: '环境部署记录已确认', sortOrder: 0, required: true }],
                    },
                  },
                ],
              },
            },
            {
              name: '接口对接',
              sortOrder: 1,
              defaultDurationDays: 15,
              weight: 60,
              tasks: {
                create: [
                  {
                    name: '接口文档确认',
                    sortOrder: 0,
                    defaultDurationDays: 5,
                    weight: 34,
                    required: true,
                    deliverables: {
                      create: [
                        {
                          name: '接口文档确认记录',
                          description: '请在草稿版本中上传正式模板文件。',
                          sortOrder: 0,
                          required: true,
                        },
                      ],
                    },
                  },
                  {
                    name: '接口开发联调',
                    sortOrder: 1,
                    defaultDurationDays: 10,
                    weight: 66,
                    required: true,
                  },
                ],
              },
            },
            {
              name: '上线试运行',
              sortOrder: 2,
              defaultDurationDays: 5,
              weight: 20,
              tasks: {
                create: [
                  {
                    name: '上线切换与验收',
                    sortOrder: 0,
                    defaultDurationDays: 5,
                    weight: 100,
                    required: true,
                    deliverables: {
                      create: [
                        {
                          name: '上线确认单',
                          description: '请在草稿版本中上传正式模板文件。',
                          sortOrder: 0,
                          required: true,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
}
void main().finally(() => prisma.$disconnect());
