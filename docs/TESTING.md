# 测试

## 测试层级

- 单元：进度公式、交付物有效审核判定、Fake/NotConfigured AI 契约、±20% 边界与防拆分、SOP diff、执行完整性、Storage Cleanup Worker、文件校验、RBAC/Project Scope、CSRF、消息/集成映射，以及本轮 Functional Parity Recovery 新增的 Dashboard 高风险计数、普通 required 文档结项阻断、PLAN_EDIT 兼容边界等回归规则。
- 集成：专用 MySQL 验证 Auth、ProjectWorkItem 唯一执行事实、SOP 快照、临时人工 Plan 吸收正式 SOP Plan、Checklist/Deliverable/DocumentVersionReview、测试环境 Fake-AI Review Job 幂等与失败路径、人工审核、自审限制、基线、直接调整、CR 状态机/事务应用、通知、审计和跨项目拒绝；同时验证普通 required 文档结项状态矩阵、无 SOP Plan 的 Message PendingAction Confirm 在数据库中持久化 `MESSAGE + messageId`，以及预置 SOP 两次 seed 幂等、五阶段结构、项目快照和 DOCX/XLSX 模板下载 checksum。
- E2E：Playwright 通过真实 API/MySQL 执行核心生产业务流与安全场景，并覆盖桌面、375px 手机和横屏导航；实施计划页直接 Checklist、交付模板下载、交付物上传/新版本/人工审核以及任务中心完成闭环均在浏览器中验证。Functional Parity 专项用例额外覆盖 Dashboard 旧指标、实施计划直接编辑负责人/计划日期、任务取消保留历史、普通 required 文档阻断结项及审核通过后结项。

当前生产版本不启用真实 AI/DingTalk/ZenTao 外呼，正式交付物审核固定为人工审核。AI 相关集成测试是 `NODE_ENV=test` 下的保留契约，不代表生产已启用 AI 审核。

## 命令

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
npm audit --audit-level=high
```

集成和生产流 E2E 必须设置 `TEST_DATABASE_URL` 指向专用可清理 MySQL，禁止指向生产库。未设置时集成套件显示 skipped，该结果不能作为验收证据。Fake AI 只有在 `NODE_ENV=test` 且对应测试显式启用 Fake Provider 时可用。

Fresh DB 验收必须先执行 `npm run db:migrate:deploy`，然后连续执行两次 `npm run db:seed`。两次输出中的内置 SOP 数量必须一致：5 Stage、36 Task、162 Checklist、17 Deliverable、17 Review Criterion、17 TemplateFile。下载集成测试要求 `STORAGE_PATH` 与 seed 使用同一绝对目录。

Playwright 默认在 5174 启动独立 Web，并禁止隐式复用碰巧占用该端口的其他服务。验证已部署实例时，显式设置 `E2E_BASE_URL=http://127.0.0.1:8080` 与 `E2E_USE_EXISTING_SERVER=true`；若执行会写数据的 production flow，还必须保证清理程序能连接到同一隔离数据库。

## 2026-08-24 Functional Parity Recovery 主线验收结果

Functional Parity Recovery 已合并 `main`（`ea0d1b2de0f3869c142ab2794b6ec1326bf516a3`）；合并后的 GitHub Actions V2 CI #181 成功。

## 2026-08-26 实施 SOP 预置分支本地验收结果

- Unit：**104 passed**，28 files，0 failed，0 skipped。
- Integration：**43 passed**，6 files，0 failed，0 skipped，MySQL 8.4。
- E2E：**15 passed**，0 failed，0 skipped。
- Fresh DB：**6/6 migrations** 成功应用；首次和第二次 seed 数量均为 `5/36/162/17/17`。
- lint、typecheck、build：通过。
- npm audit：0 vulnerabilities。
- Docker：Compose config、API image build、Web image build 通过；API 运行时镜像内核验 17 份 seed assets。

详细业务验收边界见 [V2-EXECUTION-ACCEPTANCE.md](V2-EXECUTION-ACCEPTANCE.md)。
