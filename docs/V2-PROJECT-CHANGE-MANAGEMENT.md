# V2 Project Change Management

项目经理提出计划变化，系统始终相对最新批准 baseline 分类。总体完成时间绝对变化不超过 20% 且不涉及正式范围时直接生效，同时写 AdjustmentLog、AuditLog 并通知 approver/相关负责人；+20% 和 -20% 属于直接调整，±20.01% 必须审批。

任何正式 scope change、Required WorkItem/Checklist/Deliverable 的新增或取消、验收准则变化，均创建 Project Change Request。CR 保存结构化 operation 和前后 payload，DRAFT 提交后由项目指定 approver 审批；错误审批人、非项目经理提交、跨项目 entityId 均拒绝。

批准不等于生效。项目经理显式 apply 后，服务在 Serializable 事务中锁定项目、逐项应用 diff、保留取消历史、重算执行状态并创建下一版 baseline；重复 approve/apply 按状态机拒绝或幂等返回，不会产生重复基线或部分应用。

AI impact summary 通过配置的 Provider 生成结构化摘要、计划/范围影响、风险和建议，仅作辅助，不改变 ±20%/scope 的确定性规则，也不能自动批准。生产 AI 未配置时保存明确降级状态，CR 仍可完整提交、审批和应用。

详细模型和 operation 列表见 [V2-PROJECT-CHANGE-CONTROL.md](V2-PROJECT-CHANGE-CONTROL.md)。
