# 测试

## 测试层级

- 单元：进度公式、三种交付物审查模式、严格 AI Schema/Fake/NotConfigured、±20% 边界与防拆分、SOP diff、文件校验、RBAC/Project Scope、CSRF、消息/集成映射。
- 集成：专用 MySQL 验证 Auth、WorkItem 唯一执行事实、SOP 快照、Checklist/Deliverable/DocumentVersionReview、AI Job 幂等与失败重试、人工覆盖、自审限制、基线、直接调整、CR 状态机/事务应用、通知、审计和跨项目拒绝。
- E2E：Playwright 通过真实 API/MySQL 执行 A–G 核心业务流与安全场景，并覆盖桌面、375px 手机和横屏导航。

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

集成和生产流 E2E 必须设置 `TEST_DATABASE_URL` 指向专用可清理 MySQL，禁止指向生产库。未设置时集成套件显示 skipped，该结果不能作为验收证据。Fake AI 只有在 `NODE_ENV=test` 且 `AI_FAKE_ENABLED=true` 时可用。

Playwright 默认在 5174 启动独立 Web，并禁止隐式复用碰巧占用该端口的其他服务。验证已部署实例时，显式设置 `E2E_BASE_URL=http://127.0.0.1:8080` 与 `E2E_USE_EXISTING_SERVER=true`；若执行会写数据的 production flow，还必须保证清理程序能连接到同一隔离数据库。

## 2026-08-24 验收结果

- Unit：89 passed，0 failed，0 skipped。
- Integration：36 passed，0 failed，0 skipped，MySQL 8.4。
- E2E：11 passed，0 failed，0 skipped。
- Fresh DB：5/5 migrations + seed；schema diff 为 no difference。
- Upgrade DB：旧 Task/PlanTask/Review/Document/ZenTao 样例关联全部保留。
- Docker：MySQL、API、Web healthy；浏览器登录页无控制台 warning/error。
