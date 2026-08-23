import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER, type StorageProvider } from '../documents/storage.provider';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  @Public()
  @Get()
  async health() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'HEALTH_DATABASE_DOWN',
        message: '数据库健康检查失败',
        details: { database: { status: 'down', latencyMs: Date.now() - started } },
      });
    }
    const storage = await this.storage.health();
    if (!storage.configured)
      throw new ServiceUnavailableException({
        code: 'HEALTH_STORAGE_UNAVAILABLE',
        message: '存储健康检查失败',
        details: { storage },
      });
    return {
      status: 'ok',
      database: { status: 'up', latencyMs: Date.now() - started },
      storage,
      integrations: {
        ai: {
          configured:
            this.config.get('AI_ENABLED', 'false') === 'true' &&
            Boolean(this.config.get('AI_API_KEY')),
        },
        dingtalk: { configured: Boolean(this.config.get('DINGTALK_APP_SECRET')) },
        zentao: { configured: Boolean(this.config.get('ZENTAO_BASE_URL')) },
      },
    };
  }
}
