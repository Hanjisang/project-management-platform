ALTER TABLE `project_work_items`
  MODIFY `source_type` ENUM('SOP', 'MANUAL', 'MESSAGE', 'ISSUE', 'ZENTAO', 'CHANGE') NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `source_id` VARCHAR(80) NULL AFTER `source_type`;

CREATE INDEX `project_work_items_source_type_source_id_idx`
  ON `project_work_items`(`source_type`, `source_id`);
