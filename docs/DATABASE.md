# 数据库设计

数据库使用 MySQL 8、utf8mb4 和 Prisma。权威模型在 `apps/api/prisma/schema.prisma`，初始迁移在 `apps/api/prisma/migrations/20260823124500_v2_initial`。

主要实体组：

- 身份权限：User、Role、Permission、UserRole、RolePermission、RefreshToken
- 项目交付：Project、ProjectMember、ProjectNote、Task、Issue
- SOP 与计划：SopTemplate/Version/Stage/Task/ChecklistItem，ProjectPlan/Stage/Task/ChecklistItem
- 文档：Document、DocumentVersion、DocumentReview、StorageCleanupJob
- 消息：Message、MessageAnalysis、PendingAction
- 汇报与知识：DailyReport、WeeklyReport、KnowledgeCategory、KnowledgeArticle、KnowledgeAttachment
- 集成与审计：AuditLog、ZentaoTaskSync、IntegrationReplayNonce

软删除用于项目、用户、文档和知识文章等主体；唯一键用于消息外部 ID、待确认幂等状态、禅道任务映射和回调 nonce。计划快照保存 SOP 稳定键，以支持跨版本差异同步。

生产使用 `npm run db:migrate:deploy`，开发创建迁移使用 `npm run db:migrate`。禁止用 `db push` 替代生产迁移。
