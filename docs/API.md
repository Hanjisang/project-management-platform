# API 约定

业务 API 前缀为 `/api/v2`；健康检查为 `/health`；Swagger UI 为 `/api/docs`。成功响应为 `{ "success": true, "data": ..., "requestId": "..." }`，失败响应为 `{ "success": false, "code": "...", "message": "...", "details": ..., "requestId": "..." }`。

认证使用 HttpOnly access/refresh Cookie；refresh token 只保存 SHA-256 哈希并在刷新时轮换。非 GET 请求还需发送与 `csrf_token` Cookie 相同的 `x-csrf-token`。所有项目资源都执行 RBAC 与 Project Scope。

## 执行域

- `GET /work-items`、`GET /work-items/:id`：统一工作项查询。
- `GET /projects/:projectId/execution`：项目执行视图，返回阶段、WorkItem、检查项、交付物和当前版本审查事实。
- `POST /projects/:projectId/work-items`、`PATCH /work-items/:id`：创建或更新手工 WorkItem。
- `PATCH /work-item-checklist/:id`：勾选检查项并重算进度。
- `POST /work-items/:id/complete`、`POST /work-items/:id/cancel`：显式完成或取消。完成前验证所有必需检查项和交付物，失败返回 `WORK_ITEM_COMPLETION_BLOCKED`。

SOP 定义接口仍使用 `/sop/tasks/...`，这里的 task 是模板节点，不是项目执行实体。生成项目计划后，只创建 `ProjectWorkItem` 快照，不再创建平行 Task。

## 交付物审查

交付物模板、模板下载和实际上传使用 `/sop/deliverables/:id/templates`、`/sop/deliverable-templates/:id/download`、`/project-deliverable-templates/:id/download`、`/project-deliverables/:id/documents`。普通文档、项目交付物与新版本上传上限均为 50MB。

审查事实绑定 `DocumentVersion`：`POST /documents/:id/reviews` 写人工审查，`POST /document-versions/:id/ai-review/retry` 只重试失败的同一版本 AI Job。上传新版本会使旧版本结论失效，交付物状态始终取最近版本。生产环境 AI 未配置时明确返回/记录 `AI_REVIEW_NOT_CONFIGURED`，不会生成伪结论。

## 项目变更

- `POST /projects/:projectId/change-impact/preflight`：相对批准基线计算时间变化率和分类。
- `POST /projects/:projectId/adjustments`：应用不超过 ±20% 且不涉及正式范围的直接调整。
- `GET|POST /projects/:projectId/change-requests`：查询或创建 CR。
- `POST /change-requests/:id/submit|approve|reject|apply`：提交、审批、驳回和事务应用。
- `GET /notifications`、`PATCH /notifications/:id/read`：个人通知。

正式范围变化或总体完成时间相对批准基线绝对变化超过 20% 时必须走 CR；拆分多次调整不能绕过阈值。
