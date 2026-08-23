# 测试

## 测试层级

- 单元：SOP 权重与 diff、进度/风险、CSRF、Project Scope、响应序列化、文件补偿、DingTalk 签名/重放/幂等、Zentao Fake 映射与失败状态。运行 `npm test`。
- 集成：使用专用 MySQL 数据库验证 Auth、RBAC、Project Scope、Dashboard Scope、SOP/ProjectPlan 快照与同步、Task、Issue、Document、Message/PendingAction 事务幂等、结项阻塞与限流。必须设置 `TEST_DATABASE_URL`后运行 `npm run test:integration`。
- E2E：Playwright 通过真实 API/MySQL 执行 A–G 业务流和权限场景，同时保留桌面、375px 手机和手机横屏响应式测试。运行 `npm run test:e2e`。

## 真实 MySQL

`TEST_DATABASE_URL` 必须指向专用的可清理测试库，禁止指向生产库。未设置时集成套件会明确显示 skipped；该结果不得作为生产验收通过依据。

```bash
npm run db:migrate:deploy
npm run db:seed
npm run test:integration
npm run test:e2e
```

2026-08-23 验收基线的实际结果为 34 项单元、15 项集成和 11 项 E2E，均 0 skipped / 0 failed。完整门禁还包括 `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm run build` 和 `npm audit --audit-level=high`。
