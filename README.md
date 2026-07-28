# 实施项目管理平台 V1.1

完整架构、业务设计和当前开发状态请参阅：[项目完整设计与开发状态](docs/PROJECT-DESIGN-AND-STATUS.md)。

Ubuntu 服务器推荐部署目录为 `/opt/project-management-platform`，完整部署步骤请参阅：[Ubuntu 部署手册](docs/UBUNTU-DEPLOYMENT.md)。

当前版本为可本地运行、可容器化部署的实施项目管理系统，基于 V1.1 产品设计与 V3 钉钉消息采集版原型。

## 已覆盖的核心路径

- 项目驾驶舱、项目列表与项目详情
- 可拖拽的实施 SOP 编辑器、权重校验和本地版本记录
- 钉钉主动消息采集：`@项目机器人`、消息菜单、每日进展卡片、人工导入
- 原始采集消息、AI 结构化分析、待确认事项和未归属消息处理
- 任务、问题风险、交付文档、SOP 与项目周报
- MySQL 持久化、账号密码登录、HttpOnly 会话鉴权和审计日志

## 运行方式

本地开发执行 `npm start` 后访问 `http://localhost:3030`。首次使用需要配置 `.env`，执行 `database/schema.sql`，并运行 `npm run db:seed-admin -- <账号> <密码> [显示名称]` 创建管理员。

## Docker 部署

1. 安装 Docker Desktop。
2. 复制 `.env.deploy.example` 为 `.env.deploy`，并替换 MySQL 密码、JWT 密钥和初始管理员密码。
3. 在 Windows PowerShell 中执行：`./scripts/deploy-windows.ps1`。
4. 访问 `http://localhost:3030`。

Docker Compose 会自动启动 MySQL、初始化数据库表结构、创建初始管理员，并持久化数据库与上传文件。

## 当前边界

钉钉 Stream、钉钉扫码登录与云对象存储需要各自的应用凭证或云厂商配置后才能启用；当前文件存储通过 `storage.js` 适配层使用本地持久化实现。钉钉相关页面严格遵循 V1.1 的主动采集边界，不宣称读取或监听全量群聊。
