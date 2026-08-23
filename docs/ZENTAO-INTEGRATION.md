# 禅道集成

配置 `ZENTAO_BASE_URL` 和 `ZENTAO_TOKEN` 后可从任务中心发起平台 → 禅道单向同步。ZentaoMapper 负责业务字段映射，ZentaoClient 负责 HTTP，ZentaoService 负责权限、幂等和状态编排。

每个 Task 只有一条 ZentaoTaskSync，保存 externalTaskId、syncStatus、lastSyncedAt 和 lastError。成功记录会直接复用；失败可在修复配置后重试。未配置时返回 `ZENTAO_NOT_CONFIGURED`。
