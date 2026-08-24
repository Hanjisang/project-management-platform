import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { ProjectPlansModule } from '../project-plans/project-plans.module';
import { ProjectChangesController } from './project-changes.controller';
import { ProjectChangesService } from './project-changes.service';
@Module({
  imports: [AuthModule, DocumentsModule, ProjectPlansModule],
  controllers: [ProjectChangesController],
  providers: [ProjectChangesService],
  exports: [ProjectChangesService],
})
export class ProjectChangesModule {}
