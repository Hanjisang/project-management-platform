# 认证与 RBAC

认证使用 15 分钟 Access Token 和 7 天 Refresh Token，均通过 HttpOnly Cookie 传递。Refresh Token 只以 SHA-256 哈希存库，每次刷新都会撤销旧令牌并签发新令牌。写请求还必须通过双提交 CSRF 校验。

授权顺序为 JwtAuthGuard → CsrfGuard → PermissionGuard → ProjectAccessGuard。Role/Permission 控制功能，ProjectMember 控制数据范围；项目角色与平台角色互不混用。管理员角色拥有全平台数据范围，其他用户只能读取成员项目。稳定权限码和默认角色定义在 `packages/shared-constants`。

密码使用 bcrypt cost 12。连续失败达到阈值后锁定 15 分钟，接口还有全局和登录级限流。生产必须使用不同的随机 JWT secret、HTTPS、Secure Cookie 和精确 CORS 来源。
