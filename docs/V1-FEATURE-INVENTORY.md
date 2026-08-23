# V1 功能盘点与 V2 落点

> 盘点基线：V1.1（Git `9063d5d`）。V1 只作为产品需求证据，不作为技术兼容目标。

| V1 功能                                  | 进入 V2 | V2 实现位置                          | 重设计 | 备注                                         |
| ---------------------------------------- | ------- | ------------------------------------ | ------ | -------------------------------------------- |
| 账号密码登录、HttpOnly Cookie            | 是      | `apps/api/src/auth`                  | 是     | Access/Refresh 双 Cookie，Refresh 只存哈希   |
| 用户、角色、动态权限                     | 是      | `users` / `roles` / `permissions`    | 是     | 多角色标准 RBAC，稳定英文权限码              |
| 项目成员数据边界                         | 是      | `projects` / `project-members`       | 是     | 功能权限 + ProjectMember 双重控制            |
| 项目创建、启动、暂停、恢复、结项         | 是      | `projects`                           | 是     | 英文状态机，结项返回结构化 blocker           |
| SOP 模板、阶段、任务、检查项             | 是      | `sop`                                | 是     | 移除整体 JSON，发布版本不可变                |
| 按工期的最大余数权重归一                 | 是      | `@pmp/shared-utils`                  | 保留   | 同层权重稳定合计 100                         |
| SOP 生成项目计划                         | 是      | `project-plans`                      | 是     | 规范化不可变快照，不受后续 SOP 污染          |
| SOP 同步与保留现场进度                   | 是      | `project-plans`                      | 是     | 先预览 Diff，确认后事务应用                  |
| 计划任务、执行任务和检查项连动           | 是      | `project-plans` / `tasks`            | 是     | `ProjectPlanTask ≠ Task`，Checklist 逐层计算 |
| 任务 CRUD、进度、负责人、禅道记录        | 是      | `tasks` / `integrations/zentao`      | 是     | 英文状态/优先级，外部调用隔离                |
| 问题、风险、变更、阻塞                   | 是      | `issues`                             | 是     | 统一模型，增加概率/影响/风险评分             |
| 交付文档上传、审核、下载                 | 是      | `documents`                          | 是     | Document/Version/Review 三模型，对象存储补偿 |
| 14 份标准交付物模板                      | 是      | `templates/` + SOP 交付物字段        | 保留   | 实施任务标准交付物                           |
| 人工、机器人、日报卡片消息入口           | 是      | `messages` / `integrations/dingtalk` | 是     | 统一 Message 管道，机器人必须验签防重放      |
| AI 结构化分析与确认生成任务/问题         | 是      | `messages` / `integrations/ai`       | 是     | AI 只生成 PendingAction，人工确认幂等落库    |
| 日报、周报和项目报表                     | 是      | `daily-reports` / `weekly-reports`   | 是     | 服务端聚合，受项目作用域限制                 |
| 知识文章审核、文档沉淀                   | 是      | `knowledge`                          | 是     | 分类/文章/附件正式模型                       |
| 管理驾驶舱与人员负荷                     | 是      | `dashboard`                          | 是     | 所有统计先应用项目作用域                     |
| 审计日志                                 | 是      | `audit`                              | 是     | 请求 ID、IP、UA、before/after；失败不静默    |
| 禅道任务同步                             | 是      | `integrations/zentao`                | 是     | Client/Service/Mapper，未配置明确报错        |
| 筛选记忆、抽屉编辑、阶段折叠、响应式卡片 | 是      | `apps/web`                           | 保留   | Vue 组件、Router 和 Element Plus             |
| SOP 本地版本历史、Data URL 模板          | 否      | 无                                   | 是     | 改为数据库版本和正式对象存储                 |
| JSON 业务回退、单文件服务器/前端         | 否      | 无                                   | 是     | V2 只使用 MySQL + NestJS + Vue               |

## 容易遗漏的 V1 规则

- 项目负责人必须同时是项目成员。
- 结项必须同时检查计划节点、执行任务、高优问题和必需交付物。
- 项目计划同步不能清空已完成检查项、实际日期、负责人和项目自定义任务。
- 文档必须审核通过后才能解除必需交付物阻塞，也才能沉淀知识。
- 未归属项目的消息仅管理员可见；确认时必须重新检查目标项目权限。
- 钉钉不宣称监听全部群聊，只支持可被安全验证的主动入口。
