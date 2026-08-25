import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { ExecutionIntegrityService } from './execution-integrity.service';
import { ProjectPlansController } from './project-plans.controller';
import { ProjectPlansService } from './project-plans.service';
import { ProgressService } from './progress.service';

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [ProjectPlansController],
  providers: [ProjectPlansService, ProgressService, ExecutionIntegrityService],
  exports: [ProjectPlansService, ProgressService, ExecutionIntegrityService],
})
export class ProjectPlansModule {}
