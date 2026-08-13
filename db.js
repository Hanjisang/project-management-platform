try { require('dotenv').config(); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const mysql = require('mysql2/promise');

function mysqlConfigured() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD);
}

let pool;
function getPool() {
  if (!mysqlConfigured()) throw new Error('MySQL 未配置：请复制 .env.example 为 .env 并填写连接信息');
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
      ssl: process.env.MYSQL_SSL === 'true' ? {} : undefined
    });
  }
  return pool;
}

async function checkConnection() {
  const [rows] = await getPool().query('SELECT 1 AS connected');
  return rows[0].connected === 1;
}

module.exports = { mysqlConfigured, getPool, checkConnection };
