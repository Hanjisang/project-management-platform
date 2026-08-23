import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ZentaoClient } from './zentao.client';
import { ZentaoController } from './zentao.controller';
import { ZentaoMapper } from './zentao.mapper';
import { ZentaoService } from './zentao.service';
@Module({
  imports: [AuthModule],
  controllers: [ZentaoController],
  providers: [ZentaoClient, ZentaoMapper, ZentaoService],
})
export class ZentaoModule {}
