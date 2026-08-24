import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ProgressService } from '../project-plans/progress.service';
import { DeliverableReviewDecisionService } from './deliverable-review-decision.service';
import { DocumentAiReviewWorker } from './document-ai-review.worker';
import { DocumentContentExtractor } from './document-content-extractor';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageProvider } from './local-storage.provider';
import { S3CompatibleStorageProvider } from './s3-compatible-storage.provider';
import { StorageCleanupWorker } from './storage-cleanup.worker';
import { STORAGE_PROVIDER } from './storage.provider';

const aiReviewTestProviders =
  process.env.NODE_ENV === 'test' ? [DocumentContentExtractor, DocumentAiReviewWorker] : [];

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    ProgressService,
    DeliverableReviewDecisionService,
    LocalStorageProvider,
    StorageCleanupWorker,
    ...aiReviewTestProviders,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider],
      useFactory: (config: ConfigService, local: LocalStorageProvider) =>
        config.get('STORAGE_PROVIDER', 'local') === 'local'
          ? local
          : new S3CompatibleStorageProvider(),
    },
  ],
  exports: [DocumentsService, STORAGE_PROVIDER, DeliverableReviewDecisionService],
})
export class DocumentsModule {}
