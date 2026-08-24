# 数据库设计

数据库使用 MySQL 8、utf8mb4 和 Prisma，权威模型在 `apps/api/prisma/schema.prisma`。生产使用 `npm run db:migrate:deploy`，开发创建迁移使用 `npm run db:migrate`，禁止用 `db push` 替代迁移。

核心实体组：

- 身份权限：User、Role、Permission、ProjectMember、RefreshToken
- SOP 模板：SopTemplate、SopVersion、SopStage、SopTask、SopChecklistItem、SopDeliverable、SopDeliverableCriterion、SopDeliverableTemplate
- 项目执行快照：ProjectPlan、ProjectStage、ProjectWorkItem、ProjectChecklistItem、ProjectDeliverable、ProjectDeliverableCriterion、ProjectDeliverableTemplate
- 版本审查：Document、DocumentVersion、DocumentVersionReview、DocumentReviewFinding、DocumentCriterionResult、AiReviewJob
- 变更控制：ProjectChangeRequest、ProjectChangeOperation、ProjectChangeApproval、ProjectBaseline 及其阶段/工作项/检查项/交付物快照、ProjectAdjustmentLog、Notification
- 其他业务：Issue、Message/MessageAnalysis/PendingAction、Report、Knowledge、AuditLog、ZentaoTaskSync

`ProjectWorkItem` 是唯一项目执行实体。SOP 生成的 WorkItem 保存 `sourceSopTaskId/sourceSopTaskKey` 和全部检查项、交付物、准则、模板快照；手工 WorkItem 使用 `sourceType=MANUAL`。Document 通过 `projectDeliverableId` 关联交付物，ZentaoTaskSync 通过 `workItemId` 关联工作项。

审查结论以 `documentVersionId` 为边界。`AiReviewJob.documentVersionId` 唯一，保证同一版本排队与重试幂等；人工和 AI 结果可并存，最终有效结论由 review mode 决定。

## 迁移与回滚

`20260824200000_execution_domain_redesign` 是数据保留迁移：原 ProjectPlanStage 原位改名；每个旧计划主 Task 合并为 WorkItem；附加 Task 转为子 WorkItem；独立 Task 放入可选手工计划的“临时任务”阶段；Checklist、Deliverable、Document、旧人工审查和 ZenTao 映射一并迁移。迁移在发现无法判定的审查或 ID 冲突时主动失败，不静默丢数据，最后才删除旧表。

开发/UAT 可从空库执行全部 migration + seed。生产发布前必须备份并在副本演练迁移，核对 WorkItem、文档版本、审查和 ZenTao 映射数量。由于迁移会删除旧双轨表，代码回滚必须同时恢复发布前数据库备份，不能仅回滚应用镜像。
