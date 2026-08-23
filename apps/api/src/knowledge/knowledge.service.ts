import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type KnowledgeStatus } from '@prisma/client';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../documents/storage.provider';
import type {
  CreateKnowledgeArticleDto,
  CreateKnowledgeCategoryDto,
  DepositDocumentDto,
  ReviewKnowledgeArticleDto,
  UpdateKnowledgeArticleDto,
} from './dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  categories() {
    return this.prisma.knowledgeCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  createCategory(dto: CreateKnowledgeCategoryDto) {
    return this.prisma.knowledgeCategory.create({ data: { name: dto.name.trim() } });
  }
  list(user: RequestUser, search?: string, categoryId?: string, status?: KnowledgeStatus) {
    const visibility: Prisma.KnowledgeArticleWhereInput = user.isAdministrator
      ? {}
      : {
          OR: [
            { status: 'PUBLISHED' },
            { authorId: user.id },
            { sourceProject: { members: { some: { userId: user.id } } } },
          ],
        };
    const searchClause: Prisma.KnowledgeArticleWhereInput = search
      ? {
          OR: [
            { title: { contains: search } },
            { summary: { contains: search } },
            { content: { contains: search } },
          ],
        }
      : {};
    return this.prisma.knowledgeArticle.findMany({
      where: {
        deletedAt: null,
        ...(categoryId ? { categoryId } : {}),
        ...(status ? { status } : {}),
        AND: [visibility, searchClause],
      },
      include: {
        category: true,
        author: { select: { id: true, displayName: true } },
        reviewer: { select: { id: true, displayName: true } },
        attachments: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
  }
  async get(user: RequestUser, id: string) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        author: { select: { id: true, displayName: true } },
        reviewer: { select: { id: true, displayName: true } },
        attachments: true,
      },
    });
    if (!article) throw this.notFound();
    if (article.status !== 'PUBLISHED' && article.authorId !== user.id && !user.isAdministrator) {
      if (!article.sourceProjectId) throw this.denied();
      await this.scope.assert(user, article.sourceProjectId);
    }
    return article;
  }
  async create(user: RequestUser, dto: CreateKnowledgeArticleDto) {
    if (dto.sourceProjectId) await this.scope.assert(user, dto.sourceProjectId);
    return this.prisma.knowledgeArticle.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags ?? [],
        sourceProjectId: dto.sourceProjectId,
        sourceDocumentId: dto.sourceDocumentId,
        authorId: user.id,
      },
    });
  }
  async update(user: RequestUser, id: string, dto: UpdateKnowledgeArticleDto) {
    const article = await this.get(user, id);
    if (article.authorId !== user.id && !user.isAdministrator) throw this.denied();
    if (!['DRAFT', 'REJECTED'].includes(article.status))
      throw new ConflictException({
        code: 'KNOWLEDGE_ARTICLE_IMMUTABLE',
        message: '只能编辑草稿或已驳回文章',
      });
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { ...dto, tags: dto.tags, status: 'DRAFT', reviewComment: null },
    });
  }
  async submit(user: RequestUser, id: string) {
    const article = await this.get(user, id);
    if (article.authorId !== user.id && !user.isAdministrator) throw this.denied();
    if (!['DRAFT', 'REJECTED'].includes(article.status))
      throw new ConflictException({
        code: 'KNOWLEDGE_STATUS_INVALID',
        message: '当前状态无法提交审核',
      });
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { status: 'PENDING_REVIEW', reviewerId: null, reviewComment: null },
    });
  }
  async review(user: RequestUser, id: string, dto: ReviewKnowledgeArticleDto) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id, deletedAt: null },
    });
    if (!article) throw this.notFound();
    if (article.status !== 'PENDING_REVIEW')
      throw new ConflictException({
        code: 'KNOWLEDGE_STATUS_INVALID',
        message: '文章不在待审核状态',
      });
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        status: dto.status,
        reviewerId: user.id,
        reviewComment: dto.comment,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }
  async uploadAttachment(
    user: RequestUser,
    articleId: string,
    file: Express.Multer.File | undefined,
  ) {
    const article = await this.get(user, articleId);
    this.assertAuthor(user, article.authorId);
    this.validateAttachment(file);
    if (!['DRAFT', 'REJECTED'].includes(article.status))
      throw new ConflictException({
        code: 'KNOWLEDGE_ARTICLE_IMMUTABLE',
        message: '只能为草稿或已驳回文章维护附件',
      });
    const stored = await this.storage.put(file.originalname, file.buffer);
    try {
      return await this.prisma.knowledgeAttachment.create({
        data: {
          articleId,
          objectKey: stored.objectKey,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: stored.size,
          checksum: stored.checksum,
        },
      });
    } catch (error) {
      try {
        await this.storage.delete(stored.objectKey);
      } catch (cleanupError) {
        try {
          await this.prisma.storageCleanupJob.upsert({
            where: { objectKey: stored.objectKey },
            create: {
              objectKey: stored.objectKey,
              reason: `knowledge-attachment-create-rollback:${articleId}`,
              attempts: 1,
              lastError:
                cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            },
            update: {
              attempts: { increment: 1 },
              lastError:
                cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            },
          });
        } catch (trackingError) {
          throw new AggregateError(
            [error, cleanupError, trackingError],
            '知识附件数据库写入及文件回滚追踪同时失败',
          );
        }
      }
      throw error;
    }
  }
  async downloadAttachment(user: RequestUser, id: string) {
    const attachment = await this.prisma.knowledgeAttachment.findUnique({
      where: { id },
      include: { article: true },
    });
    if (!attachment || attachment.article.deletedAt)
      throw new NotFoundException({
        code: 'KNOWLEDGE_ATTACHMENT_NOT_FOUND',
        message: '知识库附件不存在',
      });
    await this.get(user, attachment.articleId);
    return {
      buffer: await this.storage.get(attachment.objectKey),
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }
  async removeAttachment(user: RequestUser, id: string) {
    const attachment = await this.prisma.knowledgeAttachment.findUnique({
      where: { id },
      include: { article: true },
    });
    if (!attachment || attachment.article.deletedAt)
      throw new NotFoundException({
        code: 'KNOWLEDGE_ATTACHMENT_NOT_FOUND',
        message: '知识库附件不存在',
      });
    this.assertAuthor(user, attachment.article.authorId);
    if (!['DRAFT', 'REJECTED'].includes(attachment.article.status))
      throw new ConflictException({
        code: 'KNOWLEDGE_ARTICLE_IMMUTABLE',
        message: '只能为草稿或已驳回文章维护附件',
      });
    await this.prisma.knowledgeAttachment.delete({ where: { id } });
    try {
      await this.storage.delete(attachment.objectKey);
    } catch (error) {
      await this.prisma.storageCleanupJob.upsert({
        where: { objectKey: attachment.objectKey },
        create: {
          objectKey: attachment.objectKey,
          reason: `knowledge-attachment:${id}`,
          attempts: 1,
          lastError: error instanceof Error ? error.message : String(error),
        },
        update: {
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  async deposit(user: RequestUser, documentId: string, dto: DepositDocumentDto) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!document)
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在' });
    await this.scope.assert(user, document.projectId);
    if (document.status !== 'APPROVED')
      throw new ConflictException({
        code: 'DOCUMENT_NOT_APPROVED',
        message: '只有审核通过的项目文档可沉淀到知识库',
      });
    return this.prisma.knowledgeArticle.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title?.trim() ?? document.name,
        summary: document.description,
        content: `来源交付文档：${document.name}\n最新版本：${document.versions[0]?.version ?? '-'}`,
        sourceProjectId: document.projectId,
        sourceDocumentId: document.id,
        authorId: user.id,
      },
    });
  }
  async remove(user: RequestUser, id: string) {
    const article = await this.get(user, id);
    if (article.authorId !== user.id && !user.isAdministrator) throw this.denied();
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }
  private notFound() {
    return new NotFoundException({
      code: 'KNOWLEDGE_ARTICLE_NOT_FOUND',
      message: '知识文章不存在',
    });
  }
  private denied() {
    return new ForbiddenException({
      code: 'KNOWLEDGE_ACCESS_DENIED',
      message: '无权访问该知识文章',
    });
  }
  private assertAuthor(user: RequestUser, authorId: string): void {
    if (authorId !== user.id && !user.isAdministrator) throw this.denied();
  }
  private validateAttachment(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file)
      throw new BadRequestException({
        code: 'KNOWLEDGE_ATTACHMENT_REQUIRED',
        message: '请选择附件',
      });
    if (file.size <= 0 || file.size > 20 * 1024 * 1024)
      throw new BadRequestException({
        code: 'KNOWLEDGE_ATTACHMENT_SIZE_INVALID',
        message: '附件大小必须在 20MB 以内',
      });
  }
}
