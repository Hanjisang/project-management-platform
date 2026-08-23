# 数据模型

完整 Prisma 模型及索引说明见 [DATABASE.md](DATABASE.md)。V2 使用规范化关系模型，不以 JSON 作为正式业务数据库；JSON 字段只承载消息原文、AI 结果、报表快照等天然半结构化数据。

最重要的领域分离是 SopTask（模板要求）、ProjectPlanTask（项目执行快照）和 Task（实际工作项）。ProjectMember 独立于平台 Role，Document 独立于 DocumentVersion，MessageAnalysis/PendingAction 独立于正式业务实体。
