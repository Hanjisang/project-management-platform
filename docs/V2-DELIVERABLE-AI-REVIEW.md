# V2 Deliverable AI Review

## 版本边界

每一次上传产生独立 `DocumentVersion`。AI 和人工审查都写入 `DocumentVersionReview`，Finding 和 Criterion Result 归属于该次审查。有效结论永远只取最近上传版本；新版本不会继承旧版本通过状态。

## 审查模式

- `HUMAN_ONLY`：只有最近一次有效人工审查可给出最终结论。
- `AI_THEN_HUMAN_REQUIRED`：AI 先提供结构化结果，但仍必须人工最终通过。
- `AI_WITH_HUMAN_OVERRIDE`：AI 可直接通过；任意后续人工结论覆盖 AI。

AI 输出经严格 Zod Schema 校验，包含 decision、score、summary、decisionReason、findings 和逐准则结果。模型结果无法解析、缺字段、超时、文件不可提取或 provider 未配置时，Job 进入 FAILED 并保留明确错误，不伪造通过。用户可对同一版本调用 retry；`AiReviewJob.documentVersionId` 唯一，重复请求不产生并行重复任务。

## 文件提取

自动文本提取支持 TXT、CSV、DOCX、XLSX、PDF、PPTX。旧版二进制 Office、图片和其他不支持格式可存储，但 AI 审查明确失败并转人工流程。单文件上限 50MB，上传同时校验扩展名、MIME、魔数/内容与 checksum。

## Provider 配置

生产需显式设置 `AI_ENABLED=true`、兼容端点、API Key 和模型。未配置时使用 NotConfigured provider。Fake provider 仅供自动化测试，并且只有 `NODE_ENV=test` 与 `AI_FAKE_ENABLED=true` 同时满足才启用；生产绝不回退到 Fake。

## 人工审查约束

审查人必须拥有项目范围和 Document Review 权限。非管理员不能审查自己上传的版本。人工审查和 AI 结果并存，保留完整时间线与问题项；交付物完成判断由统一 decision service 计算，WorkItem 完成与项目结项复用同一事实。
