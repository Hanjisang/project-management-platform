# V2 Execution Domain

## 目标模型

项目执行只有一个实体：`ProjectWorkItem`。它同时承载计划节点、执行状态、负责人、日期、进度、层级和来源；Checklist、Deliverable、Document、Message Action 与 ZenTao Sync 都直接关联它。`SopTask` 只属于模板定义，项目生成后以稳定键和源 ID 保留来源快照。

来源分为 `SOP`、`MANUAL`、`MESSAGE`、`ISSUE`、`ZENTAO`、`CHANGE`，新建的可溯源来源同时持久化 `sourceId`。SOP 生成和同步幂等；手工项用于临时工作；消息确认和正式变更直接保存真实来源。PendingAction 反查保留为旧数据兼容 fallback。活动项目中，必需范围不能靠普通编辑删除或取消，必须走 Change Request。

## 执行规则

WorkItem 状态为 TODO、IN_PROGRESS、BLOCKED、DONE、CANCELLED。检查项或交付物发生有效活动会进入 IN_PROGRESS；完成必须显式调用 complete，并校验必需检查项全部完成、必交交付物最近版本最终通过。取消项不参与阶段进度。

有必需单元时，进度为 `round((完成检查项 + 交付物贡献) / 必需单元总数 × 100)`：未提交交付物为 0，已上传/待最终结论为 0.5，通过为 1。无必需单元的手工项允许人工维护进度。阶段和项目使用权重聚合。

## SOP 快照与升级

生成计划时，在单事务中复制阶段、WorkItem、Checklist、Deliverable、Review Criterion 和 Template metadata。项目运行时不读取后续 SOP 改动。升级使用 stable key 生成 diffHash，应用前再次计算防止陈旧 diff；已产生执行数据的被删除节点保留为 custom 历史。

## 权限与可观测性

所有 WorkItem 读写都验证平台权限和 Project Scope。项目经理负责活动计划调整和 CR；指定 approver 负责审批。关键创建、编辑、完成、取消、Checklist、审查、直接调整和 CR 状态动作写 AuditLog，调整/审批同时写 Notification。

## 兼容性

前端“任务中心”是 WorkItem 的用户界面名称；API 不再提供项目执行 `/tasks` 或 `/plan-tasks`。SOP 的 `/sop/tasks` 路由是模板定义接口，不属于双轨执行模型。
