# 安全说明

- 密码使用 bcrypt；登录失败计数和 15 分钟锁定降低暴力破解风险。
- access/refresh token 只放 HttpOnly Cookie；refresh token 哈希入库并轮换。生产 Cookie 必须 Secure + SameSite。
- 写请求执行双提交 CSRF 校验；CORS 只允许明确来源并携带凭证。
- 每个接口同时执行平台 RBAC 和项目成员范围校验；管理员越权能力显式建模。
- DTO 白名单、长度/枚举校验、1MB JSON 上限和 20MB 文件上限降低输入风险。
- Helmet、安全响应头、请求限流、统一错误码和 requestId 已启用；日志字段执行密钥脱敏。
- 钉钉回调使用 HMAC、时间窗和 nonce；外部同步与人工确认使用幂等键/事务。
- AI 输入输出受严格 Schema 约束，未配置时失败关闭，Fake provider 禁止进入生产。

密钥不得提交 Git。至少定期轮换 JWT、数据库、AI、钉钉和禅道凭据。上线前运行依赖审计、镜像扫描和渗透测试。
