ALTER TABLE `tasks`
  ADD COLUMN `primary_plan_task_id` VARCHAR(30) NULL AFTER `plan_task_id`,
  ADD UNIQUE INDEX `tasks_primary_plan_task_id_key` (`primary_plan_task_id`),
  ADD INDEX `tasks_plan_task_id_idx` (`plan_task_id`);

INSERT INTO `tasks` (
  `id`, `project_id`, `plan_task_id`, `primary_plan_task_id`, `title`, `description`,
  `owner_user_id`, `status`, `priority`, `planned_start_date`, `due_date`,
  `completed_at`, `progress`, `source_type`, `source_id`, `created_by_id`,
  `created_at`, `updated_at`
)
SELECT
  CONCAT('p', LEFT(REPLACE(UUID(), '-', ''), 24)),
  plan.`project_id`,
  plan_task.`id`,
  plan_task.`id`,
  plan_task.`name`,
  plan_task.`description`,
  COALESCE(plan_task.`owner_user_id`, project.`manager_user_id`),
  CASE WHEN plan_task.`progress` > 0 THEN 'IN_PROGRESS' ELSE 'TODO' END,
  'MEDIUM',
  plan_task.`planned_start_date`,
  plan_task.`planned_end_date`,
  NULL,
  plan_task.`progress`,
  'SOP',
  plan_task.`id`,
  project.`manager_user_id`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `project_plan_tasks` plan_task
INNER JOIN `project_plan_stages` stage ON stage.`id` = plan_task.`plan_stage_id`
INNER JOIN `project_plans` plan ON plan.`id` = stage.`plan_id`
INNER JOIN `projects` project ON project.`id` = plan.`project_id`;

ALTER TABLE `tasks`
  ADD CONSTRAINT `tasks_primary_plan_task_id_fkey`
    FOREIGN KEY (`primary_plan_task_id`) REFERENCES `project_plan_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
