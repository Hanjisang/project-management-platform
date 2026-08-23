# SOP 与计划设计

权威设计见 [SOP-DESIGN.md](SOP-DESIGN.md)。实现位于 `apps/api/src/sop`、`apps/api/src/project-plans` 及对应 Vue 页面。

发布版本不可编辑；生成计划和同步计划均在数据库事务中完成。稳定键用于跨版本 diff，diffHash 防止用户应用过期预览。检查项完成后由后端逐层重算任务、阶段、计划和项目进度。
