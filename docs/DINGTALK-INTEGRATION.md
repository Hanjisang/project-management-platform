# 钉钉集成

综合说明见 [INTEGRATIONS.md](INTEGRATIONS.md)。配置项为 `DINGTALK_APP_KEY`、`DINGTALK_APP_SECRET`、`DINGTALK_SIGNING_SECRET` 和 `DINGTALK_STREAM_ENABLED`。

生产回调入口验证 HMAC、timestamp 和 nonce，之后由 Mapper 转为统一 Message，并以 externalMessageId 幂等入库。当前真实能力是机器人 @ 回调和人工导入；Stream 仅暴露配置状态，未实现也未声称全量群聊监听。
