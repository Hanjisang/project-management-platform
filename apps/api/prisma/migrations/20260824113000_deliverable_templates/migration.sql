CREATE TABLE `sop_deliverables` (
  `id` VARCHAR(30) NOT NULL,
  `sop_task_id` VARCHAR(30) NOT NULL,
  `stable_key` VARCHAR(30) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sop_deliverables_sop_task_id_stable_key_key` (`sop_task_id`, `stable_key`),
  UNIQUE INDEX `sop_deliverables_sop_task_id_sort_order_key` (`sop_task_id`, `sort_order`),
  INDEX `sop_deliverables_sop_task_id_idx` (`sop_task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sop_deliverable_templates` (
  `id` VARCHAR(30) NOT NULL,
  `deliverable_id` VARCHAR(30) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `object_key` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(150) NOT NULL,
  `size` BIGINT UNSIGNED NOT NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `uploaded_by_id` VARCHAR(30) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sop_deliverable_templates_object_key_key` (`object_key`),
  INDEX `sop_deliverable_templates_deliverable_id_created_at_idx` (`deliverable_id`, `created_at`),
  INDEX `sop_deliverable_templates_uploaded_by_id_idx` (`uploaded_by_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_deliverables` (
  `id` VARCHAR(30) NOT NULL,
  `plan_task_id` VARCHAR(30) NOT NULL,
  `source_deliverable_id` VARCHAR(30) NULL,
  `source_deliverable_key` VARCHAR(30) NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL,
  `is_custom` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `project_deliverables_plan_task_id_source_deliverable_key_key` (`plan_task_id`, `source_deliverable_key`),
  UNIQUE INDEX `project_deliverables_plan_task_id_sort_order_key` (`plan_task_id`, `sort_order`),
  INDEX `project_deliverables_plan_task_id_idx` (`plan_task_id`),
  INDEX `project_deliverables_source_deliverable_id_idx` (`source_deliverable_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_deliverable_templates` (
  `id` VARCHAR(30) NOT NULL,
  `project_deliverable_id` VARCHAR(30) NOT NULL,
  `source_template_id` VARCHAR(30) NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `object_key` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(150) NOT NULL,
  `size` BIGINT UNSIGNED NOT NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `project_delivery_template_source_key` (`project_deliverable_id`, `source_template_id`),
  INDEX `project_deliverable_templates_project_deliverable_id_idx` (`project_deliverable_id`),
  INDEX `project_deliverable_templates_source_template_id_idx` (`source_template_id`),
  INDEX `project_deliverable_templates_object_key_idx` (`object_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `documents`
  ADD COLUMN `project_deliverable_id` VARCHAR(30) NULL AFTER `plan_task_id`,
  ADD INDEX `documents_project_deliverable_id_idx` (`project_deliverable_id`);

INSERT INTO `sop_deliverables` (
  `id`, `sop_task_id`, `stable_key`, `name`, `description`, `required`, `sort_order`, `created_at`, `updated_at`
)
SELECT
  CONCAT('m', LEFT(REPLACE(UUID(), '-', ''), 24)),
  `id`,
  CONCAT('legacy-', LEFT(`stable_key`, 23)),
  COALESCE(NULLIF(`deliverable_name`, ''), `name`),
  CASE
    WHEN `deliverable_template` IS NULL OR `deliverable_template` = '' THEN NULL
    ELSE CONCAT('历史模板名称：', `deliverable_template`, '。该名称未迁移为真实模板文件，请在新草稿版本中重新上传。')
  END,
  `deliverable_required`,
  0,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `sop_tasks`
WHERE `deliverable_required` = true
   OR (`deliverable_name` IS NOT NULL AND `deliverable_name` <> '')
   OR (`deliverable_template` IS NOT NULL AND `deliverable_template` <> '');

INSERT INTO `project_deliverables` (
  `id`, `plan_task_id`, `source_deliverable_id`, `source_deliverable_key`, `name`, `description`, `required`, `sort_order`, `is_custom`, `created_at`, `updated_at`
)
SELECT
  CONCAT('m', LEFT(REPLACE(UUID(), '-', ''), 24)),
  task.`id`,
  source_deliverable.`id`,
  source_deliverable.`stable_key`,
  COALESCE(NULLIF(task.`deliverable_name`, ''), task.`name`),
  NULL,
  task.`deliverable_required`,
  0,
  CASE WHEN source_deliverable.`id` IS NULL THEN true ELSE false END,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `project_plan_tasks` task
LEFT JOIN `sop_deliverables` source_deliverable
  ON source_deliverable.`sop_task_id` = task.`source_task_id`
 AND source_deliverable.`sort_order` = 0
WHERE task.`deliverable_required` = true
   OR (task.`deliverable_name` IS NOT NULL AND task.`deliverable_name` <> '');

UPDATE `documents` document
INNER JOIN `project_deliverables` deliverable
  ON deliverable.`plan_task_id` = document.`plan_task_id`
SET document.`project_deliverable_id` = deliverable.`id`
WHERE document.`project_deliverable_id` IS NULL;

ALTER TABLE `sop_deliverables`
  ADD CONSTRAINT `sop_deliverables_sop_task_id_fkey`
    FOREIGN KEY (`sop_task_id`) REFERENCES `sop_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sop_deliverable_templates`
  ADD CONSTRAINT `sop_deliverable_templates_deliverable_id_fkey`
    FOREIGN KEY (`deliverable_id`) REFERENCES `sop_deliverables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sop_deliverable_templates_uploaded_by_id_fkey`
    FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `project_deliverables`
  ADD CONSTRAINT `project_deliverables_plan_task_id_fkey`
    FOREIGN KEY (`plan_task_id`) REFERENCES `project_plan_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `project_deliverables_source_deliverable_id_fkey`
    FOREIGN KEY (`source_deliverable_id`) REFERENCES `sop_deliverables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `project_deliverable_templates`
  ADD CONSTRAINT `project_deliverable_templates_project_deliverable_id_fkey`
    FOREIGN KEY (`project_deliverable_id`) REFERENCES `project_deliverables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `project_deliverable_templates_source_template_id_fkey`
    FOREIGN KEY (`source_template_id`) REFERENCES `sop_deliverable_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `documents`
  ADD CONSTRAINT `documents_project_deliverable_id_fkey`
    FOREIGN KEY (`project_deliverable_id`) REFERENCES `project_deliverables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `sop_tasks`
  DROP COLUMN `deliverable_required`,
  DROP COLUMN `deliverable_name`,
  DROP COLUMN `deliverable_template`;

ALTER TABLE `project_plan_tasks`
  DROP COLUMN `deliverable_required`,
  DROP COLUMN `deliverable_name`;
