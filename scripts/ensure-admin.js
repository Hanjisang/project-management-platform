require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool, mysqlConfigured } = require('../db');

async function main() {
  const username = process.env.DEFAULT_ADMIN_USERNAME;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!username || !password) throw new Error('生产部署必须设置 DEFAULT_ADMIN_USERNAME 和 DEFAULT_ADMIN_PASSWORD');
  if (!mysqlConfigured()) throw new Error('MySQL 配置不完整');
  const pool = getPool();
  const [rows] = await pool.execute('SELECT id FROM users WHERE username=? LIMIT 1', [username]);
  if (!rows[0]) {
    const hash = await bcrypt.hash(password, 12);
    await pool.execute('INSERT INTO users (username,password_hash,display_name,role) VALUES (?,?,?,?)', [username, hash, process.env.DEFAULT_ADMIN_DISPLAY_NAME || '系统管理员', 'admin']);
    console.log(`已创建初始管理员：${username}`);
  }
  await pool.end();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
