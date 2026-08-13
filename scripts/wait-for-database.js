const { getPool, mysqlConfigured } = require('../db');

const maxAttempts = Number(process.env.DB_STARTUP_MAX_ATTEMPTS || 30);
const retryDelayMs = Number(process.env.DB_STARTUP_RETRY_MS || 2000);

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function main() {
  if (!mysqlConfigured()) throw new Error('MYSQL_* 配置缺失，无法等待数据库');
  const pool = getPool();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      await pool.end();
      console.log('数据库连接已就绪');
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        await pool.end().catch(() => {});
        throw new Error(`等待数据库超时: ${error.message}`);
      }
      console.log(`数据库尚未就绪，${retryDelayMs}ms 后重试 (${attempt}/${maxAttempts})`);
      await delay(retryDelayMs);
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
