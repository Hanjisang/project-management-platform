# V2 Production Acceptance

## 结论

**CONDITIONAL PASS**

核心平台的真实 MySQL、业务 A–G、RBAC/Project Scope、事务幂等、Playwright、构建和 Docker 部署全部通过，且无 P0/P1 问题。AI、DingTalk、Zentao 和 S3 没有生产凭证或远端实现，因此按验收准则给出有条件通过。

## 验收环境

| 项目                 | 实际值                                          |
| -------------------- | ----------------------------------------------- |
| 测试日期             | 2026-08-24                                      |
| 分支                 | `codex/v2-rc-hardening`                         |
| 验收前 source commit | `42d99f02ee5854447e2a4571f404efdb6a7cb06f`      |
| 验收基线 commit      | 本文档所在 commit；以 `git rev-parse HEAD` 为准 |
| OS                   | Windows / Docker Desktop                        |
| Node                 | 24.19.0                                         |
| npm                  | 11.17.0                                         |
| MySQL                | 8.4.11                                          |
| Docker Engine        | 29.6.2                                          |
| Docker Compose       | 5.3.1                                           |

## 数据库与测试结果

| 项目                              | 结果                                             |
| --------------------------------- | ------------------------------------------------ |
| 空库 1 migration / seed / startup | PASS                                             |
| 空库 2 migration / seed / startup | PASS                                             |
| Prisma migration                  | 2/2 applied，无手工 SQL                          |
| Seed                              | PASS；4 roles / 39 permissions / 1 administrator |
| Unit                              | 34 passed / 0 skipped / 0 failed                 |
| Integration                       | 15 passed / 0 skipped / 0 failed                 |
| Playwright E2E                    | 11 passed / 0 skipped / 0 failed                 |
| Build                             | PASS；主 chunk 894.28 kB 警告                    |
| Audit                             | 0 vulnerabilities                                |

## A–G 业务结果

| Flow                                            | Result |
| ----------------------------------------------- | ------ |
| A User / Project                                | PASS   |
| B SOP                                           | PASS   |
| C Project Plan / Progress                       | PASS   |
| D Task                                          | PASS   |
| E Issue / Risk / Dashboard                      | PASS   |
| F Document / Version / Review / Compensation    | PASS   |
| G Message / Fake AI / PendingAction Idempotency | PASS   |

RBAC、Project Scope ID 枚举、Dashboard 统计隔离、Viewer 读取/写入限制、Cookie/CSRF、Refresh Token hash/rotation/logout 失效、Login Rate Limit 和 Message 跨项目确认均通过真实 MySQL 集成验证。

RC 终审进一步确认：单条消息只能存在一个标准分析，重复 Analyze 复用原 PendingAction；项目结项与 Task/Issue/Document/Message 阻塞写入通过项目行锁串行化；Docker 反向代理启用显式 trust-proxy hop，生产部署样例默认使用 Secure Cookie 和 HTTPS CORS。

## Docker

`docker compose --env-file .env.deploy up --build -d` 已实际执行。MySQL、API 和 Web 均为 healthy；当前容器日志无迁移失败、数据库连接失败、异常重启或持续错误。`GET /health` 报告 API ok、database up、LocalStorage configured，未配置集成不影响整体健康。Login、Project List/Create、SOP List、Task List 和 Dashboard 冒烟均 PASS，临时项目已清理。

## 外部系统

| 系统     | 状态                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| AI       | FAKE VERIFIED / production NOT CONFIGURED                                                        |
| DingTalk | Signature, timestamp, replay, externalMessageId idempotency VERIFIED / production NOT CONFIGURED |
| Zentao   | FAKE VERIFIED（success / failure / retry state）/ production NOT CONFIGURED                      |
| S3       | NOT CONFIGURED；LocalStorageProvider REAL VERIFIED                                               |

Fake AI 仅由测试环境显式启用；生产默认不会产生伪造分析。

## 2026-08-24 RC Hardening 复验

本轮基于 `main` 创建本地 `codex/v2-rc-hardening` 分支，完成 Task/Issue 状态动作、项目结项只读、业务日期、effective health、系统角色/最后管理员保护、文档审核状态机、前端 refresh single-flight、项目路由响应式、CRUD/权限 UI、分页与远程选择、共享类型契约、V1 死代码清理和 Element Plus 按需构建。

| 项目                            | 结果                                          |
| ------------------------------- | --------------------------------------------- |
| 全新 MySQL 8.4 migration / seed | PASS                                          |
| Unit                            | 51 passed / 0 skipped / 0 failed              |
| Integration                     | 20 passed / 0 skipped / 0 failed              |
| Playwright E2E                  | 11 passed / 0 skipped / 0 failed              |
| Lint / Format / Typecheck       | PASS                                          |
| Build                           | PASS；最大 JS chunk 143.77 kB / gzip 55.15 kB |
| Audit                           | 0 vulnerabilities                             |

候选代码已完成 Docker Compose 无缓存重建，并从空的 Compose MySQL 卷执行 2/2 migration、seed 与启动。MySQL、API、Web 均为 healthy 且 restart count 为 0；production 模式 `/health` 返回 database up、LocalStorage configured，AI/DingTalk/Zentao 未配置但不影响整体健康。通过 Web/Nginx 入口完成 Login、Me、Project/SOP/Task List、Dashboard、Logout Smoke，并在隔离的 `NODE_ENV=test + AI_FAKE_ENABLED=true` 容器配置下完成 A–G、Project Scope/Viewer 安全场景 8/8，以及桌面、375px、横屏回归 3/3。测试完成后已恢复 `NODE_ENV=production` 且关闭 Fake AI。

## Known Issues

- P0：0。
- P1：0。
- P2：当前最大 JavaScript chunk 已降至 143.77 kB；无构建体积阻塞。
- P2：文件删除失败会持久化到 `storage_cleanup_jobs`，但自动重试 worker 未实现，需运维监控与手动重试。
- P2：Playwright 的 Vite 开发服务器偶发报告 Element Plus `ResizeObserver loop` 浏览器警告；11 项 E2E 均通过，生产构建不受影响。

## 最终判定

V2 已形成可合并 `main`、可进入试运行环境的核心平台基线。进入依赖外部能力的生产场景前，必须单独完成对应凭证、回调和远端存储验收。
