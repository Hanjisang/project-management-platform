# Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在数据中心新增支持在线文章、附件、审核发布和项目文档沉淀的知识库。

**Architecture:** 延续现有 Node.js 单服务和 MySQL 数据层，在 `server.js` 增加知识库表初始化、权限映射和 REST API，在 `index.html` 增加数据中心入口、知识库列表、详情及编辑交互。项目文档通过来源字段与知识条目关联。

**Tech Stack:** Node.js、原生 HTTP、MySQL 8.4、原生 HTML/CSS/JavaScript、现有对象文件存储。

## Global Constraints

- 标准知识与项目沉淀共用一个知识库。
- 内容支持在线正文和附件。
- 普通用户提交审核，管理员可直接发布。
- 项目文档仅在已通过或已确认后允许手动沉淀。
- 固定一级分类，可维护二级分类。
- 界面与现有桌面端数据中心保持一致。

---

### Task 1: 数据模型与接口

**Files:**
- Modify: `D:\code项目\实施项目管理平台\server.js`
- Modify: `D:\code项目\实施项目管理平台\database\schema.sql`

**Interfaces:**
- Produces: `/api/knowledge`、`/api/knowledge/:id`、`/submit`、`/review`、项目文档 `/deposit`。

- [ ] 增加 `knowledge_articles`、`knowledge_attachments`、`knowledge_categories` 表。
- [ ] 增加知识列表、详情、创建、修改、删除接口。
- [ ] 增加提交审核和审核发布状态流转。
- [ ] 增加已审核项目文档一键沉淀接口。
- [ ] 使用无效标题、无效状态和未审核文档请求验证返回 400。

### Task 2: 权限控制

**Files:**
- Modify: `D:\code项目\实施项目管理平台\server.js`
- Modify: `D:\code项目\实施项目管理平台\index.html`

**Interfaces:**
- Produces: `knowledge.view/create/edit/review/delete`。

- [ ] 将知识库权限加入权限全集、菜单映射和接口鉴权表。
- [ ] 将知识库加入数据中心多级菜单权限。
- [ ] 验证无权限用户不能调用写接口。

### Task 3: 数据中心知识库页面

**Files:**
- Modify: `D:\code项目\实施项目管理平台\index.html`

**Interfaces:**
- Consumes: Task 1 REST API。
- Produces: `loadKnowledgeBase()`、`renderKnowledgeBase()`、`openKnowledgeEditor()`、`openKnowledgeDetail()`。

- [ ] 在数据中心增加知识库卡片与统计。
- [ ] 增加知识库独立页面、指标、检索和筛选。
- [ ] 增加知识列表、详情弹窗和编辑弹窗。
- [ ] 增加创建、编辑、删除、提交审核和审核操作。
- [ ] 验证保存后列表和统计即时刷新。

### Task 4: 项目文档沉淀

**Files:**
- Modify: `D:\code项目\实施项目管理平台\index.html`

**Interfaces:**
- Consumes: `/api/projects/:projectId/documents/:documentId/deposit`。

- [ ] 已通过或已确认文档显示“一键沉淀”。
- [ ] 弹窗填写标题、摘要、分类和标签。
- [ ] 保存后刷新知识库数据并显示成功反馈。
- [ ] 未审核文档不显示沉淀操作。

### Task 5: 发布与验证

**Files:**
- Deploy: `index.html`、`server.js`、`database/schema.sql`

- [ ] 检查 `node --check server.js`。
- [ ] 同步代码到 `/opt/pis-project-delivery-center`。
- [ ] 重建应用容器。
- [ ] 验证容器状态、首页 HTTP 200 和知识库接口。
- [ ] 验证创建、编辑、审核、检索和项目文档沉淀链路。
