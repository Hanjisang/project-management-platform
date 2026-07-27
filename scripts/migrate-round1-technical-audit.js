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
      "CREATE TABLE IF NOT EXISTS knowledge_articles (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,summary TEXT,content LONGTEXT,category VARCHAR(64) NOT NULL,status VARCHAR(32) NOT NULL DEFAULT '草稿',source_type VARCHAR(32) NOT NULL DEFAULT '标准知识',review_comment TEXT,created_by BIGINT UNSIGNED NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
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
