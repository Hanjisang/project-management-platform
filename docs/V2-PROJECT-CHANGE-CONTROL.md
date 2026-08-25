# V2 Project Change Control

项目启动时必须已有执行计划、指定 approver 和有效的开始/完成日期。启动事务创建批准基线 V1，快照项目日期、阶段、WorkItem、Checklist 和 Deliverable。后续分类始终与最新批准基线比较，不能用连续小调整重置分母。

## 分类规则

`changeRate = (提议工期 - 基线工期) / 基线工期 × 100%`。不涉及正式范围且 `abs(changeRate) <= 20%` 时可直接调整；`abs(changeRate) > 20%` 或涉及范围时必须创建 Change Request。边界 +20% 和 -20% 属于直接调整，超过边界才进入 CR。

直接调整写 `ProjectAdjustmentLog`，包括操作人、理由、前后摘要、基线、前后完成日期和变化率，并通知项目相关人员。活动项目中的可选手工 WorkItem 创建、计划字段修改和取消同样记录调整；必需项的新增/取消或正式范围变化必须走 CR。

## CR 生命周期

生命周期为 DRAFT → PENDING_APPROVAL → APPROVED → APPLYING → APPLIED，或 REJECTED/FAILED。提出人和 approver 必须是不同用户；只有项目指定 approver 可以批准/驳回，只有项目经理可以应用。Operation 在创建时做项目归属校验，禁止跨项目 ID。

应用过程使用数据库事务和项目写锁，支持日期、阶段、WorkItem、Checklist、Deliverable、负责人、验收准则及 needs-revision 操作。全部 operation 成功后写应用时间、审计和通知，并创建下一版批准基线；任一操作失败则整体回滚，不产生部分生效。

AI impact summary 通过配置的 AI Provider 生成严格结构化摘要、计划/范围影响、风险和建议，但不参与分类、审批或应用授权。没有真实 Provider 时系统保存明确的 `AI_NOT_CONFIGURED` 状态，并继续使用确定性规则完成影响分类。
