const { getPool, mysqlConfigured } = require('../db');

const VERSION = 'overnight-hardening-v1';

const rolePermissions = {
  project_manager: [
    'project.view', 'project.create', 'project.edit', 'project.delete', 'project.lifecycle', 'project.members',
    'plan.view', 'plan.edit', 'task.view', 'task.create', 'task.edit', 'task.delete', 'task.update',
    'issue.view', 'issue.create', 'issue.edit', 'issue.delete', 'issue.update',
    'document.view', 'document.create', 'document.edit', 'document.delete', 'document.review',
    'daily.view', 'daily.create', 'report.view', 'sop.view', 'integration.view', 'integration.sync',
    'message.view', 'message.create', 'message.confirm', 'dashboard.view', 'audit.view',
    'knowledge.view', 'knowledge.create', 'knowledge.edit'
  ],
  project_member: [
    'project.view', 'plan.view', 'task.view', 'task.create', 'task.edit', 'task.update',
    'issue.view', 'issue.create', 'issue.edit', 'issue.update', 'document.view', 'document.create', 'document.edit',
    'daily.view', 'daily.create', 'report.view', 'sop.view', 'integration.view',
    'message.view', 'message.create', 'message.confirm', 'dashboard.view', 'knowledge.view', 'knowledge.create', 'knowledge.edit'
  ],
  developer: [
    'project.view', 'plan.view', 'task.view', 'task.create', 'task.edit', 'task.update',
    'issue.view', 'issue.create', 'issue.edit', 'issue.update', 'document.view', 'document.create', 'document.edit',
    'daily.view', 'daily.create', 'report.view', 'sop.view', 'integration.view', 'integration.sync',
    'message.view', 'message.create', 'message.confirm', 'dashboard.view', 'knowledge.view', 'knowledge.create', 'knowledge.edit'
  ],
  viewer: ['project.view', 'plan.view', 'task.view', 'issue.view', 'document.view', 'daily.view', 'report.view', 'sop.view', 'integration.view', 'message.view', 'dashboard.view', 'knowledge.view']
};

async function runStatement(pool, sql, ignoredCodes = []) {
  try { await pool.query(sql); } catch (error) { if (!ignoredCodes.includes(error.code)) throw error; }
}

async function migrate(injectedPool) {
  if (!injectedPool && !mysqlConfigured()) throw new Error('MYSQL_* 配置缺失，无法执行迁移');
  const pool = injectedPool || getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const [rows] = await pool.execute('SELECT version FROM schema_migrations WHERE version=?', [VERSION]);
  if (!rows.length) {
    await runStatement(pool, 'ALTER TABLE projects ADD COLUMN remote_method VARCHAR(64) NULL', ['ER_DUP_FIELDNAME']);
    await runStatement(pool, 'ALTER TABLE projects ADD COLUMN server_info TEXT NULL', ['ER_DUP_FIELDNAME']);
    await runStatement(pool, 'ALTER TABLE projects ADD COLUMN customer_info TEXT NULL', ['ER_DUP_FIELDNAME']);
    await runStatement(pool, 'ALTER TABLE roles ADD COLUMN description VARCHAR(500) NULL', ['ER_DUP_FIELDNAME']);
    await runStatement(pool, "ALTER TABLE roles ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active'", ['ER_DUP_FIELDNAME']);
    await runStatement(pool, 'ALTER TABLE roles ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', ['ER_DUP_FIELDNAME']);
    await runStatement(pool, 'ALTER TABLE sop_templates MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT');
    await runStatement(pool, 'ALTER TABLE tasks ADD CONSTRAINT chk_tasks_progress CHECK (progress BETWEEN 0 AND 100)', ['ER_DUP_CHECK_CONSTRAINT', 'ER_CHECK_CONSTRAINT_DUP_NAME']);
    await runStatement(pool, 'ALTER TABLE projects ADD CONSTRAINT chk_projects_progress CHECK (progress BETWEEN 0 AND 100)', ['ER_DUP_CHECK_CONSTRAINT', 'ER_CHECK_CONSTRAINT_DUP_NAME']);
    await runStatement(pool, 'CREATE TABLE IF NOT EXISTS login_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,username VARCHAR(64) NOT NULL,success TINYINT(1) NOT NULL DEFAULT 0,ip_address VARCHAR(64) NULL,browser VARCHAR(500) NULL,message VARCHAR(255) NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(id),KEY idx_login_logs_created(created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      for (const permission of permissions) {
        await pool.execute('INSERT IGNORE INTO role_permissions (role_key,permission_code) VALUES (?,?)', [role, permission]);
      }
    }
    await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', [VERSION]);
  }
  if (!injectedPool) await pool.end();
}

module.exports = { VERSION, rolePermissions, migrate };
if (require.main === module) migrate().catch(error => { console.error('数据库加固迁移失败:', error); process.exitCode = 1; });
