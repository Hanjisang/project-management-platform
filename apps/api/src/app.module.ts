import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CsrfGuard } from './auth/csrf.guard';
import { PermissionGuard } from './auth/permission.guard';
import { ProjectAccessGuard } from './auth/project-access.guard';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { ApiResponseInterceptor } from './common/api-response.interceptor';
import { AuditInterceptor } from './audit/audit.interceptor';
import { validateEnvironment } from './config/environment';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';
import { SopModule } from './sop/sop.module';
import { ProjectPlansModule } from './project-plans/project-plans.module';
import { WorkItemsModule } from './work-items/work-items.module';
import { ProjectChangesModule } from './project-changes/project-changes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IssuesModule } from './issues/issues.module';
import { DocumentsModule } from './documents/documents.module';
import { AiModule } from './integrations/ai/ai.module';
import { MessagesModule } from './messages/messages.module';
import { ReportsModule } from './reports/reports.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DingtalkModule } from './integrations/dingtalk/dingtalk.module';
import { ZentaoModule } from './integrations/zentao/zentao.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.x-csrf-token',
          'res.headers["set-cookie"]',
          'password',
          'token',
          'AI_API_KEY',
          'DINGTALK_APP_SECRET',
          'ZENTAO_TOKEN',
        ],
        customProps: (request) => ({ requestId: request.id }),
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    AuditModule,
    HealthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
    SopModule,
    ProjectPlansModule,
    WorkItemsModule,
    ProjectChangesModule,
    NotificationsModule,
    IssuesModule,
    DocumentsModule,
    AiModule,
    MessagesModule,
    ReportsModule,
    KnowledgeModule,
    DashboardModule,
    DingtalkModule,
    ZentaoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: ProjectAccessGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
