# V2 Progress Rules

进度只由后端统一计算，前端不保存第二份事实。ProjectChecklistItem 和最新 DocumentVersion 的有效审查是 WorkItem 的输入，阶段/计划/项目再按权重向上聚合。

## WorkItem

只统计 required 单元：必需检查项每项权重 1；必交交付物每项权重 1。可选项不进入分子或分母。取消 WorkItem 不进入阶段聚合。

交付物贡献固定为：未上传 0；已上传最新版本 0.5；AI 审核中/拒绝/失败、人工拒绝、needs revision 均保持 0.5；只有当前 review mode 下最新版本最终通过才为 1。

公式：`round((已完成必需检查项数 + 必交交付物贡献之和) / (必需检查项数 + 必交交付物数) × 100)`。

示例：WorkItem 有 2 个必需 Checklist 和 1 个必交 Deliverable。初始为 0/3=0%；勾选一个为 1/3=33%；两个都勾选为 2/3=67%；上传交付物为 2.5/3=83%；最终审核通过为 3/3=100%。达到 100% 仍需显式 complete 才变为 DONE。

上传新版本会立即使交付物回到 0.5 并重新计算。若已 DONE 的 WorkItem 因新版本或退回低于 100%，状态恢复为 IN_PROGRESS，历史版本和审查不删除。

## Stage / Plan / Project

Stage 对未取消 WorkItem 按 weight 加权；Plan 对 Stage 按 weight 加权；Project 镜像 Plan progress。零权重集合使用共享的均值回退规则。Checklist、审查、版本上传、WorkItem complete/cancel 后在同一业务链路触发重算。
