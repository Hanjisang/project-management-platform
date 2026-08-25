import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { SopController } from './sop.controller';
import { SopService } from './sop.service';
@Module({
  imports: [DocumentsModule],
  controllers: [SopController],
  providers: [SopService],
  exports: [SopService],
})
export class SopModule {}
