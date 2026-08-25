import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectPlansModule } from '../project-plans/project-plans.module';
import { ProjectsModule } from '../projects/projects.module';
import { DocumentsModule } from '../documents/documents.module';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';

@Module({
  imports: [AuthModule, ProjectsModule, ProjectPlansModule, DocumentsModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService],
  exports: [WorkItemsService],
})
export class WorkItemsModule {}
