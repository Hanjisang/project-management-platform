# V2 Functional Parity Recovery + Execution Domain Acceptance

验收日期：2026-08-24；实施 SOP 预置复验日期：2026-08-26。

结论：Execution Domain 收口与功能等价性恢复已合并到 `main`，merge commit 为 `ea0d1b2de0f3869c142ab2794b6ec1326bf516a3`，合并后的 GitHub Actions V2 CI #181 成功。ProjectWorkItem 继续作为项目计划与任务中心的唯一执行事实源，同时保留重构前未明确废弃的用户能力。该结论证明代码达到 UAT 准入，尚未发布生产。

## 1. 执行域与功能等价性

- `SopTask` 仅作为 SOP 定义；项目生成后实际执行统一落到 `ProjectWorkItem`，不恢复 `ProjectPlanTask + Task` 双事实源。
- SOP Published 版本不可直接修改；项目持有独立计划快照，不实时读取后续 SOP 定义。
- 项目可以在尚未生成正式 SOP 计划前创建人工临时任务。后续生成正式计划时，安全的临时 Plan 会被正式 SOP Plan 吸收，人工 WorkItem 原 ID/状态保留，项目仍只有一个 ProjectPlan。
- Message Confirm 创建任务同样不依赖既有 SOP Plan：没有计划时自动建立“项目自定义执行计划 / 临时任务”，数据库直接持久化 `sourceType=MESSAGE` 与 `sourceId=messageId`，重复确认保持幂等；既有 PendingAction 结果关联继续作为旧数据兼容 fallback。
- 实施计划页恢复直接操作 Checklist、编辑同一 ProjectWorkItem 的负责人/计划起止日期、下载交付模板、上传首版/新版本交付物、人工通过/驳回；任务抽屉和任务中心仍读取同一 ProjectWorkItem / ProjectDeliverable / Document 数据，不建立第二套状态。
- `PLAN_EDIT` 可用于计划页的负责人/计划日期与 Checklist 操作，但不能借此越权修改任务标题、说明、优先级、状态、进度或执行取消；完整任务编辑仍要求 `TASK_EDIT`。
- 普通项目文档与正式 Deliverable 文档继续共存：Deliverable 关联用于正式交付，普通文档不要求绑定 Deliverable。普通文档设置 `required=true` 后成为项目结项必需资料，只有 `APPROVED` 才解除结项阻断；DRAFT / PENDING_REVIEW / REJECTED 均阻断结项。
- 任务取消统一使用 `CANCELLED` 并保留执行历史，不提供物理删除语义；已完成任务不可通过取消入口删除。
- Dashboard 保留新的“我的项目”执行工作台，同时恢复“正常项目”“待确认消息”“项目进度排行”等原有指标；高风险问题总数使用独立 count，不受最多展示 20 条列表的截断影响。
- Dashboard、任务中心、项目执行、项目成员、问题风险、文档、消息、日报周报、知识库、用户/RBAC、集成配置、审计等原有产品入口继续保留。

## 2. Checklist / Deliverable 进度规则

进度只统计 Required 控制项，所有 Required Checklist 与 Required Deliverable 默认按**等单位**进入同一分母，Optional 项不计入进度且不阻断完成。

- Required Checklist 未完成 = 0；完成 = 1。
- Required Deliverable 未上传 = 0；最新版本已上传但尚未最终通过 = 0.5；最新版本最终有效审核通过 = 1。
- `progress = (Required Checklist 贡献之和 + Required Deliverable 贡献之和) / Required 控制项总数 × 100%`。
- 例：2 个 Required Checklist + 1 个 Required Deliverable，执行序列为 `0 → 33 → 67 → 83 → 100`。
- 已批准交付物上传新版本后，按最新版本重新计算，在新版本最终通过前该 Deliverable 回到 0.5；历史版本继续保留。
- WorkItem、Stage、Plan、Project 由后端统一重算；存在未完成 Required Checklist 或未最终通过的 Required Deliverable 时，显式完成任务会被阻断。

## 3. 当前交付物审核边界

当前生产版本正式交付物固定使用**人工审核**。AI 相关 Schema、Provider 扩展点、Review/Job 数据结构仍保留，用于未来启用与 `NODE_ENV=test` 下的 Fake-AI 契约测试，但当前生产 UI 和正式 API 不提供可用的 AI 审核业务入口。

钉钉、禅道和 AI 同样属于当前版本的预留集成接口：生产流程不依赖它们，不会主动进行真实外呼，也不会在未配置时伪造成功结果。

## 4. 项目变更与 SOP 同步治理

- 项目启动时形成批准 Baseline；正式范围变化通过 `ProjectChangeRequest` 管理，`APPROVED` 与 `APPLIED` 分离，Apply 事务化且可幂等重入。
- ±20% 指项目**总体计划完成时间/总工期**相对最近一次 APPROVED Baseline 的变化，不是实际进度百分比。正负恰好 20% 可直接调整并留档通知，绝对值超过 20% 必须走 CR。
- 防拆分以最近 APPROVED Baseline 为比较基准，不以上一次直接调整后的日期为新基准。
- 新增/删除阶段、Required/Core WorkItem、Required Checklist、Required Deliverable、验收/审核标准等重大范围变化始终要求 CR，不受 ±20% 例外影响。
- ACTIVE/PAUSED 项目的非必需人工临时任务可以免 CR，但新增、结构性计划修改、取消仅允许项目经理执行（管理员例外），并写入 Adjustment Log/通知；一般执行动作仍按任务权限处理。
- 未启动且没有执行历史/人工变更数据的项目可安全直接同步 SOP；ACTIVE/PAUSED 项目不能通过直接 SOP 重建绕过 Change Control。
- CR Apply 后统一重算 WorkItem → Stage → Plan → Project，允许因新范围加入而解释性下降进度，不删除既有执行历史。

## 5. 文件与后台恢复能力

- StorageProvider 继续隔离实际对象存储；LocalStorage 已实现，路径穿越/文件类型/大小等校验保留。
- 文件物理删除失败会写入 `StorageCleanupJob`；清理 Worker 服务启动时执行一轮，之后周期重试，通过 `id + attempts` 乐观抢占避免同一轮重复处理，成功写 `completedAt`，失败保留 `lastError`，最多重试 10 次。
- 基础 seed 内置 `PATHOLOGY_IMPLEMENTATION_STANDARD` V1.9.1：5 Stage、36 Task、162 Checklist、17 Deliverable、17 人工审核 Criterion、17 个真实模板文件。
- `doc/` 仅作为正式制度和套表压缩包的原始来源；运行时使用 `apps/api/prisma/seed-assets/sop/v1.9.1/`，API Docker 镜像已核验包含全部 17 个文件。
- 模板通过 Local Storage Provider 写入 Storage 并保存真实 size/SHA-256；已发布版本存在时 seed 只检查并告警，不覆盖或删除用户修改。

## 6. 最终 CI 验收证据

Functional Parity Recovery 合并后的 GitHub Actions V2 CI #181 完整通过。本次实施 SOP 预置分支在 Fresh MySQL 8.4 本地复验：

- npm install / dependency audit：通过，0 vulnerabilities。
- lint：通过。
- typecheck：通过。
- Unit：**104/104 passed**，28 个 test files，0 failed、0 skipped。
- Fresh MySQL 8.4：发现并成功应用 **6/6 migrations**；连续两次 seed 数量均为 `5 Stage / 36 Task / 162 Checklist / 17 Deliverable / 17 TemplateFile`。
- Integration：**43/43 passed**，6 个 integration files，0 failed、0 skipped；新增验证预置 SOP 结构与幂等、项目计划快照、DOCX/XLSX 下载 checksum，以及 Message → WorkItem 数据库来源追溯。
- build：API/Web/共享包全部通过。
- Web 当前最大 JavaScript chunk：174.48 kB，gzip 67.27 kB。
- Playwright：**15/15 passed**，除原核心生产业务流/安全/响应式导航外，新增验证 Dashboard 旧指标并存、实施计划直接修改同一 WorkItem 日期、取消任务保留历史、普通 required 文档人工审核后解除结项阻断。
- Docker Compose config、API image build、Web image build 全部通过；API 运行时镜像内存在 17/17 seed assets。

## 7. 已知非阻断事项

- 尚未执行独立的 `50 WorkItem / 300 Checklist / 100 Deliverable` 专项负载基准，因此不对该规模给出量化性能承诺；Execution API 已采用聚合读取，后续 UAT 可补专项测量。
- AI/DingTalk/ZenTao 不是“等待配置凭证即可上线”的当前功能，而是本版本**明确未启用**的扩展接口；启用时应作为后续受控版本重新测试。
- 本验收证明功能等价性恢复已合并主线、实施 SOP 预置分支达到 UAT 准入；两者均不代表已经发布或部署到生产。

发布前历史备份仍保留：`.backups/pre_execution_redesign_20260824_complete.sql`。如执行与旧双轨表删除相关的数据库级回滚，必须结合对应数据库备份/迁移策略处理。
