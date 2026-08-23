import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectUserOptionsController, ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';
@Module({
  imports: [AuthModule],
  controllers: [ProjectsController, ProjectUserOptionsController],
  providers: [ProjectsRepository, ProjectsService],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
