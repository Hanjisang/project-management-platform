-- DropForeignKey
ALTER TABLE `document_reviews` DROP FOREIGN KEY `document_reviews_document_id_fkey`;

-- DropForeignKey
ALTER TABLE `document_reviews` DROP FOREIGN KEY `document_reviews_reviewer_id_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_plan_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_checklist_items` DROP FOREIGN KEY `project_checklist_items_plan_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_deliverables` DROP FOREIGN KEY `project_deliverables_plan_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_plan_stages` DROP FOREIGN KEY `project_plan_stages_plan_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_plan_stages` DROP FOREIGN KEY `project_plan_stages_source_stage_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_plan_tasks` DROP FOREIGN KEY `project_plan_tasks_owner_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_plan_tasks` DROP FOREIGN KEY `project_plan_tasks_plan_stage_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_plan_tasks` DROP FOREIGN KEY `project_plan_tasks_source_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_created_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_owner_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_plan_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_primary_plan_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `zentao_task_syncs` DROP FOREIGN KEY `zentao_task_syncs_task_id_fkey`;

-- DropIndex
DROP INDEX `documents_plan_task_id_idx` ON `documents`;

-- DropIndex
DROP INDEX `project_checklist_items_plan_task_id_completed_idx` ON `project_checklist_items`;

-- DropIndex
DROP INDEX `project_checklist_items_plan_task_id_sort_order_key` ON `project_checklist_items`;

-- DropIndex
DROP INDEX `project_deliverables_plan_task_id_idx` ON `project_deliverables`;

-- DropIndex
DROP INDEX `project_deliverables_plan_task_id_sort_order_key` ON `project_deliverables`;

-- DropIndex
DROP INDEX `project_deliverables_plan_task_id_source_deliverable_key_key` ON `project_deliverables`;

-- DropIndex
DROP INDEX `zentao_task_syncs_task_id_key` ON `zentao_task_syncs`;

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `work_item_id` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `project_checklist_items` ADD COLUMN `work_item_id` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `project_deliverables` ADD COLUMN `ai_auto_approve_threshold` TINYINT UNSIGNED NULL,
    ADD COLUMN `ai_review_instruction` TEXT NULL,
    ADD COLUMN `needs_revision` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `review_mode` ENUM('AI_WITH_HUMAN_OVERRIDE', 'AI_THEN_HUMAN_REQUIRED', 'HUMAN_ONLY') NOT NULL DEFAULT 'HUMAN_ONLY',
    ADD COLUMN `revision_reason` TEXT NULL,
    ADD COLUMN `work_item_id` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `project_plans` MODIFY `source_sop_version_id` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `projects` ADD COLUMN `approver_user_id` VARCHAR(30) NULL;

UPDATE `projects`
SET `approver_user_id` = `manager_user_id`
WHERE `approver_user_id` IS NULL;

-- AlterTable
ALTER TABLE `sop_deliverables` ADD COLUMN `ai_auto_approve_threshold` TINYINT UNSIGNED NULL,
    ADD COLUMN `ai_review_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ai_review_instruction` TEXT NULL,
    ADD COLUMN `review_mode` ENUM('AI_WITH_HUMAN_OVERRIDE', 'AI_THEN_HUMAN_REQUIRED', 'HUMAN_ONLY') NOT NULL DEFAULT 'HUMAN_ONLY';

-- AlterTable
ALTER TABLE `zentao_task_syncs` ADD COLUMN `work_item_id` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `sop_deliverable_review_criteria` (
    `id` VARCHAR(30) NOT NULL,
    `deliverable_id` VARCHAR(30) NOT NULL,
    `stable_key` VARCHAR(30) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sop_deliverable_review_criteria_deliverable_id_idx`(`deliverable_id`),
    UNIQUE INDEX `sop_deliverable_review_criteria_deliverable_id_stable_key_key`(`deliverable_id`, `stable_key`),
    UNIQUE INDEX `sop_deliverable_review_criteria_deliverable_id_sort_order_key`(`deliverable_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Rename the plan-stage table in place so stage ids and all historical dates remain stable.
RENAME TABLE `project_plan_stages` TO `project_stages`;

ALTER TABLE `project_stages`
    RENAME INDEX `project_plan_stages_plan_id_idx` TO `project_stages_plan_id_idx`,
    RENAME INDEX `project_plan_stages_source_stage_id_idx` TO `project_stages_source_stage_id_idx`,
    RENAME INDEX `project_plan_stages_source_stage_key_idx` TO `project_stages_source_stage_key_idx`,
    RENAME INDEX `project_plan_stages_plan_id_sort_order_key` TO `project_stages_plan_id_sort_order_key`;

-- CreateTable
CREATE TABLE `project_work_items` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `plan_stage_id` VARCHAR(30) NOT NULL,
    `source_sop_task_id` VARCHAR(30) NULL,
    `source_sop_task_key` VARCHAR(30) NULL,
    `parent_work_item_id` VARCHAR(30) NULL,
    `name` VARCHAR(240) NOT NULL,
    `description` TEXT NULL,
    `owner_user_id` VARCHAR(30) NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `planned_start_date` DATE NULL,
    `planned_end_date` DATE NULL,
    `actual_start_date` DATETIME(3) NULL,
    `actual_end_date` DATETIME(3) NULL,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `source_type` ENUM('SOP', 'MANUAL', 'CHANGE') NOT NULL DEFAULT 'MANUAL',
    `sort_order` INTEGER NOT NULL,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `is_custom` BOOLEAN NOT NULL DEFAULT false,
    `cancelled_by_change_request_id` VARCHAR(30) NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_work_items_project_id_status_idx`(`project_id`, `status`),
    INDEX `project_work_items_project_id_planned_end_date_idx`(`project_id`, `planned_end_date`),
    INDEX `project_work_items_plan_stage_id_idx`(`plan_stage_id`),
    INDEX `project_work_items_source_sop_task_id_idx`(`source_sop_task_id`),
    INDEX `project_work_items_source_sop_task_key_idx`(`source_sop_task_key`),
    INDEX `project_work_items_parent_work_item_id_idx`(`parent_work_item_id`),
    INDEX `project_work_items_owner_user_id_status_idx`(`owner_user_id`, `status`),
    INDEX `project_work_items_cancelled_by_change_request_id_idx`(`cancelled_by_change_request_id`),
    UNIQUE INDEX `project_work_items_plan_stage_id_sort_order_key`(`plan_stage_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_deliverable_review_criteria` (
    `id` VARCHAR(30) NOT NULL,
    `project_deliverable_id` VARCHAR(30) NOT NULL,
    `source_criterion_id` VARCHAR(30) NULL,
    `source_criterion_key` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL,

    INDEX `project_deliverable_review_criteria_source_criterion_id_idx`(`source_criterion_id`),
    UNIQUE INDEX `project_delivery_criterion_source_key`(`project_deliverable_id`, `source_criterion_key`),
    UNIQUE INDEX `project_delivery_criterion_sort_key`(`project_deliverable_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_version_reviews` (
    `id` VARCHAR(30) NOT NULL,
    `document_version_id` VARCHAR(30) NOT NULL,
    `review_type` ENUM('AI', 'HUMAN') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reviewer_user_id` VARCHAR(30) NULL,
    `ai_provider` VARCHAR(80) NULL,
    `ai_model` VARCHAR(120) NULL,
    `score` TINYINT UNSIGNED NULL,
    `summary` TEXT NULL,
    `decision_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,

    INDEX `document_version_reviews_document_version_id_created_at_idx`(`document_version_id`, `created_at`),
    INDEX `document_version_reviews_reviewer_user_id_status_idx`(`reviewer_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_findings` (
    `id` VARCHAR(30) NOT NULL,
    `review_id` VARCHAR(30) NOT NULL,
    `criterion_id` VARCHAR(30) NULL,
    `severity` ENUM('INFO', 'WARNING', 'ERROR') NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `suggestion` TEXT NULL,
    `sort_order` INTEGER NOT NULL,

    INDEX `review_findings_review_id_sort_order_idx`(`review_id`, `sort_order`),
    INDEX `review_findings_criterion_id_idx`(`criterion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_review_criterion_results` (
    `id` VARCHAR(30) NOT NULL,
    `review_id` VARCHAR(30) NOT NULL,
    `criterion_id` VARCHAR(30) NOT NULL,
    `passed` BOOLEAN NOT NULL,
    `score` TINYINT UNSIGNED NULL,
    `explanation` TEXT NULL,

    INDEX `document_review_criterion_results_criterion_id_idx`(`criterion_id`),
    UNIQUE INDEX `document_review_criterion_results_review_id_criterion_id_key`(`review_id`, `criterion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_review_jobs` (
    `id` VARCHAR(30) NOT NULL,
    `document_version_id` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `next_run_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_error` TEXT NULL,
    `claimed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_review_jobs_status_next_run_at_idx`(`status`, `next_run_at`),
    UNIQUE INDEX `ai_review_jobs_document_version_id_key`(`document_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_change_requests` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `change_type` ENUM('SCHEDULE', 'SCOPE', 'REQUIREMENT', 'DELIVERABLE', 'ACCEPTANCE', 'TECHNICAL', 'RESOURCE', 'MIXED') NOT NULL,
    `reason` TEXT NOT NULL,
    `source` ENUM('CUSTOMER', 'INTERNAL_PRODUCT', 'R_AND_D', 'THIRD_PARTY', 'ENVIRONMENT', 'POLICY', 'OTHER') NOT NULL,
    `status` ENUM('DRAFT', 'ANALYZING', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLYING', 'APPLIED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `requested_by_user_id` VARCHAR(30) NOT NULL,
    `approver_user_id` VARCHAR(30) NOT NULL,
    `submitted_at` DATETIME(3) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `applied_at` DATETIME(3) NULL,
    `approval_comment` TEXT NULL,
    `ai_impact_summary` LONGTEXT NULL,
    `failure_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_change_requests_project_id_status_created_at_idx`(`project_id`, `status`, `created_at`),
    INDEX `project_change_requests_approver_user_id_status_idx`(`approver_user_id`, `status`),
    UNIQUE INDEX `project_change_requests_project_id_code_key`(`project_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_change_operations` (
    `id` VARCHAR(30) NOT NULL,
    `change_request_id` VARCHAR(30) NOT NULL,
    `operation_type` ENUM('PROJECT_COMPLETION_DATE_CHANGE', 'ADD_STAGE', 'UPDATE_STAGE', 'CANCEL_STAGE', 'ADD_WORK_ITEM', 'UPDATE_WORK_ITEM', 'CANCEL_WORK_ITEM', 'ADD_CHECKLIST', 'UPDATE_CHECKLIST', 'CANCEL_CHECKLIST', 'ADD_DELIVERABLE', 'UPDATE_DELIVERABLE', 'CANCEL_DELIVERABLE', 'DELIVERABLE_NEEDS_REVISION', 'CHANGE_OWNER', 'CHANGE_ACCEPTANCE_CRITERIA') NOT NULL,
    `entity_id` VARCHAR(30) NULL,
    `sort_order` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_change_operations_change_request_id_operation_type_idx`(`change_request_id`, `operation_type`),
    UNIQUE INDEX `project_change_operations_change_request_id_sort_order_key`(`change_request_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_baselines` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `version` INTEGER NOT NULL,
    `planned_start_date` DATE NOT NULL,
    `planned_completion_date` DATE NOT NULL,
    `created_by_user_id` VARCHAR(30) NOT NULL,
    `source_change_request_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `project_baselines_source_change_request_id_key`(`source_change_request_id`),
    INDEX `project_baselines_project_id_created_at_idx`(`project_id`, `created_at`),
    UNIQUE INDEX `project_baselines_project_id_version_key`(`project_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_baseline_stages` (
    `id` VARCHAR(30) NOT NULL,
    `baseline_id` VARCHAR(30) NOT NULL,
    `source_stage_id` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `planned_start_date` DATE NULL,
    `planned_end_date` DATE NULL,

    INDEX `project_baseline_stages_source_stage_id_idx`(`source_stage_id`),
    UNIQUE INDEX `project_baseline_stages_baseline_id_sort_order_key`(`baseline_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_baseline_work_items` (
    `id` VARCHAR(30) NOT NULL,
    `baseline_stage_id` VARCHAR(30) NOT NULL,
    `source_work_item_id` VARCHAR(30) NULL,
    `name` VARCHAR(240) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `planned_start_date` DATE NULL,
    `planned_end_date` DATE NULL,

    INDEX `project_baseline_work_items_source_work_item_id_idx`(`source_work_item_id`),
    UNIQUE INDEX `project_baseline_work_items_baseline_stage_id_sort_order_key`(`baseline_stage_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_baseline_checklist_items` (
    `id` VARCHAR(30) NOT NULL,
    `baseline_work_item_id` VARCHAR(30) NOT NULL,
    `source_checklist_item_id` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL,

    INDEX `project_baseline_checklist_items_source_checklist_item_id_idx`(`source_checklist_item_id`),
    UNIQUE INDEX `project_baseline_checklist_items_baseline_work_item_id_sort__key`(`baseline_work_item_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_baseline_deliverables` (
    `id` VARCHAR(30) NOT NULL,
    `baseline_work_item_id` VARCHAR(30) NOT NULL,
    `source_deliverable_id` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL,
    `review_mode` ENUM('AI_WITH_HUMAN_OVERRIDE', 'AI_THEN_HUMAN_REQUIRED', 'HUMAN_ONLY') NOT NULL,

    INDEX `project_baseline_deliverables_source_deliverable_id_idx`(`source_deliverable_id`),
    UNIQUE INDEX `project_baseline_deliverables_baseline_work_item_id_sort_ord_key`(`baseline_work_item_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_adjustment_logs` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `operator_user_id` VARCHAR(30) NOT NULL,
    `adjustment_type` VARCHAR(80) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(30) NOT NULL,
    `before_summary` TEXT NOT NULL,
    `after_summary` TEXT NOT NULL,
    `reason` TEXT NOT NULL,
    `baseline_id` VARCHAR(30) NOT NULL,
    `completion_date_before` DATE NULL,
    `completion_date_after` DATE NULL,
    `change_rate` DECIMAL(8, 4) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_adjustment_logs_project_id_created_at_idx`(`project_id`, `created_at`),
    INDEX `project_adjustment_logs_baseline_id_idx`(`baseline_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NULL,
    `type` ENUM('PLAN_ADJUSTED', 'CHANGE_APPROVAL_REQUIRED', 'CHANGE_APPROVED', 'CHANGE_REJECTED', 'CHANGE_APPLIED', 'DELIVERABLE_AI_REVIEW_COMPLETED', 'DELIVERABLE_HUMAN_REVIEW_REQUIRED', 'DELIVERABLE_REJECTED', 'WORK_ITEM_OVERDUE') NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `content` TEXT NOT NULL,
    `resource_type` VARCHAR(100) NOT NULL,
    `resource_id` VARCHAR(30) NOT NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_created_at_idx`(`user_id`, `read_at`, `created_at`),
    INDEX `notifications_project_id_type_idx`(`project_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Lossless legacy execution backfill
-- ---------------------------------------------------------------------------

-- A review cannot be moved to a version if the document never had a version.
-- Fail loudly instead of silently discarding the historical decision.
CREATE TEMPORARY TABLE `_execution_migration_guard` (
    `ok` INTEGER NOT NULL,
    CONSTRAINT `_execution_migration_guard_check` CHECK (`ok` = 1)
);

INSERT INTO `_execution_migration_guard` (`ok`)
SELECT 0
FROM `document_reviews` review
WHERE NOT EXISTS (
    SELECT 1 FROM `document_versions` version
    WHERE version.`document_id` = review.`document_id`
)
LIMIT 1;

-- A manual task id and a plan task id must not collide because both become
-- primary keys in the unified table.
INSERT INTO `_execution_migration_guard` (`ok`)
SELECT 0
FROM `tasks` task
INNER JOIN `project_plan_tasks` plan_task ON plan_task.`id` = task.`id`
LIMIT 1;

DROP TEMPORARY TABLE `_execution_migration_guard`;

-- Projects that only had standalone tasks receive a manual plan.  It has no
-- SOP source by design; SOP-generated plans continue to retain their source.
INSERT INTO `project_plans` (
    `id`, `project_id`, `source_sop_version_id`, `name`, `progress`, `generated_at`, `synced_at`
)
SELECT
    CONCAT('legacy_plan_', LEFT(MD5(task.`project_id`), 18)),
    task.`project_id`,
    NULL,
    '自定义执行计划',
    0,
    MIN(task.`created_at`),
    NULL
FROM `tasks` task
LEFT JOIN `project_plans` plan ON plan.`project_id` = task.`project_id`
WHERE task.`plan_task_id` IS NULL
  AND plan.`id` IS NULL
GROUP BY task.`project_id`;

-- Every project with standalone tasks gets exactly one custom stage.
INSERT INTO `project_stages` (
    `id`, `plan_id`, `source_stage_id`, `source_stage_key`, `name`, `description`,
    `sort_order`, `weight`, `progress`, `planned_start_date`, `planned_end_date`,
    `actual_start_date`, `actual_end_date`, `is_custom`
)
SELECT
    CONCAT('legacy_stage_', LEFT(MD5(projects_with_tasks.`project_id`), 17)),
    plan.`id`,
    NULL,
    NULL,
    '临时任务',
    '由历史独立任务迁移生成',
    COALESCE((SELECT MAX(existing_stage.`sort_order`) + 1 FROM `project_stages` existing_stage WHERE existing_stage.`plan_id` = plan.`id`), 0),
    0,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    true
FROM (SELECT DISTINCT `project_id` FROM `tasks` WHERE `plan_task_id` IS NULL) projects_with_tasks
INNER JOIN `project_plans` plan ON plan.`project_id` = projects_with_tasks.`project_id`
WHERE NOT EXISTS (
    SELECT 1
    FROM `project_stages` custom_stage
    WHERE custom_stage.`plan_id` = plan.`id`
      AND custom_stage.`is_custom` = true
      AND custom_stage.`name` = '临时任务'
);

-- A plan task is the canonical row.  Its generated primary Task contributes
-- execution state, ownership and priority, then disappears with the legacy
-- table.  The plan task id stays stable for checklist/document foreign keys.
INSERT INTO `project_work_items` (
    `id`, `project_id`, `plan_stage_id`, `source_sop_task_id`, `source_sop_task_key`,
    `parent_work_item_id`, `name`, `description`, `owner_user_id`, `status`, `priority`,
    `planned_start_date`, `planned_end_date`, `actual_start_date`, `actual_end_date`,
    `progress`, `required`, `source_type`, `sort_order`, `weight`, `is_custom`,
    `cancelled_by_change_request_id`, `created_by_id`, `created_at`, `updated_at`
)
SELECT
    plan_task.`id`,
    plan.`project_id`,
    plan_task.`plan_stage_id`,
    plan_task.`source_task_id`,
    plan_task.`source_task_key`,
    NULL,
    plan_task.`name`,
    plan_task.`description`,
    COALESCE(primary_task.`owner_user_id`, plan_task.`owner_user_id`, project.`manager_user_id`),
    COALESCE(primary_task.`status`, CASE WHEN plan_task.`progress` >= 100 THEN 'DONE' WHEN plan_task.`progress` > 0 THEN 'IN_PROGRESS' ELSE 'TODO' END),
    COALESCE(primary_task.`priority`, 'MEDIUM'),
    COALESCE(primary_task.`planned_start_date`, plan_task.`planned_start_date`),
    COALESCE(primary_task.`due_date`, plan_task.`planned_end_date`),
    plan_task.`actual_start_date`,
    COALESCE(primary_task.`completed_at`, plan_task.`actual_end_date`),
    GREATEST(plan_task.`progress`, COALESCE(primary_task.`progress`, 0)),
    plan_task.`required`,
    CASE WHEN plan_task.`source_task_id` IS NULL THEN 'MANUAL' ELSE 'SOP' END,
    plan_task.`sort_order`,
    plan_task.`weight`,
    plan_task.`is_custom`,
    NULL,
    COALESCE(primary_task.`created_by_id`, project.`manager_user_id`),
    COALESCE(primary_task.`created_at`, CURRENT_TIMESTAMP(3)),
    COALESCE(primary_task.`updated_at`, CURRENT_TIMESTAMP(3))
FROM `project_plan_tasks` plan_task
INNER JOIN `project_stages` stage ON stage.`id` = plan_task.`plan_stage_id`
INNER JOIN `project_plans` plan ON plan.`id` = stage.`plan_id`
INNER JOIN `projects` project ON project.`id` = plan.`project_id`
LEFT JOIN `tasks` primary_task ON primary_task.`primary_plan_task_id` = plan_task.`id`;

-- A non-primary task linked to a plan task becomes a manual child WorkItem.
INSERT INTO `project_work_items` (
    `id`, `project_id`, `plan_stage_id`, `source_sop_task_id`, `source_sop_task_key`,
    `parent_work_item_id`, `name`, `description`, `owner_user_id`, `status`, `priority`,
    `planned_start_date`, `planned_end_date`, `actual_start_date`, `actual_end_date`,
    `progress`, `required`, `source_type`, `sort_order`, `weight`, `is_custom`,
    `cancelled_by_change_request_id`, `created_by_id`, `created_at`, `updated_at`
)
SELECT
    ranked.`id`, ranked.`project_id`, ranked.`plan_stage_id`, NULL, NULL,
    ranked.`plan_task_id`, ranked.`title`, ranked.`description`, ranked.`owner_user_id`,
    ranked.`status`, ranked.`priority`, ranked.`planned_start_date`, ranked.`due_date`,
    CASE WHEN ranked.`status` IN ('IN_PROGRESS', 'BLOCKED', 'DONE') THEN ranked.`updated_at` ELSE NULL END,
    ranked.`completed_at`, ranked.`progress`, true,
    CASE WHEN ranked.`source_type` = 'SOP' THEN 'SOP' ELSE 'MANUAL' END,
    1000000 + ranked.`row_number`, 0, true, NULL, ranked.`created_by_id`, ranked.`created_at`, ranked.`updated_at`
FROM (
    SELECT task.*, plan_task.`plan_stage_id`,
           ROW_NUMBER() OVER (PARTITION BY plan_task.`plan_stage_id` ORDER BY task.`created_at`, task.`id`) AS `row_number`
    FROM `tasks` task
    INNER JOIN `project_plan_tasks` plan_task ON plan_task.`id` = task.`plan_task_id`
    WHERE task.`primary_plan_task_id` IS NULL
) ranked;

-- Standalone tasks become top-level manual items in the custom stage.
INSERT INTO `project_work_items` (
    `id`, `project_id`, `plan_stage_id`, `source_sop_task_id`, `source_sop_task_key`,
    `parent_work_item_id`, `name`, `description`, `owner_user_id`, `status`, `priority`,
    `planned_start_date`, `planned_end_date`, `actual_start_date`, `actual_end_date`,
    `progress`, `required`, `source_type`, `sort_order`, `weight`, `is_custom`,
    `cancelled_by_change_request_id`, `created_by_id`, `created_at`, `updated_at`
)
SELECT
    ranked.`id`, ranked.`project_id`, ranked.`stage_id`, NULL, NULL, NULL,
    ranked.`title`, ranked.`description`, ranked.`owner_user_id`, ranked.`status`, ranked.`priority`,
    ranked.`planned_start_date`, ranked.`due_date`,
    CASE WHEN ranked.`status` IN ('IN_PROGRESS', 'BLOCKED', 'DONE') THEN ranked.`updated_at` ELSE NULL END,
    ranked.`completed_at`, ranked.`progress`, true,
    CASE WHEN ranked.`source_type` = 'SOP' THEN 'SOP' ELSE 'MANUAL' END,
    ranked.`row_number`, 0, true, NULL, ranked.`created_by_id`, ranked.`created_at`, ranked.`updated_at`
FROM (
    SELECT task.*, custom_stage.`id` AS `stage_id`,
           ROW_NUMBER() OVER (PARTITION BY task.`project_id` ORDER BY task.`created_at`, task.`id`) AS `row_number`
    FROM `tasks` task
    INNER JOIN `project_plans` plan ON plan.`project_id` = task.`project_id`
    INNER JOIN `project_stages` custom_stage
      ON custom_stage.`plan_id` = plan.`id`
     AND custom_stage.`is_custom` = true
     AND custom_stage.`name` = '临时任务'
    WHERE task.`plan_task_id` IS NULL
) ranked;

UPDATE `project_checklist_items`
SET `work_item_id` = `plan_task_id`;

UPDATE `project_deliverables` deliverable
LEFT JOIN `sop_deliverables` source_deliverable ON source_deliverable.`id` = deliverable.`source_deliverable_id`
SET deliverable.`work_item_id` = deliverable.`plan_task_id`,
    deliverable.`review_mode` = COALESCE(source_deliverable.`review_mode`, 'HUMAN_ONLY'),
    deliverable.`ai_auto_approve_threshold` = source_deliverable.`ai_auto_approve_threshold`,
    deliverable.`ai_review_instruction` = source_deliverable.`ai_review_instruction`;

UPDATE `documents`
SET `work_item_id` = `plan_task_id`;

-- Earlier versions could associate several task documents with the same
-- deliverable.  Keep one logical deliverable link and preserve every other
-- document as a regular work-item document.
UPDATE `documents` document
INNER JOIN `documents` earlier
        ON earlier.`project_deliverable_id` = document.`project_deliverable_id`
       AND earlier.`id` < document.`id`
SET document.`project_deliverable_id` = NULL
WHERE document.`project_deliverable_id` IS NOT NULL;

UPDATE `zentao_task_syncs` sync
INNER JOIN `tasks` task ON task.`id` = sync.`task_id`
SET sync.`work_item_id` = COALESCE(task.`primary_plan_task_id`, task.`id`);

-- Bind every historical human review to the newest version that existed for
-- its document.  Future reviews are created exclusively at version level.
INSERT INTO `document_version_reviews` (
    `id`, `document_version_id`, `review_type`, `status`, `reviewer_user_id`,
    `ai_provider`, `ai_model`, `score`, `summary`, `decision_reason`,
    `created_at`, `reviewed_at`
)
SELECT
    review.`id`, version.`id`, 'HUMAN', review.`status`, review.`reviewer_id`,
    NULL, NULL, NULL, review.`comment`, review.`comment`, review.`created_at`, review.`reviewed_at`
FROM `document_reviews` review
INNER JOIN `document_versions` version
        ON version.`id` = (
            SELECT candidate.`id`
            FROM `document_versions` candidate
            WHERE candidate.`document_id` = review.`document_id`
            ORDER BY candidate.`created_at` DESC, candidate.`id` DESC
            LIMIT 1
        );

ALTER TABLE `project_checklist_items`
    MODIFY `work_item_id` VARCHAR(30) NOT NULL,
    DROP COLUMN `plan_task_id`;

ALTER TABLE `project_deliverables`
    MODIFY `work_item_id` VARCHAR(30) NOT NULL,
    DROP COLUMN `plan_task_id`;

ALTER TABLE `documents`
    DROP COLUMN `plan_task_id`;

ALTER TABLE `zentao_task_syncs`
    MODIFY `work_item_id` VARCHAR(30) NOT NULL,
    DROP COLUMN `task_id`;

DROP TABLE `document_reviews`;
DROP TABLE `tasks`;
DROP TABLE `project_plan_tasks`;

-- CreateIndex
CREATE INDEX `documents_work_item_id_idx` ON `documents`(`work_item_id`);

-- CreateIndex
CREATE UNIQUE INDEX `documents_project_deliverable_id_key` ON `documents`(`project_deliverable_id`);

-- CreateIndex
CREATE INDEX `project_checklist_items_work_item_id_completed_idx` ON `project_checklist_items`(`work_item_id`, `completed`);

-- CreateIndex
CREATE UNIQUE INDEX `project_checklist_items_work_item_id_sort_order_key` ON `project_checklist_items`(`work_item_id`, `sort_order`);

-- CreateIndex
CREATE INDEX `project_deliverables_work_item_id_idx` ON `project_deliverables`(`work_item_id`);

-- CreateIndex
CREATE UNIQUE INDEX `project_deliverables_work_item_id_source_deliverable_key_key` ON `project_deliverables`(`work_item_id`, `source_deliverable_key`);

-- CreateIndex
CREATE UNIQUE INDEX `project_deliverables_work_item_id_sort_order_key` ON `project_deliverables`(`work_item_id`, `sort_order`);

-- CreateIndex
CREATE INDEX `projects_approver_user_id_idx` ON `projects`(`approver_user_id`);

-- CreateIndex
CREATE UNIQUE INDEX `zentao_task_syncs_work_item_id_key` ON `zentao_task_syncs`(`work_item_id`);

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_approver_user_id_fkey` FOREIGN KEY (`approver_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sop_deliverable_review_criteria` ADD CONSTRAINT `sop_deliverable_review_criteria_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `sop_deliverables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_stages` ADD CONSTRAINT `project_stages_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `project_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_stages` ADD CONSTRAINT `project_stages_source_stage_id_fkey` FOREIGN KEY (`source_stage_id`) REFERENCES `sop_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_plan_stage_id_fkey` FOREIGN KEY (`plan_stage_id`) REFERENCES `project_stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_source_sop_task_id_fkey` FOREIGN KEY (`source_sop_task_id`) REFERENCES `sop_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_parent_work_item_id_fkey` FOREIGN KEY (`parent_work_item_id`) REFERENCES `project_work_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_work_items` ADD CONSTRAINT `project_work_items_cancelled_by_change_request_id_fkey` FOREIGN KEY (`cancelled_by_change_request_id`) REFERENCES `project_change_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_deliverables` ADD CONSTRAINT `project_deliverables_work_item_id_fkey` FOREIGN KEY (`work_item_id`) REFERENCES `project_work_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_deliverable_review_criteria` ADD CONSTRAINT `project_deliverable_review_criteria_project_deliverable_id_fkey` FOREIGN KEY (`project_deliverable_id`) REFERENCES `project_deliverables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_deliverable_review_criteria` ADD CONSTRAINT `project_deliverable_review_criteria_source_criterion_id_fkey` FOREIGN KEY (`source_criterion_id`) REFERENCES `sop_deliverable_review_criteria`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_checklist_items` ADD CONSTRAINT `project_checklist_items_work_item_id_fkey` FOREIGN KEY (`work_item_id`) REFERENCES `project_work_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_checklist_items` ADD CONSTRAINT `project_checklist_items_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_work_item_id_fkey` FOREIGN KEY (`work_item_id`) REFERENCES `project_work_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_version_reviews` ADD CONSTRAINT `document_version_reviews_document_version_id_fkey` FOREIGN KEY (`document_version_id`) REFERENCES `document_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_version_reviews` ADD CONSTRAINT `document_version_reviews_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_findings` ADD CONSTRAINT `review_findings_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `document_version_reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_review_criterion_results` ADD CONSTRAINT `document_review_criterion_results_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `document_version_reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_review_criterion_results` ADD CONSTRAINT `document_review_criterion_results_criterion_id_fkey` FOREIGN KEY (`criterion_id`) REFERENCES `project_deliverable_review_criteria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_review_jobs` ADD CONSTRAINT `ai_review_jobs_document_version_id_fkey` FOREIGN KEY (`document_version_id`) REFERENCES `document_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_change_requests` ADD CONSTRAINT `project_change_requests_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_change_requests` ADD CONSTRAINT `project_change_requests_requested_by_user_id_fkey` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_change_requests` ADD CONSTRAINT `project_change_requests_approver_user_id_fkey` FOREIGN KEY (`approver_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_change_operations` ADD CONSTRAINT `project_change_operations_change_request_id_fkey` FOREIGN KEY (`change_request_id`) REFERENCES `project_change_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baselines` ADD CONSTRAINT `project_baselines_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baselines` ADD CONSTRAINT `project_baselines_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baselines` ADD CONSTRAINT `project_baselines_source_change_request_id_fkey` FOREIGN KEY (`source_change_request_id`) REFERENCES `project_change_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_stages` ADD CONSTRAINT `project_baseline_stages_baseline_id_fkey` FOREIGN KEY (`baseline_id`) REFERENCES `project_baselines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_stages` ADD CONSTRAINT `project_baseline_stages_source_stage_id_fkey` FOREIGN KEY (`source_stage_id`) REFERENCES `project_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_work_items` ADD CONSTRAINT `project_baseline_work_items_baseline_stage_id_fkey` FOREIGN KEY (`baseline_stage_id`) REFERENCES `project_baseline_stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_work_items` ADD CONSTRAINT `project_baseline_work_items_source_work_item_id_fkey` FOREIGN KEY (`source_work_item_id`) REFERENCES `project_work_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_checklist_items` ADD CONSTRAINT `project_baseline_checklist_items_baseline_work_item_id_fkey` FOREIGN KEY (`baseline_work_item_id`) REFERENCES `project_baseline_work_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_checklist_items` ADD CONSTRAINT `project_baseline_checklist_items_source_checklist_item_id_fkey` FOREIGN KEY (`source_checklist_item_id`) REFERENCES `project_checklist_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_deliverables` ADD CONSTRAINT `project_baseline_deliverables_baseline_work_item_id_fkey` FOREIGN KEY (`baseline_work_item_id`) REFERENCES `project_baseline_work_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_baseline_deliverables` ADD CONSTRAINT `project_baseline_deliverables_source_deliverable_id_fkey` FOREIGN KEY (`source_deliverable_id`) REFERENCES `project_deliverables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_adjustment_logs` ADD CONSTRAINT `project_adjustment_logs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_adjustment_logs` ADD CONSTRAINT `project_adjustment_logs_operator_user_id_fkey` FOREIGN KEY (`operator_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_adjustment_logs` ADD CONSTRAINT `project_adjustment_logs_baseline_id_fkey` FOREIGN KEY (`baseline_id`) REFERENCES `project_baselines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zentao_task_syncs` ADD CONSTRAINT `zentao_task_syncs_work_item_id_fkey` FOREIGN KEY (`work_item_id`) REFERENCES `project_work_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
