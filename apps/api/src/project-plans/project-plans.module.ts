import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectPlansController } from './project-plans.controller';
import { ProjectPlansService } from './project-plans.service';
import { ProgressService } from './progress.service';
@Module({
  imports: [AuthModule],
  controllers: [ProjectPlansController],
  providers: [ProjectPlansService, ProgressService],
  exports: [ProjectPlansService, ProgressService],
})
export class ProjectPlansModule {}
