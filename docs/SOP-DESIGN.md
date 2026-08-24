# SOP 与实施计划

SOP 模板包含版本、阶段、任务定义、检查项和 0–N 个交付物。交付物可配置必交标记、审查模式、AI 通过阈值、审查说明、结构化验收准则和 0–N 个模板文件。模板文件经 StorageProvider 保存，单文件上限 50MB。

版本只允许在 DRAFT 编辑；发布后定义与文件不可变。修改必须 Clone Version，在新草稿发布。克隆会复制独立存储对象，避免删除草稿影响已发布版本。

项目选择已发布版本后，在一个事务中生成 ProjectPlan、ProjectStage、ProjectWorkItem、Checklist、Deliverable、Criterion 和模板文件快照。项目执行只读快照，不实时读取 SOP；`sourceSopTaskKey` 用于升级 diff。手工 WorkItem 可追加到项目计划，但不制造第二套 Task。

升级流程为：选择新版本 → 以稳定键计算 ADD/MODIFY/REMOVE 和 diffHash → 用户审阅 → 服务端重算防止过期预览 → 事务同步。已产生执行事实的删除项会保留为 custom 历史；活动项目的正式范围变化必须通过 CR 应用。

WorkItem 进度按必需完成单元计算：必需检查项完成计 1，必交交付物未提交计 0、已上传但尚无最终通过计 0.5、最终通过计 1；`round(已完成单元 / 必需单元 × 100)`。阶段和项目按权重聚合，取消项不参与分母。达到 100% 不自动 DONE，仍需显式完成；上传新版本或审查退回会重新计算并可将 DONE 恢复为 IN_PROGRESS。
