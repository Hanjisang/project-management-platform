# V2 Execution Acceptance

验收日期：2026-08-24。分支：`feat/v2-execution-domain-redesign`。结论：P0=0、P1=0，核心 E2E 通过，满足 UAT 准入。

## 业务闭环

SOP Draft 可配置 Stage、Task、Checklist、Deliverable、真实 Template、Review Criteria 和三种 review mode；Published 完全冻结，Clone 后可编辑。生成 ProjectPlan 时事务复制完整快照，只产生 ProjectWorkItem。执行页、任务中心和 Drawer 读取同一 Checklist/Deliverable/DocumentVersionReview 事实。

必交交付物上传贡献 50%，最终审查通过为 100%；人工可覆盖 AI，AI 失败或未配置可转人工，最新 DocumentVersion 决定状态。WorkItem、Stage、Plan、Project 自动重算，完成条件不足会阻断。

项目启动创建 baseline；±20% 内直接调整会留档和通知，超过阈值或 scope change 必须 CR。指定 approver 审批后由 PM 事务 apply，创建新 baseline，取消项保留历史。

## 证据

- Fresh MySQL 8.4：5/5 migration + seed；Prisma schema diff 无差异。
- Upgrade fixture：原 PlanTask/Task、Checklist、Deliverable、DocumentVersion、Review、ZenTao 映射关联保留。
- Unit 89/89，Integration 36/36，Playwright E2E 11/11；0 failed、0 skipped。
- format、lint、typecheck、build、git diff check 通过；npm audit 为 0 vulnerabilities。
- Docker MySQL/API/Web healthy；`/health` 为 database up、LocalStorage configured、未配置集成不影响全局健康。
- 应用内浏览器打开 8080 登录页，无控制台 warning/error；真实业务页面由 Playwright 浏览器在隔离库完成写入型验收。

## 已知事项

- P0：无。
- P1：无。
- P2：生产尚未配置真实 AI/DingTalk/ZenTao 凭证；AI provider 的真实外部连通性需在 UAT secret 就绪后复验。50 WorkItem/300 Checklist/100 Deliverable 未做独立压测，但 Execution API 使用单次嵌套查询，不按条目发请求。

发布前完整数据库备份：`.backups/pre_execution_redesign_20260824_complete.sql`。Execution Redesign 删除旧双轨表，应用回滚必须同时恢复该备份。
