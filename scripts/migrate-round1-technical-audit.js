const { getPool, mysqlConfigured } = require('../db');

async function migrate() {
  if (!mysqlConfigured()) throw new Error('MYSQL_* 配置缺失，无法执行迁移');
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const [rows] = await pool.execute('SELECT version FROM schema_migrations WHERE version=?', ['round1-technical-audit']);
  if (!rows.length) {
    const statements = [
      "ALTER TABLE projects ADD COLUMN execution_status VARCHAR(32) NOT NULL DEFAULT '未启动'",
      'ALTER TABLE projects ADD COLUMN started_at DATETIME NULL',
      'ALTER TABLE projects ADD COLUMN pause_started_at DATETIME NULL',
      'ALTER TABLE projects ADD COLUMN paused_days INT UNSIGNED NOT NULL DEFAULT 0',
      'ALTER TABLE tasks ADD COLUMN plan_task_id VARCHAR(128) NULL',
      'ALTER TABLE documents ADD COLUMN deliverable_name VARCHAR(255) NULL',
      'ALTER TABLE documents ADD COLUMN plan_task_id VARCHAR(128) NULL',
      "CREATE TABLE IF NOT EXISTS knowledge_categories (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,parent_id BIGINT UNSIGNED NULL,name VARCHAR(100) NOT NULL,sort_order INT NOT NULL DEFAULT 0,status VARCHAR(20) NOT NULL DEFAULT '启用',UNIQUE KEY uk_knowledge_category (parent_id,name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS knowledge_articles (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,summary TEXT NULL,content LONGTEXT NULL,category VARCHAR(100) NOT NULL,subcategory VARCHAR(100) NULL,tags_json JSON NULL,source_type VARCHAR(30) NOT NULL DEFAULT '标准知识',source_project_id BIGINT UNSIGNED NULL,source_document_id BIGINT UNSIGNED NULL,author_id BIGINT UNSIGNED NULL,author_name VARCHAR(100) NULL,status VARCHAR(30) NOT NULL DEFAULT '草稿',reviewer_id BIGINT UNSIGNED NULL,reviewer_name VARCHAR(100) NULL,review_comment TEXT NULL,published_at DATETIME NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY idx_knowledge_status (status),KEY idx_knowledge_category (category),KEY idx_knowledge_source (source_type,source_project_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS knowledge_attachments (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,article_id BIGINT UNSIGNED NOT NULL,file_name VARCHAR(255) NOT NULL,object_key VARCHAR(512) NULL,mime_type VARCHAR(120) NULL,file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_knowledge_attachment (article_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS roles (role_key VARCHAR(32) PRIMARY KEY,name VARCHAR(100) NOT NULL)",
      "CREATE TABLE IF NOT EXISTS role_permissions (role_key VARCHAR(32) NOT NULL,permission_code VARCHAR(100) NOT NULL,PRIMARY KEY (role_key,permission_code),CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_key) REFERENCES roles(role_key) ON DELETE CASCADE)",
      "INSERT IGNORE INTO roles (role_key,name) VALUES ('admin','管理员'),('project_manager','项目经理'),('project_member','项目成员'),('developer','开发人员'),('viewer','只读用户')",
      "INSERT IGNORE INTO role_permissions (role_key,permission_code) VALUES ('project_manager','project.create'),('project_manager','project.view'),('project_member','project.view'),('developer','project.view'),('viewer','project.view'),('project_manager','sop.view'),('project_member','sop.view'),('developer','sop.view'),('viewer','sop.view'),('project_manager','report.view'),('project_member','report.view'),('developer','report.view'),('viewer','report.view')"
    ];
    for (const sql of statements) {
      try { await pool.query(sql); } catch (error) {
        if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(error.code)) throw error;
      }
    }
    await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', ['round1-technical-audit']);
  }
  await pool.end();
}

migrate().catch(error => { console.error('数据库迁移失败:', error); process.exitCode = 1; });
