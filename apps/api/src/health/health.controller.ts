import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  @Public()
  @Get()
  async health() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: { status: 'up', latencyMs: Date.now() - started },
        storage: {
          provider: this.config.get<string>('STORAGE_PROVIDER', 'local'),
          configured: true,
        },
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
    } catch {
      throw new ServiceUnavailableException({
        code: 'HEALTH_DATABASE_DOWN',
        message: '数据库健康检查失败',
        details: { database: { status: 'down', latencyMs: Date.now() - started } },
      });
    }
  }
}
