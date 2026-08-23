# V2 Trial Run / UAT Checklist

本清单用于 `v2.0.0-rc.1` 试运行环境。每个项目应由部署或业务负责人勾选并留存证据；未使用的外部集成标记为 `N/A`。

## Environment

- [ ] HTTPS 已启用，`COOKIE_SECURE=true`
- [ ] `CORS_ORIGIN` 仅包含试运行 HTTPS 域名
- [ ] MySQL 使用持久化卷
- [ ] 上传目录使用持久化卷
- [ ] MySQL 与上传文件备份策略已配置并演练恢复
- [ ] 管理员使用唯一强密码，已从 secret manager 注入
- [ ] Access / Refresh JWT 使用两个独立的生产密钥
- [ ] `TRUST_PROXY_HOPS` 与反向代理层数一致
- [ ] `/health` 报告 database up 与 storage configured
- [ ] API、Web、MySQL 日志已集中收集并设置告警
- [ ] `storage_cleanup_jobs` 的 `PENDING` 记录已纳入运维监控

## Core

- [ ] Login / Me / Refresh / Logout
- [ ] User management
- [ ] Project creation
- [ ] Project members and manager assignment
- [ ] Project start / pause / resume / close
- [ ] SOP template, version and publish
- [ ] Project plan generation and SOP sync
- [ ] Checklist and progress propagation
- [ ] Tasks
- [ ] Issues and risks
- [ ] Documents, versions and review
- [ ] Message analysis and PendingAction confirmation
- [ ] Reports
- [ ] Knowledge base
- [ ] Dashboard
- [ ] Audit logs

## Security

- [ ] Admin / Project Manager / Member / Viewer RBAC
- [ ] Project A / Project B isolation, including direct ID and URL enumeration
- [ ] Dashboard statistics exclude unauthorized projects
- [ ] Cookie-authenticated writes reject missing CSRF tokens
- [ ] Refresh token rotation and logout invalidate old tokens
- [ ] Login failure threshold returns 429 without permanent lockout
- [ ] Cookies include HttpOnly, Secure and expected SameSite attributes
- [ ] Logs do not expose Password, Cookie, Authorization or JWT values

## External Integrations

- [ ] AI production provider verified, or `N/A`
- [ ] DingTalk callback/signature verified, or `N/A`
- [ ] Zentao task synchronization verified, or `N/A`
- [ ] S3-compatible storage verified when required, or `N/A` while using persistent local storage

## Sign-off

- [ ] UAT owner
- [ ] Deployment owner
- [ ] Security owner
- [ ] Rollback owner
- [ ] Trial start date and rollback window recorded
