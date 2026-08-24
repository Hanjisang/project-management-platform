import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageProvider } from './local-storage.provider';
import { S3CompatibleStorageProvider } from './s3-compatible-storage.provider';
import { STORAGE_PROVIDER } from './storage.provider';
import { ProgressService } from '../project-plans/progress.service';
import { DeliverableReviewDecisionService } from './deliverable-review-decision.service';
import { DocumentContentExtractor } from './document-content-extractor';
import { DocumentAiReviewWorker } from './document-ai-review.worker';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    ProgressService,
    DeliverableReviewDecisionService,
    DocumentContentExtractor,
    DocumentAiReviewWorker,
    LocalStorageProvider,
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
