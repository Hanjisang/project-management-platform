# 医疗信息化实施项目管理平台 V2

V2 是面向实施交付团队的生产级前后端分离平台。它以项目为数据权限边界，将 SOP、实施计划、任务、问题风险、交付文档、消息、日报周报和知识库连接为一条可审计的业务链路。

核心执行架构：`SOP Definition → Project Plan Snapshot → ProjectWorkItem → Checklist + Deliverable → DocumentVersion Review → Project Progress → Change Request → New Baseline`。ProjectWorkItem 同时是计划任务和执行任务的唯一事实源；任务中心只是它的跨项目聚合视图，不再维护 ProjectPlanTask + Task 双模型。

## 技术栈

- Web：Vue 3、TypeScript、Vite、Pinia、Vue Router、TanStack Query、Element Plus
- API：NestJS、TypeScript、Prisma、MySQL 8、Swagger
- 工程：npm workspaces、ESLint、Prettier、Vitest、Playwright、Docker Compose、GitHub Actions

目录：`apps/web` 为前端，`apps/api` 为 API/Prisma，`packages` 为共享代码，`docker` 为 Web 镜像与 Nginx 配置，`docs` 为设计与运维文档。架构详情见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 本地启动

要求 Node.js 22+、npm 10+、MySQL 8+。

```bash
cp .env.example .env
npm ci
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

访问 `http://localhost:5173`，API 文档位于 `http://localhost:3000/api/docs`。首次管理员账号来自 `.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`，示例密码不得用于生产。

当前版本的 AI、钉钉和禅道均为**预留集成接口**，生产运行不会主动连接这些外部服务，也不会伪造成功结果。核心项目管理、任务、Checklist、交付物和变更流程不依赖外部集成；正式交付物审核当前固定为人工审核。Fake AI 仅用于 `NODE_ENV=test` 下的契约与回归测试。

`.env.example` 列出全部开发配置；至少需要数据库 URL、两个独立 JWT secret 和管理员初始账号。基础 seed 会创建权限、默认角色、知识分类、可选管理员，以及内置的 `PATHOLOGY_IMPLEMENTATION_STANDARD`（病理信息化项目实施标准SOP，V1.9.1）。该 SOP 含 5 个阶段、36 个实施任务、162 个 Checklist、17 个正式 Deliverable 和 17 份可下载原始模板文件；模板上传者为不可登录的 `system-seed` 系统账号。演示 SOP 仍必须显式运行：

```bash
npm run db:seed:demo
```

## Docker 启动

```bash
cp .env.deploy.example .env.deploy
# 修改所有必填密码和密钥
docker compose --env-file .env.deploy up --build -d
```

Web 默认发布在 `http://localhost:8080`。API 容器启动时自动执行 Prisma 迁移和幂等基础种子，并从 `apps/api/prisma/seed-assets/sop/v1.9.1/` 将正式套表写入 Storage；演示数据只通过 `npm run db:seed:demo` 显式导入。`doc/` 是制度与套表压缩包的原始资料来源，不是运行时依赖，也不会随 API 镜像部署。

## 常用命令

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

根目录 `npm test` 运行全部非数据库 Vitest 测试。真实 MySQL 集成测试需提供 `TEST_DATABASE_URL`；完整说明见 [docs/TESTING.md](docs/TESTING.md)。

仓库运行入口只有 `apps/api` 与 `apps/web`；V1 单体源码已从工作树移除，历史实现仅通过 Git tag/commit 查阅。详细文档见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 与 [docs/MIGRATION.md](docs/MIGRATION.md)。

## Production Acceptance

Functional Parity Recovery 已合并到 `main`（merge commit `ea0d1b2de0f3869c142ab2794b6ec1326bf516a3`），合并后的 GitHub Actions V2 CI #181 成功。当前预置 SOP 分支本地验收在 Fresh MySQL 8.4 完成 6/6 migrations、两次幂等 seed，并通过 **104/104 Unit、43/43 Integration、15/15 Playwright E2E**，0 failed、0 skipped；`lint`、`typecheck`、`build`、API/Web Docker image build 与 `npm audit --audit-level=high` 均通过，依赖审计为 0 vulnerabilities。详见 [docs/V2-EXECUTION-ACCEPTANCE.md](docs/V2-EXECUTION-ACCEPTANCE.md)。
