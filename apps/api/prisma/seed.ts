import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@pmp/shared-constants';
import { seedPisImplementationSop } from './seed-sop-v1.9.2';

const prisma = new PrismaClient();
const permissionNames: Record<string, string> = {
  'project.view': '查看项目',
  'project.create': '创建项目',
  'project.edit': '编辑项目',
  'project.delete': '删除项目',
  'project.start': '启动项目',
  'project.pause': '暂停恢复项目',
  'project.close': '结项',
  'project.member.manage': '管理项目成员',
  'project.change.view': '查看项目变更',
  'project.change.create': '创建项目变更',
  'project.change.approve': '审批项目变更',
  'project.change.apply': '应用项目变更',
};

async function main(): Promise<void> {
  for (const code of ALL_PERMISSIONS)
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: permissionNames[code] ?? code },
      update: { name: permissionNames[code] ?? code },
    });
  const roleNames: Record<string, string> = {
    ADMINISTRATOR: '系统管理员',
    PROJECT_MANAGER: '项目经理',
    MEMBER: '项目成员',
    VIEWER: '只读用户',
  };
  for (const [code, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: roleNames[code] ?? code, system: true },
      update: { name: roleNames[code] ?? code, system: true },
    });
    const records = await prisma.permission.findMany({
      where: { code: { in: permissions } },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: records.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      });
    });
  }
  for (const [index, name] of [
    '实施经验',
    '常见问题',
    '操作手册',
    '接口规范',
    '产品资料',
    '培训资料',
    '项目案例',
  ].entries())
    await prisma.knowledgeCategory.upsert({
      where: { name },
      create: { name, sortOrder: index },
      update: { sortOrder: index },
    });
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  let sopTemplateUploaderId: string | null = null;
  if (username && password) {
    if (password.length < 10) throw new Error('ADMIN_PASSWORD must contain at least 10 characters');
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const user = await prisma.user.upsert({
      where: { username },
      create: {
        username,
        passwordHash: await bcrypt.hash(password, 12),
        displayName: process.env.ADMIN_DISPLAY_NAME || '系统管理员',
      },
      update: { displayName: process.env.ADMIN_DISPLAY_NAME || '系统管理员', status: 'ACTIVE' },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      create: { userId: user.id, roleId: adminRole.id },
      update: {},
    });
    sopTemplateUploaderId = user.id;
  }
  if (!sopTemplateUploaderId) {
    const administrator = await prisma.user.findFirst({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { code: 'ADMINISTRATOR' } } },
      },
      select: { id: true },
    });
    sopTemplateUploaderId = administrator?.id ?? null;
  }
  await seedPisImplementationSop(prisma, sopTemplateUploaderId);
}

void main().finally(() => prisma.$disconnect());
