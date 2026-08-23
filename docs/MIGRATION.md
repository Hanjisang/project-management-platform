# V1 → V2 迁移

V1 功能基线记录在 `docs/V1-FEATURE-INVENTORY.md`。V2 在 `refactor/v2-production-architecture` 分支重建，不在旧 `server.js` 和单页 `index.html` 上继续堆叠。V1 文件当前只作核对材料，V2 npm scripts、Docker 与 CI 均不引用它们。

建议在隔离环境部署 V2 空库并执行 migrations/seed；编写一次性 ETL 映射 V1 用户、项目、模板、任务和文档元数据，文件复制后校验 SHA-256；核对数量、外键、权限和抽样链路后，在维护窗口做最终增量导入与切换。

当前仓库未自动搬迁既有生产数据，因为没有获得真实生产库结构、数据质量与文件存储清单。切换前必须备份 V1 数据库和上传目录，并在预生产环境演练回滚。V1 可通过 Git tag/commit 重新构建，但不得与 V2 共用写库。
