const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, mysqlConfigured } = require('./db');

function jwtConfigured() {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
}

function authReady() {
  return mysqlConfigured() && jwtConfigured();
}

async function passwordLogin(username, password) {
  if (!authReady()) throw new Error('登录服务尚未配置：请完成 MySQL 与 JWT_SECRET 配置');
  const [rows] = await getPool().execute(
    'SELECT id, username, password_hash, display_name, role, status FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  const user = rows[0];
  if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.password_hash))) return null;
  const token = jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role, displayName: user.display_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  return { token, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } };
}

function verifyToken(token) {
  if (!jwtConfigured()) throw new Error('JWT_SECRET 未配置');
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { authReady, passwordLogin, verifyToken };
