# 外部集成

## AI 消息分析

配置 `AI_ENABLED=true`、`AI_API_KEY`、`AI_MODEL` 和可选 `AI_BASE_URL` 后启用。适配器调用 OpenAI-compatible Responses API，并用严格 JSON Schema/Zod 双重校验输出。无密钥时系统正常运行且分析接口返回 `AI_NOT_CONFIGURED`。FakeAiProvider 仅在测试环境显式启用时可用。

AI 输出不会直接修改业务数据，而是保存 MessageAnalysis 和 PendingAction；用户逐项确认或拒绝，确认操作以串行化事务和状态抢占保证幂等。

## 钉钉

DingtalkClient、DingtalkService、DingtalkMessageMapper 和签名服务分层实现。入口支持机器人被 @ 的回调及人工导入；回调校验签名、5 分钟时间窗和 nonce 防重放。平台不宣称能监听全部群聊，状态 API 明确返回 `fullChatMonitoring: false`。

## 禅道

ZentaoClient、ZentaoService 和 ZentaoMapper 实现平台任务单向同步。ZentaoTaskSync 保存外部任务 ID、幂等键、状态、错误和最后同步时间；未配置 URL/Token 时同步明确失败，不伪造成功。
