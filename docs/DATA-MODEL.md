# 数据模型

完整 Prisma 模型、迁移和回滚说明见 [DATABASE.md](DATABASE.md)。V2 使用规范化关系模型；JSON 只承载 AI 原始结构化结果、变更 operation payload、消息原文和报表快照等天然半结构化数据。

SopTask 是可版本化模板定义，ProjectWorkItem 是生成后的唯一执行事实，两者之间是快照来源关系，不是运行时双写。Document 与 DocumentVersion 分离，所有 AI/人工审查、问题项和准则结果绑定具体版本。ProjectBaseline 是批准计划快照，ProjectChangeRequest 只能经指定 approver 审批后事务应用并产生新基线。
