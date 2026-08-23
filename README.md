# 医疗信息化实施项目管理平台 V2

V2 是面向实施交付团队的生产级前后端分离平台。它以项目为数据权限边界，将 SOP、实施计划、任务、问题风险、交付文档、消息、日报周报和知识库连接为一条可审计的业务链路。

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

AI、钉钉和禅道均为可选集成。未配置 OpenAI 密钥时系统会正常启动，消息分析明确显示“未配置”，不会使用伪造结果。

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

V1 单体源码保留在 Git 历史及当前根目录作为迁移核对材料，但 V2 的脚本、容器和 CI 不再启动 `server.js` 或根目录 `index.html`。详细文档见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 与 [docs/MIGRATION.md](docs/MIGRATION.md)。

## Production Acceptance

2026-08-23 已在两个全新 MySQL 8.4 数据库上完成 migration、seed 和应用启动复验，并通过 34 项单元测试、15 项真实 MySQL 集成测试、11 项 Playwright E2E（包含业务 A–G 和权限隔离）及实际 Docker Compose 部署验证。详见 [docs/V2-PRODUCTION-ACCEPTANCE.md](docs/V2-PRODUCTION-ACCEPTANCE.md)。
