# 测试

## 测试层级

- 单元：进度公式、交付物有效审核判定、Fake/NotConfigured AI 契约、±20% 边界与防拆分、SOP diff、执行完整性、Storage Cleanup Worker、文件校验、RBAC/Project Scope、CSRF、消息/集成映射。
- 集成：专用 MySQL 验证 Auth、ProjectWorkItem 唯一执行事实、SOP 快照、临时人工 Plan 吸收正式 SOP Plan、Checklist/Deliverable/DocumentVersionReview、测试环境 Fake-AI Review Job 幂等与失败路径、人工审核、自审限制、基线、直接调整、CR 状态机/事务应用、通知、审计和跨项目拒绝。
- E2E：Playwright 通过真实 API/MySQL 执行核心生产业务流与安全场景，并覆盖桌面、375px 手机和横屏导航；实施计划页直接 Checklist、交付模板下载、交付物上传/新版本/人工审核以及任务中心完成闭环均在浏览器中验证。

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

Playwright 默认在 5174 启动独立 Web，并禁止隐式复用碰巧占用该端口的其他服务。验证已部署实例时，显式设置 `E2E_BASE_URL=http://127.0.0.1:8080` 与 `E2E_USE_EXISTING_SERVER=true`；若执行会写数据的 production flow，还必须保证清理程序能连接到同一隔离数据库。

## 2026-08-24 Functional Parity Recovery 验收结果

GitHub Actions V2 CI #122：

- Unit：**100 passed**，26 files，0 failed，0 skipped。
- Integration：**37 passed**，4 files，0 failed，0 skipped，MySQL 8.4。
- E2E：**11 passed**，0 failed，0 skipped。
- Fresh DB：**5/5 migrations** 成功应用并完成 seed。
- lint、typecheck、build：通过。
- npm audit：0 vulnerabilities。
- Docker container job：Compose config、API image build、Web image build 通过。
- Web 最大 JavaScript chunk：174.48 kB，gzip 67.27 kB。

详细业务验收边界见 [V2-EXECUTION-ACCEPTANCE.md](V2-EXECUTION-ACCEPTANCE.md)。
