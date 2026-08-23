# V2 架构

仓库采用 npm workspaces：`apps/web` 为 Vue SPA，`apps/api` 为 NestJS API，`packages/shared-*` 提供跨端类型、常量和纯函数。请求统一经过请求 ID、中间件、JWT/CSRF/RBAC/项目范围守卫、DTO 校验、统一响应与审计拦截器，再进入 Controller → Service → Repository/Prisma。

核心边界：

- 平台权限由 Role/Permission 决定；业务数据范围由 ProjectMember 决定，管理员可跨项目。
- SOP 发布版本不可变；项目生成独立计划快照，后续同步先预览稳定键差异，再以事务应用。
- Message 是所有消息来源的统一入口；AI 只产生 PendingAction，人工确认后才在可串行化事务中落正式数据。
- 文档文件由 StorageProvider 抽象承载；本地文件系统已实现，S3-compatible 保留明确扩展点并在未配置时失败关闭。
- 外部集成通过 Client、Service、Mapper 分层，数据库保存幂等键和同步状态。

生产拓扑为 Nginx Web → Nest API → MySQL，上传文件和数据库使用独立持久卷。API 提供 `/health`，Swagger 位于 `/api/docs`。
