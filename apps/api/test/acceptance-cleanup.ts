import { PrismaClient } from '@prisma/client';

export async function cleanupAcceptanceData(input: {
  projectIds: string[];
  templateId: string;
  usernamePrefix: string;
}): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.message.deleteMany({ where: { projectId: { in: input.projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: input.projectIds } } });
    await prisma.sopTemplate.deleteMany({ where: { id: input.templateId } });
    await prisma.user.deleteMany({ where: { username: { startsWith: input.usernamePrefix } } });
  } finally {
    await prisma.$disconnect();
  }
}
