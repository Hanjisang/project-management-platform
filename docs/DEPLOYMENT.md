# 部署

```bash
cp .env.deploy.example .env.deploy
# 设置数据库密码、两个独立 JWT secret 和管理员初始密码
docker compose --env-file .env.deploy up --build -d
docker compose --env-file .env.deploy ps
```

服务包括 MySQL 8、Nest API 和 Nginx Web。API 等待数据库健康后执行 `prisma migrate deploy` 与幂等基础 seed，再启动服务；Web 等待 API 健康。默认外部端口为 8080，上传文件和 MySQL 使用 named volumes。

启动后执行：

```bash
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy logs --no-color
curl http://localhost:8080/health
```

`/health` 必须报告 database `up` 且 storage `configured: true`。AI、DingTalk 和 Zentao 是可选集成，未配置时应显示 `configured: false` 而不得使整体健康检查失败。

本地文件写入成功但数据库失败时会即时删除文件；数据库删除成功但文件删除失败时，会记录到 `storage_cleanup_jobs` 并输出明确错误。运维应监控该表的 `PENDING` 记录；当前自动重试 worker 尚未实现。

公网部署必须启用 TLS，设置 `COOKIE_SECURE=true`，把 `CORS_ORIGIN` 限制为实际 HTTPS 域名，并将密钥放入部署平台 secret manager。升级前备份数据库和 `app_storage`，迁移必须先在备份副本演练。
