# V2 Production Acceptance

## 结论

**CONDITIONAL PASS**

核心平台的真实 MySQL、业务 A–G、RBAC/Project Scope、事务幂等、Playwright、构建和 Docker 部署全部通过，且无 P0/P1 问题。AI、DingTalk、Zentao 和 S3 没有生产凭证或远端实现，因此按验收准则给出有条件通过。

## 验收环境

| 项目                 | 实际值                                          |
| -------------------- | ----------------------------------------------- |
| 测试日期             | 2026-08-23                                      |
| 分支                 | `refactor/v2-production-architecture`           |
| 验收前 source commit | `9063d5d10374661b3c56e7b74633ca30bdd436fc`      |
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

## Known Issues

- P0：0。
- P1：0。
- P2：Web 主 chunk 为 894.28 kB，可后续通过进一步按需引入降低；当前不影响功能。
- P2：文件删除失败会持久化到 `storage_cleanup_jobs`，但自动重试 worker 未实现，需运维监控与手动重试。

## 最终判定

V2 已形成可合并 `main`、可进入试运行环境的核心平台基线。进入依赖外部能力的生产场景前，必须单独完成对应凭证、回调和远端存储验收。
