# 消息处理管线

所有人工/外部消息先写 Message。分析请求创建 MessageAnalysis，再调用 AiProvider；严格 Schema 通过后只创建 PendingAction。人工确认时校验项目范围、操作归属和可编辑 payload，并在 Serializable 事务中抢占 PENDING 状态，随后创建 ProjectWorkItem、Issue、ProjectNote 或更新计划事实。

重复确认不会重复创建业务对象，外部消息使用 externalMessageId upsert。AI 未配置或 Schema 校验失败时记录明确失败码，正式业务表不写入。测试 Fake 仅在 `NODE_ENV=test` 且显式 `AI_FAKE_ENABLED=true` 时可用。
