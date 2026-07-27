require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool, mysqlConfigured } = require('../db');

async function main() {
  const [username, password, displayName = '系统管理员'] = process.argv.slice(2);
  if (!username || !password) throw new Error('用法：npm run db:seed-admin -- <用户名> <密码> [显示名称]');
  if (!mysqlConfigured()) throw new Error('请先在 .env 中填写 MySQL 连接信息');
  const passwordHash = await bcrypt.hash(password, 12);
  await getPool().execute(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), display_name = VALUES(display_name), role = VALUES(role)',
    [username, passwordHash, displayName, 'admin']
  );
  console.log(`管理员 ${username} 已创建或更新`);
}

main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
