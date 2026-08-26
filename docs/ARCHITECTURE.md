# V2 架构

仓库采用 npm workspaces：`apps/web` 为 Vue SPA，`apps/api` 为 NestJS API，`packages/shared-*` 提供跨端类型、常量和纯函数。请求统一经过请求 ID、中间件、JWT/CSRF/RBAC/项目范围守卫、DTO 校验、统一响应与审计拦截器，再进入 Controller → Service → Prisma。

## 核心执行域

`SOP Definition → Project Plan Snapshot → ProjectWorkItem → Checklist + Deliverable → Document/DocumentVersion Review → Progress → Change Request → New Baseline`

- `SopTask` 是模板定义，`ProjectWorkItem` 是项目实际执行单元，也是实施计划、任务中心、项目执行页共用的唯一任务事实源；不维护 `ProjectPlanTask + Task` 双轨。
- SOP Published 版本不可直接修改；项目生成独立快照。未启动且无执行/人工变更历史时可经过 Diff 安全同步；ACTIVE/PAUSED 项目不能直接重建计划绕过变更控制。
- 项目在正式 SOP Plan 生成前可以创建人工临时 WorkItem；满足安全条件时，后续生成正式计划会吸收临时 Plan 并保留人工任务，而不是删除或复制执行事实。
- Checklist 是 WorkItem 内的执行标准。正式 Deliverable 是一等实体，实际提交由 Document → DocumentVersion 承载；普通项目文档可以不绑定 Deliverable。
- 基础 seed 内置 `PATHOLOGY_IMPLEMENTATION_STANDARD` V1.9.1。正式制度和压缩包位于原始资料目录 `doc/`；部署只依赖 `apps/api/prisma/seed-assets/sop/v1.9.1/` 中保持原格式的 17 份模板。Seed 通过 Local Storage Provider 写入真实对象并保存 size/SHA-256，已发布版本存在时不覆盖用户修改。
- Required Checklist 与 Required Deliverable 按等单位进入同一进度分母；Deliverable 最新版本上传贡献 0.5，最终人工批准贡献 1。
- 进度、有效审核状态、最新版本等派生事实由 API 后端计算，前端多个入口只展示/操作同一份数据。

## 变更与权限边界

- 平台能力由 Role/Permission 控制，项目数据范围由 ProjectMember/Project Scope 控制，管理员拥有跨项目能力。
- 项目启动后形成 Approved Baseline。总体计划完成时间相对最近 Approved Baseline 的工期变化在 ±20% 内可直接调整并留档通知，超过 ±20% 必须走 `ProjectChangeRequest`。
- 重大范围变化（阶段、Required/Core WorkItem、Required Checklist、Required Deliverable、验收/审核标准等）始终走 CR。
- CR 的 `APPROVED` 与 `APPLIED` 分离；Apply 事务化、幂等，并在应用后重算 WorkItem → Stage → Plan → Project。
- ACTIVE/PAUSED 项目中的非必需人工临时任务允许免 CR 的直接调整，但结构性新增/修改/取消仅允许项目经理（管理员例外）。
- WorkItem 来源直接持久化为 `SOP`、`MANUAL`、`MESSAGE`、`ISSUE`、`ZENTAO` 或 `CHANGE`；新建的可溯源来源同时写入 `sourceId`。PendingAction 反查只作为旧数据兼容 fallback。

## 文档与存储

- 文件由 `StorageProvider` 抽象承载；LocalStorage 已实现，S3-compatible 保留扩展点并在未配置时失败关闭。
- 下载/上传保留项目范围、路径、文件类型与大小等安全校验。
- 物理文件删除失败写入 `StorageCleanupJob`，后台 Worker 采用乐观抢占周期重试，避免删除失败永久积压。

## 外部集成边界

当前版本的 AI、钉钉和禅道属于**预留接口**，不是生产必需依赖：

- 核心项目、任务、Checklist、交付物、文档、变更、报告流程在这些集成未启用时完整工作。
- 当前生产不会主动向 AI/DingTalk/ZenTao 发起真实外部调用，也不会把“未配置”伪装成成功。
- 正式交付物审核当前固定为人工审核。
- AI Schema、Review Job、消息 PendingAction 等扩展结构继续保留；Fake AI 仅在 `NODE_ENV=test` 下用于契约和回归测试，不能作为生产能力证据。
- 后续启用任何外部集成时，应作为受控版本重新完成安全、幂等、失败恢复和端到端验收。

生产拓扑为 Nginx Web → Nest API → MySQL，上传文件和数据库使用独立持久卷。API 提供 `/health`，Swagger 位于 `/api/docs`。
