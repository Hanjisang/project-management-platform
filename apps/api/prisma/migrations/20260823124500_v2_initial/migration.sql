-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(30) NOT NULL,
    `username` VARCHAR(80) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(190) NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'LOCKED', 'DEPARTED') NOT NULL DEFAULT 'ACTIVE',
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_status_deleted_at_idx`(`status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(120) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` VARCHAR(30) NOT NULL,
    `role_id` VARCHAR(30) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_role_id_idx`(`role_id`),
    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` VARCHAR(30) NOT NULL,
    `permission_id` VARCHAR(30) NOT NULL,

    INDEX `role_permissions_permission_id_idx`(`permission_id`),
    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `token_hash` VARCHAR(128) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `customer_name` VARCHAR(200) NOT NULL,
    `manager_user_id` VARCHAR(30) NOT NULL,
    `status` ENUM('DRAFT', 'NOT_STARTED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NOT_STARTED',
    `health` ENUM('NORMAL', 'WARNING', 'HIGH_RISK') NOT NULL DEFAULT 'NORMAL',
    `health_override` ENUM('NORMAL', 'WARNING', 'HIGH_RISK') NULL,
    `planned_start_date` DATE NULL,
    `planned_go_live_date` DATE NULL,
    `actual_start_date` DATETIME(3) NULL,
    `actual_go_live_date` DATETIME(3) NULL,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `projects_code_key`(`code`),
    INDEX `projects_manager_user_id_idx`(`manager_user_id`),
    INDEX `projects_status_deleted_at_idx`(`status`, `deleted_at`),
    INDEX `projects_health_planned_go_live_date_idx`(`health`, `planned_go_live_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_members` (
    `project_id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `project_role` ENUM('PROJECT_MANAGER', 'IMPLEMENTER', 'DEVELOPER', 'PRODUCT', 'TESTER', 'VIEWER') NOT NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_members_user_id_idx`(`user_id`),
    PRIMARY KEY (`project_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sop_templates` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `sop_templates_code_key`(`code`),
    INDEX `sop_templates_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sop_versions` (
    `id` VARCHAR(30) NOT NULL,
    `template_id` VARCHAR(30) NOT NULL,
    `version` VARCHAR(40) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `description` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sop_versions_status_published_at_idx`(`status`, `published_at`),
    UNIQUE INDEX `sop_versions_template_id_version_key`(`template_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sop_stages` (
    `id` VARCHAR(30) NOT NULL,
    `stable_key` VARCHAR(30) NOT NULL,
    `sop_version_id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL,
    `default_duration_days` INTEGER NOT NULL DEFAULT 1,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `sop_stages_sop_version_id_idx`(`sop_version_id`),
    UNIQUE INDEX `sop_stages_sop_version_id_sort_order_key`(`sop_version_id`, `sort_order`),
    UNIQUE INDEX `sop_stages_sop_version_id_stable_key_key`(`sop_version_id`, `stable_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sop_tasks` (
    `id` VARCHAR(30) NOT NULL,
    `stable_key` VARCHAR(30) NOT NULL,
    `stage_id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL,
    `default_duration_days` INTEGER NOT NULL DEFAULT 1,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `deliverable_required` BOOLEAN NOT NULL DEFAULT false,
    `deliverable_name` VARCHAR(200) NULL,
    `deliverable_template` VARCHAR(255) NULL,

    INDEX `sop_tasks_stage_id_idx`(`stage_id`),
    UNIQUE INDEX `sop_tasks_stage_id_sort_order_key`(`stage_id`, `sort_order`),
    UNIQUE INDEX `sop_tasks_stage_id_stable_key_key`(`stage_id`, `stable_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sop_checklist_items` (
    `id` VARCHAR(30) NOT NULL,
    `stable_key` VARCHAR(30) NOT NULL,
    `task_id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,

    INDEX `sop_checklist_items_task_id_idx`(`task_id`),
    UNIQUE INDEX `sop_checklist_items_task_id_sort_order_key`(`task_id`, `sort_order`),
    UNIQUE INDEX `sop_checklist_items_task_id_stable_key_key`(`task_id`, `stable_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_plans` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `source_sop_version_id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `synced_at` DATETIME(3) NULL,

    INDEX `project_plans_source_sop_version_id_idx`(`source_sop_version_id`),
    UNIQUE INDEX `project_plans_project_id_key`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_plan_stages` (
    `id` VARCHAR(30) NOT NULL,
    `plan_id` VARCHAR(30) NOT NULL,
    `source_stage_id` VARCHAR(30) NULL,
    `source_stage_key` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `planned_start_date` DATE NULL,
    `planned_end_date` DATE NULL,
    `actual_start_date` DATETIME(3) NULL,
    `actual_end_date` DATETIME(3) NULL,
    `is_custom` BOOLEAN NOT NULL DEFAULT false,

    INDEX `project_plan_stages_plan_id_idx`(`plan_id`),
    INDEX `project_plan_stages_source_stage_id_idx`(`source_stage_id`),
    INDEX `project_plan_stages_source_stage_key_idx`(`source_stage_key`),
    UNIQUE INDEX `project_plan_stages_plan_id_sort_order_key`(`plan_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_plan_tasks` (
    `id` VARCHAR(30) NOT NULL,
    `plan_stage_id` VARCHAR(30) NOT NULL,
    `source_task_id` VARCHAR(30) NULL,
    `source_task_key` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL,
    `weight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `deliverable_required` BOOLEAN NOT NULL DEFAULT false,
    `deliverable_name` VARCHAR(200) NULL,
    `owner_user_id` VARCHAR(30) NULL,
    `planned_start_date` DATE NULL,
    `planned_end_date` DATE NULL,
    `actual_start_date` DATETIME(3) NULL,
    `actual_end_date` DATETIME(3) NULL,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `is_custom` BOOLEAN NOT NULL DEFAULT false,

    INDEX `project_plan_tasks_plan_stage_id_idx`(`plan_stage_id`),
    INDEX `project_plan_tasks_source_task_id_idx`(`source_task_id`),
    INDEX `project_plan_tasks_source_task_key_idx`(`source_task_key`),
    INDEX `project_plan_tasks_owner_user_id_idx`(`owner_user_id`),
    UNIQUE INDEX `project_plan_tasks_plan_stage_id_sort_order_key`(`plan_stage_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_checklist_items` (
    `id` VARCHAR(30) NOT NULL,
    `plan_task_id` VARCHAR(30) NOT NULL,
    `source_item_id` VARCHAR(30) NULL,
    `source_item_key` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_at` DATETIME(3) NULL,
    `completed_by_id` VARCHAR(30) NULL,
    `is_custom` BOOLEAN NOT NULL DEFAULT false,

    INDEX `project_checklist_items_plan_task_id_completed_idx`(`plan_task_id`, `completed`),
    INDEX `project_checklist_items_source_item_key_idx`(`source_item_key`),
    UNIQUE INDEX `project_checklist_items_plan_task_id_sort_order_key`(`plan_task_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `plan_task_id` VARCHAR(30) NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NULL,
    `owner_user_id` VARCHAR(30) NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `planned_start_date` DATE NULL,
    `due_date` DATE NULL,
    `completed_at` DATETIME(3) NULL,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `source_type` ENUM('MANUAL', 'MESSAGE', 'ISSUE', 'SOP', 'ZENTAO') NOT NULL DEFAULT 'MANUAL',
    `source_id` VARCHAR(80) NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tasks_project_id_status_idx`(`project_id`, `status`),
    INDEX `tasks_project_id_due_date_idx`(`project_id`, `due_date`),
    INDEX `tasks_owner_user_id_status_idx`(`owner_user_id`, `status`),
    INDEX `tasks_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issues` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `type` ENUM('ISSUE', 'RISK', 'CHANGE', 'BLOCKER') NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'PROCESSING', 'WAITING', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `owner_user_id` VARCHAR(30) NULL,
    `due_date` DATE NULL,
    `resolved_at` DATETIME(3) NULL,
    `probability` TINYINT UNSIGNED NULL,
    `impact` TINYINT UNSIGNED NULL,
    `risk_score` TINYINT UNSIGNED NULL,
    `source_type` ENUM('MANUAL', 'MESSAGE', 'ISSUE', 'SOP', 'ZENTAO') NOT NULL DEFAULT 'MANUAL',
    `source_id` VARCHAR(80) NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `issues_project_id_status_idx`(`project_id`, `status`),
    INDEX `issues_project_id_due_date_idx`(`project_id`, `due_date`),
    INDEX `issues_severity_status_idx`(`severity`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `plan_task_id` VARCHAR(30) NULL,
    `name` VARCHAR(240) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `documents_project_id_status_idx`(`project_id`, `status`),
    INDEX `documents_plan_task_id_idx`(`plan_task_id`),
    INDEX `documents_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `id` VARCHAR(30) NOT NULL,
    `document_id` VARCHAR(30) NOT NULL,
    `version` VARCHAR(40) NOT NULL,
    `object_key` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(150) NOT NULL,
    `size` BIGINT UNSIGNED NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `uploaded_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `document_versions_object_key_key`(`object_key`),
    INDEX `document_versions_document_id_created_at_idx`(`document_id`, `created_at`),
    UNIQUE INDEX `document_versions_document_id_version_key`(`document_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_reviews` (
    `id` VARCHAR(30) NOT NULL,
    `document_id` VARCHAR(30) NOT NULL,
    `reviewer_id` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `comment` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_reviews_reviewer_id_status_idx`(`reviewer_id`, `status`),
    UNIQUE INDEX `document_reviews_document_id_reviewer_id_key`(`document_id`, `reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(30) NOT NULL,
    `source` ENUM('MANUAL', 'DINGTALK_BOT', 'DINGTALK_STREAM', 'DAILY_REPORT', 'IMPORT') NOT NULL,
    `external_message_id` VARCHAR(190) NULL,
    `project_id` VARCHAR(30) NULL,
    `sender_name` VARCHAR(160) NOT NULL,
    `sender_external_id` VARCHAR(190) NULL,
    `content` LONGTEXT NOT NULL,
    `received_at` DATETIME(3) NOT NULL,
    `raw_payload` JSON NULL,
    `status` ENUM('RECEIVED', 'ANALYZED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'IGNORED', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
    `created_by_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `messages_external_message_id_key`(`external_message_id`),
    INDEX `messages_project_id_status_idx`(`project_id`, `status`),
    INDEX `messages_status_received_at_idx`(`status`, `received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_analyses` (
    `id` VARCHAR(30) NOT NULL,
    `message_id` VARCHAR(30) NOT NULL,
    `provider` VARCHAR(80) NOT NULL,
    `model` VARCHAR(120) NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `result` JSON NULL,
    `error_code` VARCHAR(80) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `message_analyses_message_id_created_at_idx`(`message_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pending_actions` (
    `id` VARCHAR(30) NOT NULL,
    `message_id` VARCHAR(30) NOT NULL,
    `analysis_id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `type` ENUM('CREATE_TASK', 'CREATE_ISSUE', 'UPDATE_PROGRESS', 'CREATE_NOTE', 'CREATE_RISK') NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `result_resource_type` VARCHAR(80) NULL,
    `result_resource_id` VARCHAR(30) NULL,
    `confirmed_by_id` VARCHAR(30) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pending_actions_message_id_status_idx`(`message_id`, `status`),
    INDEX `pending_actions_project_id_status_idx`(`project_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_reports` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `report_date` DATE NOT NULL,
    `reporter_id` VARCHAR(30) NOT NULL,
    `completed` JSON NOT NULL,
    `risks` JSON NOT NULL,
    `coordination` JSON NOT NULL,
    `tomorrow` JSON NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_reports_project_id_report_date_idx`(`project_id`, `report_date`),
    UNIQUE INDEX `daily_reports_project_id_report_date_reporter_id_key`(`project_id`, `report_date`, `reporter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_reports` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NULL,
    `department` VARCHAR(160) NULL,
    `week_start` DATE NOT NULL,
    `week_end` DATE NOT NULL,
    `content` JSON NOT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `weekly_reports_project_id_week_start_idx`(`project_id`, `week_start`),
    INDEX `weekly_reports_department_week_start_idx`(`department`, `week_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_categories` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_articles` (
    `id` VARCHAR(30) NOT NULL,
    `category_id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `content` LONGTEXT NOT NULL,
    `tags` JSON NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `source_project_id` VARCHAR(30) NULL,
    `source_document_id` VARCHAR(30) NULL,
    `author_id` VARCHAR(30) NOT NULL,
    `reviewer_id` VARCHAR(30) NULL,
    `review_comment` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `knowledge_articles_category_id_status_idx`(`category_id`, `status`),
    INDEX `knowledge_articles_source_project_id_idx`(`source_project_id`),
    INDEX `knowledge_articles_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_attachments` (
    `id` VARCHAR(30) NOT NULL,
    `article_id` VARCHAR(30) NOT NULL,
    `object_key` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(150) NOT NULL,
    `size` BIGINT UNSIGNED NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_attachments_object_key_key`(`object_key`),
    INDEX `knowledge_attachments_article_id_idx`(`article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NULL,
    `action` VARCHAR(120) NOT NULL,
    `resource_type` VARCHAR(100) NOT NULL,
    `resource_id` VARCHAR(80) NULL,
    `request_id` VARCHAR(80) NOT NULL,
    `ip_address` VARCHAR(80) NULL,
    `user_agent` VARCHAR(500) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_resource_type_resource_id_idx`(`resource_type`, `resource_id`),
    INDEX `audit_logs_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `zentao_task_syncs` (
    `id` VARCHAR(30) NOT NULL,
    `task_id` VARCHAR(30) NOT NULL,
    `external_task_id` VARCHAR(120) NULL,
    `idempotency_key` VARCHAR(120) NOT NULL,
    `sync_status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `last_synced_at` DATETIME(3) NULL,
    `last_error` TEXT NULL,

    UNIQUE INDEX `zentao_task_syncs_task_id_key`(`task_id`),
    UNIQUE INDEX `zentao_task_syncs_idempotency_key_key`(`idempotency_key`),
    INDEX `zentao_task_syncs_sync_status_last_synced_at_idx`(`sync_status`, `last_synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_replay_nonces` (
    `id` VARCHAR(30) NOT NULL,
    `provider` VARCHAR(80) NOT NULL,
    `nonce` VARCHAR(190) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `integration_replay_nonces_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `integration_replay_nonces_provider_nonce_key`(`provider`, `nonce`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storage_cleanup_jobs` (
    `id` VARCHAR(30) NOT NULL,
    `object_key` VARCHAR(500) NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `storage_cleanup_jobs_object_key_key`(`object_key`),
    INDEX `storage_cleanup_jobs_completed_at_attempts_idx`(`completed_at`, `attempts`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_notes` (
    `id` VARCHAR(30) NOT NULL,
    `project_id` VARCHAR(30) NOT NULL,
    `content` TEXT NOT NULL,
    `source_message_id` VARCHAR(30) NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_notes_project_id_created_at_idx`(`project_id`, `created_at`),
    INDEX `project_notes_created_by_id_idx`(`created_by_id`),
    INDEX `project_notes_source_message_id_idx`(`source_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_manager_user_id_fkey` FOREIGN KEY (`manager_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sop_versions` ADD CONSTRAINT `sop_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `sop_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sop_stages` ADD CONSTRAINT `sop_stages_sop_version_id_fkey` FOREIGN KEY (`sop_version_id`) REFERENCES `sop_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sop_tasks` ADD CONSTRAINT `sop_tasks_stage_id_fkey` FOREIGN KEY (`stage_id`) REFERENCES `sop_stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sop_checklist_items` ADD CONSTRAINT `sop_checklist_items_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `sop_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plans` ADD CONSTRAINT `project_plans_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plans` ADD CONSTRAINT `project_plans_source_sop_version_id_fkey` FOREIGN KEY (`source_sop_version_id`) REFERENCES `sop_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plan_stages` ADD CONSTRAINT `project_plan_stages_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `project_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plan_stages` ADD CONSTRAINT `project_plan_stages_source_stage_id_fkey` FOREIGN KEY (`source_stage_id`) REFERENCES `sop_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plan_tasks` ADD CONSTRAINT `project_plan_tasks_plan_stage_id_fkey` FOREIGN KEY (`plan_stage_id`) REFERENCES `project_plan_stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plan_tasks` ADD CONSTRAINT `project_plan_tasks_source_task_id_fkey` FOREIGN KEY (`source_task_id`) REFERENCES `sop_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_plan_tasks` ADD CONSTRAINT `project_plan_tasks_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_checklist_items` ADD CONSTRAINT `project_checklist_items_plan_task_id_fkey` FOREIGN KEY (`plan_task_id`) REFERENCES `project_plan_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_plan_task_id_fkey` FOREIGN KEY (`plan_task_id`) REFERENCES `project_plan_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_plan_task_id_fkey` FOREIGN KEY (`plan_task_id`) REFERENCES `project_plan_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_analyses` ADD CONSTRAINT `message_analyses_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pending_actions` ADD CONSTRAINT `pending_actions_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pending_actions` ADD CONSTRAINT `pending_actions_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `message_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pending_actions` ADD CONSTRAINT `pending_actions_confirmed_by_id_fkey` FOREIGN KEY (`confirmed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_reports_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_reports` ADD CONSTRAINT `weekly_reports_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_reports` ADD CONSTRAINT `weekly_reports_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_source_project_id_fkey` FOREIGN KEY (`source_project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_source_document_id_fkey` FOREIGN KEY (`source_document_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_attachments` ADD CONSTRAINT `knowledge_attachments_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zentao_task_syncs` ADD CONSTRAINT `zentao_task_syncs_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_notes` ADD CONSTRAINT `project_notes_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_notes` ADD CONSTRAINT `project_notes_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
