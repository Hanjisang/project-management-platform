import { HttpException, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AI_PROVIDER, type AiProvider } from '../integrations/ai/ai.provider';
import { ProgressService } from '../project-plans/progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentContentExtractor } from './document-content-extractor';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

@Injectable()
export class DocumentAiReviewWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: DocumentContentExtractor,
    private readonly progress: ProgressService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async onModuleInit() {
    await this.prisma.aiReviewJob.updateMany({
      where: { status: 'RUNNING', claimedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      data: { status: 'PENDING', claimedAt: null, nextRunAt: new Date() },
    });
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.claim();
      if (job) await this.process(job.id);
    } finally {
      this.running = false;
    }
  }

  private async claim() {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.aiReviewJob.findFirst({
        where: { status: 'PENDING', nextRunAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
      });
      if (!candidate) return null;
      const claimed = await tx.aiReviewJob.updateMany({
        where: { id: candidate.id, status: 'PENDING' },
        data: { status: 'RUNNING', claimedAt: new Date(), attempts: { increment: 1 } },
      });
      return claimed.count === 1 ? candidate : null;
    });
  }

  private async process(jobId: string) {
    const job = await this.prisma.aiReviewJob.findUnique({
      where: { id: jobId },
      include: {
        documentVersion: {
          include: {
            document: {
              include: {
                project: true,
                workItem: true,
                projectDeliverable: {
                  include: { reviewCriteria: { orderBy: { sortOrder: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });
    if (!job) return;
    const version = job.documentVersion;
    const document = version.document;
    const deliverable = document.projectDeliverable;
    if (!deliverable || !document.workItemId)
      return this.fail(jobId, version.id, 'AI_REVIEW_UNSUPPORTED_FILE', '文档未关联项目交付物');
    try {
      const content = await this.extractor.extract(
        await this.storage.get(version.objectKey),
        version.fileName,
        version.mimeType,
      );
      if (!content.trim()) throw new Error('提取内容为空');
      const result = await this.ai.reviewDocument({
        project: { id: document.project.id, name: document.project.name },
        deliverable: {
          name: deliverable.name,
          description: deliverable.description,
          reviewMode: deliverable.reviewMode,
          instruction: deliverable.aiReviewInstruction,
          threshold: deliverable.aiAutoApproveThreshold,
        },
        criteria: deliverable.reviewCriteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          description: criterion.description,
          required: criterion.required,
          weight: criterion.weight,
        })),
        content,
      });
      const resultByCriterion = new Map(
        result.criteriaResults.map((entry) => [entry.criterionId, entry]),
      );
      const requiredPassed = deliverable.reviewCriteria
        .filter((criterion) => criterion.required)
        .every((criterion) => resultByCriterion.get(criterion.id)?.passed === true);
      const threshold = deliverable.aiAutoApproveThreshold ?? 85;
      const approved =
        result.decision === 'APPROVED' && result.score >= threshold && requiredPassed;
      const status = approved ? 'APPROVED' : 'REJECTED';
      await this.prisma.$transaction(async (tx) => {
        const pending = await tx.documentVersionReview.findFirst({
          where: { documentVersionId: version.id, reviewType: 'AI', status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        const review = pending
          ? await tx.documentVersionReview.update({
              where: { id: pending.id },
              data: {
                status,
                aiProvider: this.ai.status().provider,
                aiModel: this.ai.status().model,
                score: result.score,
                summary: result.summary,
                decisionReason: approved ? '达到自动通过阈值且所有必需标准通过' : result.decision,
                reviewedAt: new Date(),
              },
            })
          : await tx.documentVersionReview.create({
              data: {
                documentVersionId: version.id,
                reviewType: 'AI',
                status,
                aiProvider: this.ai.status().provider,
                aiModel: this.ai.status().model,
                score: result.score,
                summary: result.summary,
                decisionReason: result.decision,
                reviewedAt: new Date(),
              },
            });
        const validCriterionIds = new Set(
          deliverable.reviewCriteria.map((criterion) => criterion.id),
        );
        const criterionRows: Prisma.DocumentReviewCriterionResultCreateManyInput[] =
          result.criteriaResults
            .filter((entry) => validCriterionIds.has(entry.criterionId))
            .map((entry) => ({
              reviewId: review.id,
              criterionId: entry.criterionId,
              passed: entry.passed,
              score: entry.score,
              explanation: entry.explanation,
            }));
        if (criterionRows.length)
          await tx.documentReviewCriterionResult.createMany({ data: criterionRows });
        if (result.findings.length)
          await tx.reviewFinding.createMany({
            data: result.findings.map((finding, sortOrder) => ({
              reviewId: review.id,
              criterionId: finding.criterionId,
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              suggestion: finding.suggestion,
              sortOrder,
            })),
          });
        await tx.aiReviewJob.update({
          where: { id: jobId },
          data: { status: 'SUCCEEDED', completedAt: new Date(), lastError: null },
        });
        const finalDocumentStatus =
          deliverable.reviewMode === 'AI_WITH_HUMAN_OVERRIDE' && approved
            ? 'APPROVED'
            : 'PENDING_REVIEW';
        await tx.document.update({
          where: { id: document.id },
          data: { status: finalDocumentStatus },
        });
        const recipient = document.workItem?.ownerUserId ?? document.project.managerUserId;
        await tx.notification.create({
          data: {
            userId: recipient,
            projectId: document.projectId,
            type: approved
              ? 'DELIVERABLE_AI_REVIEW_COMPLETED'
              : 'DELIVERABLE_HUMAN_REVIEW_REQUIRED',
            title: approved ? 'AI 审核已通过' : '交付物需要人工审核',
            content: `${deliverable.name}：${result.summary}`,
            resourceType: 'DocumentVersion',
            resourceId: version.id,
          },
        });
        await this.progress.recomputeWorkItem(document.workItemId!, tx);
      });
    } catch (error) {
      await this.fail(
        jobId,
        version.id,
        this.errorCode(error),
        error instanceof Error ? error.message : String(error),
        document.workItemId,
        document.projectId,
        document.workItem?.ownerUserId ?? document.project.managerUserId,
      );
    }
  }

  private async fail(
    jobId: string,
    versionId: string,
    code: string,
    message: string,
    workItemId?: string | null,
    projectId?: string,
    userId?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.aiReviewJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', completedAt: new Date(), lastError: `${code}: ${message}` },
      });
      const pending = await tx.documentVersionReview.findFirst({
        where: { documentVersionId: versionId, reviewType: 'AI', status: 'PENDING' },
      });
      if (pending)
        await tx.documentVersionReview.update({
          where: { id: pending.id },
          data: { status: 'FAILED', decisionReason: message, reviewedAt: new Date() },
        });
      if (projectId && userId)
        await tx.notification.create({
          data: {
            userId,
            projectId,
            type: 'DELIVERABLE_HUMAN_REVIEW_REQUIRED',
            title: 'AI 审核失败',
            content: '可重新发起 AI 审核或转人工审核',
            resourceType: 'DocumentVersion',
            resourceId: versionId,
          },
        });
      if (workItemId) await this.progress.recomputeWorkItem(workItemId, tx);
    });
  }

  private errorCode(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (
        typeof response === 'object' &&
        response &&
        'code' in response &&
        typeof response.code === 'string'
      )
        return response.code;
    }
    return 'AI_REVIEW_FAILED';
  }
}
