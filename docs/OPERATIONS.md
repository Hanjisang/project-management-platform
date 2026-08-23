# 运维手册

日常检查 `/health`、API 结构化日志 requestId、容器重启次数、数据库容量、上传卷空间、失败的 StorageCleanupJob、ZentaoTaskSync 和 MessageAnalysis。

备份至少包含 MySQL 一致性快照和上传存储。恢复演练需校验数据库外键、文件 checksum、管理员登录和一个完整项目读取链路。

- 数据库 down：健康检查返回 503，先恢复 MySQL，不绕过迁移。
- AI 未配置：属预期降级；消息录入和人工处理仍可用。
- 文件删除失败：数据库记录已软删除，StorageCleanupJob 保存重试任务。
- 禅道同步失败：检查 lastError，修复凭据后重试，幂等键避免重复建单。
- 钉钉回调拒绝：检查签名 secret、系统时钟、时间窗及 replay nonce。

审计日志记录关键写操作、资源、用户、IP、User-Agent 和 requestId。日志与备份中不得输出密码、Cookie、Token 或外部密钥。
