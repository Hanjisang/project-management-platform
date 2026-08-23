# API 约定

业务 API 前缀为 `/api/v2`；健康检查为 `/health`；Swagger UI 为 `/api/docs`。

成功响应：`{ "success": true, "data": {}, "requestId": "..." }`。

失败响应：`{ "success": false, "code": "PROJECT_NOT_FOUND", "message": "项目不存在", "details": {}, "requestId": "..." }`。

认证使用 HttpOnly access/refresh Cookie；refresh token 在数据库中只保存 SHA-256 哈希并在刷新时轮换。非 GET 请求还需发送与 `csrf_token` Cookie 相同的 `x-csrf-token`。浏览器客户端已自动处理刷新和 CSRF。

主要资源：`auth`、`users`、`roles`、`projects`、`sop`、`project-plans`、`tasks`、`issues`、`documents`、`messages`、`reports`、`knowledge`、`dashboard`、`audit` 和 `integrations`。上传接口使用 multipart/form-data，单文件上限 20MB。列表接口默认分页，项目范围查询始终应用成员过滤。
