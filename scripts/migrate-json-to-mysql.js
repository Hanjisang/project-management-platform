require('dotenv').config();
const { getPool, mysqlConfigured } = require('../db');

const baseUrl = process.env.LEGACY_API_URL || 'http://localhost:3030';
async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`无法读取 ${path}：HTTP ${response.status}`);
  return response.json();
}

async function main() {
  if (!mysqlConfigured()) throw new Error('请先完成 .env 中的 MySQL 配置');
  const [projects, tasks, issues, documents, messages] = await Promise.all([
    getJson('/api/projects'), getJson('/api/tasks'), getJson('/api/issues'), getJson('/api/projects/1/documents')
    , getJson('/api/messages')
  ]);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM documents');
    await connection.query('DELETE FROM messages');
    await connection.query('DELETE FROM issues');
    await connection.query('DELETE FROM tasks');
    await connection.query('DELETE FROM projects');
    const projectIds = new Map();
    for (const project of projects) {
      const [result] = await connection.execute(
        'INSERT INTO projects (name, customer, manager_name, stage, progress, planned_go_live, health) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [project.name, project.customer, project.manager, project.stage, Number(project.progress) || 0, project.plannedGoLive || null, project.health]
      );
      projectIds.set(project.name, result.insertId);
    }
    const findProjectId = name => [...projectIds.entries()].find(([projectName]) => projectName.includes(name) || name.includes(projectName))?.[1];
    for (const task of tasks) {
      const projectId = findProjectId(task.project); if (!projectId) continue;
      await connection.execute('INSERT INTO tasks (project_id, name, stage, owner_name, due_date, progress, status, progress_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [projectId, task.name, task.stage, task.owner, task.dueDate, Number(task.progress) || 0, task.status, task.progressNote || null]);
    }
    for (const issue of issues) {
      const projectId = findProjectId(issue.project); if (!projectId) continue;
      await connection.execute('INSERT INTO issues (project_id, title, type, level, owner_name, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [projectId, issue.title, issue.type, issue.level, issue.owner, issue.dueDate, issue.status]);
    }
    for (const document of documents) {
      await connection.execute('INSERT INTO documents (project_id, name, type, task_name, version, status, review_comment) VALUES (?, ?, ?, ?, ?, ?, ?)', [projectIds.get(projects[0]?.name), document.name, document.type, document.task, document.version, document.status, document.reviewComment || null]);
    }
    for (const message of messages) {
      const projectId = message.project === '未归属' ? null : findProjectId(message.project);
      await connection.execute('INSERT INTO messages (project_id, source, content, category, status, sender, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [projectId || null, message.source, message.content, message.category, message.status, message.sender, message.receivedAt || new Date()]);
    }
    await connection.commit();
    console.log(`迁移完成：${projects.length} 个项目、${tasks.length} 个任务、${issues.length} 个问题、${documents.length} 个文档、${messages.length} 条消息`);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); await pool.end(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
