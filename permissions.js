async function loadUserPermissions(pool, user) {
  if (!user?.sub) return [];
  if (user.role === 'admin') return ['*'];
  const [rows] = await pool.execute('SELECT rp.permission_code AS permission FROM role_permissions rp JOIN users u ON u.role=rp.role_key WHERE u.id=? AND u.status="active"', [user.sub]);
  return rows.map(row => row.permission);
}

function requirePermission(user, permission) {
  return user?.role === 'admin' || (user?.permissions || []).includes('*') || (user?.permissions || []).includes(permission);
}

module.exports = { loadUserPermissions, requirePermission };
