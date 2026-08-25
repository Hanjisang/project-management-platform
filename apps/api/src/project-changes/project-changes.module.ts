import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { ProjectPlansModule } from '../project-plans/project-plans.module';
import { ProjectChangePostApplyService } from './project-change-post-apply.service';
import { ProjectChangesController } from './project-changes.controller';
import { ProjectChangesService } from './project-changes.service';

@Module({
  imports: [AuthModule, DocumentsModule, ProjectPlansModule],
  controllers: [ProjectChangesController],
  providers: [ProjectChangesService, ProjectChangePostApplyService],
  exports: [ProjectChangesService],
})
export class ProjectChangesModule {}
