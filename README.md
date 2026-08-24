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

AI、钉钉和禅道均为可选集成。未配置 AI Provider 时系统会正常启动，交付物仍可人工审核，页面明确显示“未配置”，不会使用伪造结果。

`.env.example` 列出全部开发配置；至少需要数据库 URL、两个独立 JWT secret 和管理员初始账号。基础 seed 只创建权限、默认角色、知识分类和可选管理员；演示 SOP 必须显式运行：

```bash
npm run db:seed:demo
```

## Docker 启动

```bash
cp .env.deploy.example .env.deploy
# 修改所有必填密码和密钥
docker compose --env-file .env.deploy up --build -d
```

Web 默认发布在 `http://localhost:8080`。API 容器启动时自动执行 Prisma 迁移和幂等基础种子；演示数据只通过 `npm run db:seed:demo` 显式导入。

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

2026-08-24 Execution Domain Redesign 已在全新 MySQL 8.4 数据库完成 5/5 migration、seed，并通过 89 项单元测试、36 项真实 MySQL 集成测试和 11 项 Playwright E2E。Docker Compose 已原位升级，MySQL、API、Web 均 healthy；最大 JavaScript chunk 为 143.77 kB，依赖审计为 0 vulnerabilities。详见 [docs/V2-EXECUTION-ACCEPTANCE.md](docs/V2-EXECUTION-ACCEPTANCE.md)。
