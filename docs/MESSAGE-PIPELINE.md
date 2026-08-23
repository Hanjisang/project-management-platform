# 消息处理管线

所有人工/外部消息先写 Message。分析请求创建 MessageAnalysis，再调用 AiProvider；严格 Schema 通过后只创建 PendingAction。用户确认时校验项目范围、操作归属和可编辑 payload，并在 Serializable 事务中以条件更新抢占 PENDING 状态，随后创建 Task/Issue/ProjectNote 或更新计划进度。

重复确认看到的状态已不是 PENDING，因此不会重复创建业务对象。外部消息使用 externalMessageId upsert。AI 未配置或校验失败时记录失败码，正式业务表不写入。
