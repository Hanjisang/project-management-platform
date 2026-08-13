async function loadUserPermissions(pool, user) {
  if (!user?.sub) return [];
  if (user.role === 'admin') return ['*'];
  const [rows] = await pool.execute('SELECT rp.permission_code AS permission FROM role_permissions rp JOIN users u ON u.role=rp.role_key WHERE u.id=? AND u.status="active"', [user.sub]);
  return rows.map(row => row.permission);
}

function requirePermission(user, permission) {
  return user?.role === 'admin' || (user?.permissions || []).includes('*') || (user?.permissions || []).includes(permission);
}

// Keep the permission names in one place so API guards and migrations cannot drift.
const CORE_PERMISSIONS = Object.freeze([
  'project.view', 'project.create', 'project.edit', 'project.delete', 'project.lifecycle', 'project.members',
  'plan.view', 'plan.edit', 'task.view', 'task.create', 'task.edit', 'task.delete', 'task.update',
  'issue.view', 'issue.create', 'issue.edit', 'issue.delete', 'issue.update',
  'document.view', 'document.create', 'document.edit', 'document.delete', 'document.review',
  'daily.view', 'daily.create', 'daily.edit', 'report.view', 'report.template',
  'sop.view', 'sop.create', 'sop.edit', 'sop.delete', 'integration.view', 'integration.sync',
  'message.view', 'message.create', 'message.confirm', 'dashboard.view', 'audit.view'
]);

module.exports = { loadUserPermissions, requirePermission, CORE_PERMISSIONS };
