const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { URL } = require('node:url');
const { authReady, passwordLogin, verifyToken } = require('./auth');
const { getPool, mysqlConfigured } = require('./db');
const { saveDataUrl, readObject, deleteObject } = require('./storage');
const { loadUserPermissions, requirePermission } = require('./permissions');
const { validateStructuredMessageResult } = require('./message-result');

const root = __dirname;
const dataDirectory = path.join(root, 'data');
const templateDirectory = path.join(root, 'templates');
const documentFile = path.join(dataDirectory, 'documents.json');
const projectFile = path.join(dataDirectory, 'projects.json');
const taskFile = path.join(dataDirectory, 'tasks.json');
const issueFile = path.join(dataDirectory, 'issues.json');
const sopFile = path.join(dataDirectory, 'sop-template.json');
const projectPlanFile = path.join(dataDirectory, 'project-plans.json');
const auditFile = path.join(dataDirectory, 'audit-logs.json');
fs.mkdirSync(dataDirectory, { recursive: true });

const initialDocuments = [
  { id: 'doc-sequence', projectId: '1', name: '儿童医院接口时序图V1.2', type: '时序图', task: '时序图确认', version: 'V1.2', status: '已通过', statusClass: 'green', time: '07-12 16:22', reviewComment: '内容完整，审核通过。', reviewer: '项目经理' },
  { id: 'doc-confirm', projectId: '1', name: '接口对接确认表', type: '确认表', task: '接口文档确认', version: 'V1.0', status: '待院方确认', statusClass: 'orange', time: '07-11 09:10' },
  { id: 'doc-plan', projectId: '1', name: '上线前任务计划', type: '计划', task: '倒排上线前计划', version: 'V2.0', status: '已通过', statusClass: 'green', time: '07-08 18:30', reviewer: '项目经理' }
];
const initialProjects = [
  { id: '1', name: '武汉儿童医院病理系统', customer: '武汉儿童医院', manager: '张正宇', stage: '接口对接', stageClass: 'green', progress: 58, openIssues: 6, plannedGoLive: '2026-08-15', health: '预警', healthClass: 'orange' },
  { id: '2', name: '武汉市第四医院PIS升级', customer: '武汉市第四医院', manager: '李明', stage: '上线试运行', stageClass: 'purple', progress: 82, openIssues: 3, plannedGoLive: '2026-07-20', health: '正常', healthClass: 'green' },
  { id: '3', name: '嘉鱼县人民医院数智病理', customer: '嘉鱼县人民医院', manager: '王强', stage: '事前准备', stageClass: 'blue', progress: 28, openIssues: 1, plannedGoLive: '2026-09-10', health: '正常', healthClass: 'green' },
  { id: '4', name: '武汉市第一医院初验项目', customer: '武汉市第一医院', manager: '赵敏', stage: '上线试运行', stageClass: 'purple', progress: 91, openIssues: 5, plannedGoLive: '2026-07-18', health: '预警', healthClass: 'orange' },
  { id: '5', name: '省妇幼数字病理平台', customer: '湖北省妇幼', manager: '周洋', stage: '接口对接', stageClass: 'green', progress: 46, openIssues: 8, plannedGoLive: '2026-09-30', health: '高风险', healthClass: 'red' }
];
const initialTasks = [
  { id: 'task-1', name: '申请单退费接口开发', project: '武汉儿童医院', stage: '接口对接', owner: '研发部', dueDate: '2026-07-17', progress: 60, status: '进行中' },
  { id: 'task-2', name: '完成试运行问题梳理', project: '武汉市第四医院', stage: '上线试运行', owner: '李明', dueDate: '2026-07-16', progress: 80, status: '进行中' },
  { id: 'task-3', name: '初验资料补齐', project: '武汉市第一医院', stage: '上线试运行', owner: '赵敏', dueDate: '2026-07-13', progress: 70, status: '已延期' },
  { id: 'task-4', name: '服务器环境部署', project: '嘉鱼县人民医院', stage: '事前准备', owner: '运维组', dueDate: '2026-07-16', progress: 60, status: '进行中' }
];
const initialIssues = [
  { id: 'issue-1', title: '报告图片地址院内无法访问', project: '武汉儿童医院', type: '环境问题', level: '高', owner: '接口组/院方', dueDate: '2026-07-16', status: '阻塞' },
  { id: 'issue-2', title: '初验资料缺少确认单', project: '武汉市第一医院', type: '文档问题', level: '中', owner: '项目组', dueDate: '2026-07-17', status: '处理中' },
  { id: 'issue-3', title: '标签打印字体偏小', project: '武汉市第四医院', type: '配置问题', level: '低', owner: '研发部', dueDate: '2026-07-14', status: '待验证' }
];
const issueTypes = ['客户需求', '产品缺陷', '代码缺陷', '接口缺陷', '项目风险', '配置问题'];
const issueLevels = ['高', '中', '低'];
const permissionCodes = ['project.delete', 'knowledge.view', 'knowledge.create', 'knowledge.edit', 'knowledge.review', 'knowledge.delete'];
function validateIssuePayload(body) { return issueTypes.includes(body.type || '其他问题') && issueLevels.includes(body.level || '中'); }

function readDocuments() {
  if (!fs.existsSync(documentFile)) return initialDocuments;
  return JSON.parse(fs.readFileSync(documentFile, 'utf8'));
}
function writeDocuments(documents) {
  fs.writeFileSync(documentFile, JSON.stringify(documents, null, 2), 'utf8');
}
function readProjects() { return fs.existsSync(projectFile) ? JSON.parse(fs.readFileSync(projectFile, 'utf8')) : initialProjects; }
function writeProjects(projects) { fs.writeFileSync(projectFile, JSON.stringify(projects, null, 2), 'utf8'); }
function readTasks() { return fs.existsSync(taskFile) ? JSON.parse(fs.readFileSync(taskFile, 'utf8')) : initialTasks; }
function writeTasks(tasks) { fs.writeFileSync(taskFile, JSON.stringify(tasks, null, 2), 'utf8'); }
function readIssues() { return fs.existsSync(issueFile) ? JSON.parse(fs.readFileSync(issueFile, 'utf8')) : initialIssues; }
function writeIssues(issues) { fs.writeFileSync(issueFile, JSON.stringify(issues, null, 2), 'utf8'); }
function readSop() { return fs.existsSync(sopFile) ? JSON.parse(fs.readFileSync(sopFile, 'utf8')) : null; }
function writeSop(sop) { fs.writeFileSync(sopFile, JSON.stringify(sop, null, 2), 'utf8'); }
function applyDurationWeights(items) {
  if (!Array.isArray(items) || !items.length) return;
  const durations = items.map(item => Math.max(1, Number(item.duration) || 1));
  const total = durations.reduce((sum, value) => sum + value, 0);
  const calculated = items.map((item, index) => { const exact = durations[index] / total * 100; const base = Math.floor(exact); return { item, index, base, remainder: exact - base }; });
  const remaining = 100 - calculated.reduce((sum, entry) => sum + entry.base, 0);
  calculated.sort((a, b) => b.remainder - a.remainder || a.index - b.index).forEach((entry, index) => { entry.item.weight = entry.base + (index < remaining ? 1 : 0); });
}
function normalizeSopWeights(template) {
  if (!template || !Array.isArray(template.stages)) return template;
  applyDurationWeights(template.stages);
  template.stages.forEach(stage => applyDurationWeights(stage.tasks));
  return template;
}
function normalizeProjectPlanTracking(plan) {
  (plan?.stages || []).forEach((stage, stageIndex) => (stage.tasks || []).forEach((task, taskIndex) => {
    if (!task.id) task.id = `plan-task-${stageIndex + 1}-${taskIndex + 1}-${Math.random().toString(36).slice(2, 9)}`;
    task.checklist = (task.checklist || []).map((item, checkIndex) => typeof item === 'string'
      ? { id: `${task.id}-check-${checkIndex + 1}`, name: item, completed: false, completedAt: '' }
      : { ...item, id: item.id || `${task.id}-check-${checkIndex + 1}`, name: item.name || item.text || `检查项${checkIndex + 1}`, completed: Boolean(item.completed), completedAt: item.completedAt || '' });
  }));
  return plan;
}
async function recalculateEntirePlan(pool, projectId, plan) {
  normalizeProjectPlanTracking(plan);
  for (const stage of plan.stages || []) for (const task of stage.tasks || []) {
    await pool.execute('UPDATE tasks SET plan_task_id=?,name=?,stage=? WHERE project_id=? AND (plan_task_id=? OR (plan_task_id IS NULL AND name=?))', [task.id, task.name, stage.name, projectId, task.id, task.name]);
  }
  return plan;
}
function syncSopPlan(oldPlan, sourceTemplate, metadata, mode = 'merge') {
  const previous = normalizeProjectPlanTracking(JSON.parse(JSON.stringify(oldPlan || { stages: [] })));
  const template = normalizeProjectPlanTracking(normalizeSopWeights(JSON.parse(JSON.stringify(sourceTemplate || { stages: [] }))));
  const oldStages = previous.stages || [], oldTasks = oldStages.flatMap(stage => (stage.tasks || []).map(task => ({ stage, task })));
  const matchedOldTasks = new Set(), matchedOldStages = new Set();
  let addedTasks = 0, updatedTasks = 0, preservedProgress = 0, addedChecks = 0;
  const stages = (template.stages || []).map((stage, stageIndex) => {
    const oldStage = oldStages.find(item => String(item.id || '') === String(stage.id || '') || item.name === stage.name);
    if (oldStage) matchedOldStages.add(oldStage);
    const tasks = (stage.tasks || []).map((task, taskIndex) => {
      const oldEntry = oldTasks.find(item => !matchedOldTasks.has(item.task) && (String(item.task.id || '') === String(task.id || '') || (item.task.name === task.name && item.stage.name === stage.name)));
      if (!oldEntry) { addedTasks += 1; addedChecks += (task.checklist || []).length; return task; }
      const oldTask = oldEntry.task; matchedOldTasks.add(oldTask); updatedTasks += 1;
      const merged = { ...task, id: oldTask.id || task.id };
      ['actualProgress', 'actualStatus', 'actualOwner', 'actualDueDate'].forEach(key => { if (oldTask[key] !== undefined) merged[key] = oldTask[key]; });
      if (Number(oldTask.actualProgress) > 0 || (oldTask.checklist || []).some(check => check.completed)) preservedProgress += 1;
      const matchedChecks = new Set();
      merged.checklist = (task.checklist || []).map((check, checkIndex) => {
        const oldCheck = (oldTask.checklist || []).find(item => !matchedChecks.has(item) && (String(item.id || '') === String(check.id || '') || item.name === check.name));
        if (!oldCheck) { addedChecks += 1; return { ...check, id: check.id || `${merged.id}-check-${checkIndex + 1}` }; }
        matchedChecks.add(oldCheck);
        return { ...check, id: oldCheck.id || check.id, completed: Boolean(oldCheck.completed), completedAt: oldCheck.completedAt || '' };
      });
      if (mode === 'merge') merged.checklist.push(...(oldTask.checklist || []).filter(check => !matchedChecks.has(check)).map(check => ({ ...check, projectCustom: true })));
      return merged;
    });
    if (mode === 'merge' && oldStage) tasks.push(...(oldStage.tasks || []).filter(task => !matchedOldTasks.has(task)).map(task => { matchedOldTasks.add(task); return { ...task, projectCustom: true }; }));
    return { ...stage, tasks };
  });
  if (mode === 'merge') stages.push(...oldStages.filter(stage => !matchedOldStages.has(stage)).map(stage => ({ ...stage, projectCustom: true })));
  const removedTasks = oldTasks.filter(item => !matchedOldTasks.has(item.task)).length;
  return {
    plan: normalizeProjectPlanTracking({
      projectId: String(metadata.projectId),
      sourceTemplateId: String(metadata.templateId),
      sourceTemplate: metadata.name,
      sourceVersion: metadata.version || 'V1.0',
      createdAt: previous.createdAt || new Date().toLocaleString('zh-CN', { hour12: false }),
      syncedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      syncMode: mode,
      stages
    }),
    summary: { addedTasks, updatedTasks, preservedProgress, addedChecks, removedTasks: mode === 'replace' ? removedTasks : 0 }
  };
}
async function backfillPlanTaskLinks(pool, projectId, plan) {
  normalizeProjectPlanTracking(plan);
  for (const stage of plan.stages || []) for (const task of stage.tasks || []) await pool.execute('UPDATE tasks SET plan_task_id=? WHERE project_id=? AND plan_task_id IS NULL AND name=? AND stage=?', [task.id, projectId, task.name, stage.name]);
  const [taskRows]=await pool.execute('SELECT plan_task_id,name,stage,owner_name,DATE_FORMAT(due_date,"%Y-%m-%d") AS dueDate,progress,status FROM tasks WHERE project_id=? AND plan_task_id IS NOT NULL',[projectId]);
  taskRows.forEach(taskRow=>applyTaskRowToPlan(plan,taskRow));
  return plan;
}
function applyTaskRowToPlan(plan, taskRow) {
  let matched,sourceStage;
  for (const stage of plan.stages || []) { matched=(stage.tasks||[]).find(task=>String(task.id)===String(taskRow.plan_task_id)||(task.name===taskRow.name&&stage.name===taskRow.stage));if(matched){sourceStage=stage;break;} }
  if (!matched) return null;
  matched.name=taskRow.name||matched.name;matched.owner=taskRow.owner_name||matched.owner;matched.actualProgress=Number(taskRow.progress)||0;matched.actualStatus=taskRow.status;matched.actualOwner=taskRow.owner_name;matched.actualDueDate=taskRow.dueDate||taskRow.due_date;
  const targetStage=(plan.stages||[]).find(stage=>stage.name===taskRow.stage);if(targetStage&&sourceStage&&targetStage!==sourceStage){sourceStage.tasks=sourceStage.tasks.filter(task=>task!==matched);targetStage.tasks=targetStage.tasks||[];targetStage.tasks.push(matched);}
  if (matched.actualProgress===100) matched.checklist=(matched.checklist||[]).map(check=>({...check,completed:true,completedAt:check.completedAt||new Date().toLocaleString('zh-CN',{hour12:false})}));
  if (matched.actualProgress===0) matched.checklist=(matched.checklist||[]).map(check=>({...check,completed:false,completedAt:''}));
  return matched;
}
async function syncTaskProgressToProjectPlan(pool, projectId, taskRow) {
  const [rows] = await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?', [projectId]);if (!rows[0]) return;
  const plan = normalizeProjectPlanTracking(parseJsonColumn(rows[0].plan_json));if(!applyTaskRowToPlan(plan,taskRow))return;
  await pool.execute('UPDATE project_plans SET plan_json=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=?',[JSON.stringify(plan),projectId]);
}
async function persistChecklistPlan(pool,projectId,plan,planTask){const total=(planTask.checklist||[]).length,done=(planTask.checklist||[]).filter(item=>item.completed).length,progress=total?Math.round(done/total*100):0;planTask.actualProgress=progress;planTask.actualStatus=progress===100?'已完成':progress>0?'进行中':'未开始';const [rows]=await pool.execute('SELECT id,DATE_FORMAT(due_date,"%Y-%m-%d") AS dueDate FROM tasks WHERE project_id=? AND plan_task_id=? LIMIT 1',[projectId,planTask.id]);if(rows[0]){const status=taskStatus(progress,rows[0].dueDate);await pool.execute('UPDATE tasks SET progress=?,status=?,progress_note=? WHERE id=?',[progress,status,`检查项完成 ${done}/${total}`,rows[0].id]);planTask.actualStatus=status;}await pool.execute('UPDATE project_plans SET plan_json=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=?',[JSON.stringify(plan),projectId]);return {progress,total,done};}
function readProjectPlans() { return fs.existsSync(projectPlanFile) ? JSON.parse(fs.readFileSync(projectPlanFile, 'utf8')) : {}; }
function writeProjectPlans(plans) { fs.writeFileSync(projectPlanFile, JSON.stringify(plans, null, 2), 'utf8'); }
function readAuditLogs() { return fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, 'utf8')) : []; }
async function writeAudit(action, targetType, targetId, detail, user, ipAddress) {
  const operator = user?.displayName || user?.name || user?.username || user?.realName || '系统';
  detail = `[用户:${operator}][IP:${ipAddress || '-'}] ${detail || ''}`;
  const entry = { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action, targetType, targetId, detail, operator, time: new Date().toLocaleString('zh-CN', { hour12: false }) };
  const logs = readAuditLogs(); logs.unshift(entry); fs.writeFileSync(auditFile, JSON.stringify(logs.slice(0, 500), null, 2), 'utf8');
  if (mysqlConfigured()) {
    try { await getPool().execute('INSERT INTO audit_logs (action, target_type, target_id, detail, operator_id) VALUES (?, ?, ?, ?, ?)', [action, targetType, String(targetId), detail || null, user?.sub || null]); }
    catch (error) { console.error('审计日志写入数据库失败', { action, targetType, targetId, error: error.message }); }
  }
}
const audit = writeAudit;
function projectReferenceExists(reference) { return readProjects().some(project => project.name === reference || project.customer === reference); }
function taskStatus(progress, dueDate) { if (progress >= 100) return '已完成'; if (new Date(`${dueDate}T23:59:59`) < new Date()) return '已延期'; return progress > 0 ? '进行中' : '未开始'; }
function projectViews() {
  const issues = readIssues();
  return readProjects().map(project => {
    const related = issues.filter(issue => project.name.includes(issue.project) || issue.project.includes(project.customer));
    const openIssues = related.filter(issue => issue.status !== '已关闭');
    const hasHighRisk = openIssues.some(issue => issue.level === '高' || issue.status === '阻塞');
    return { ...project, openIssues: openIssues.length, health: hasHighRisk ? '高风险' : project.health, healthClass: hasHighRisk ? 'red' : project.healthClass };
  });
}
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
function readCookie(request, name) {
  const values = String(request.headers.cookie || '').split(';').map(item => item.trim());
  const pair = values.find(item => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 15 * 1024 * 1024) request.destroy(); });
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('请求数据格式不正确')); } });
    request.on('error', reject);
  });
}
function statusClass(status) {
  return ['已通过', '已确认'].includes(status) ? 'green' : ['需修改', '已拒绝'].includes(status) ? 'red' : 'orange';
}
function stageClass(stage) { return stage === '接口对接' ? 'green' : stage === '上线试运行' ? 'purple' : 'blue'; }
function healthClass(health) { return health === '高风险' ? 'red' : health === '正常' ? 'green' : 'orange'; }
function parseJsonColumn(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
function zentaoSettings() {
  const baseUrl = String(process.env.ZENTAO_BASE_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.ZENTAO_TOKEN || '').trim();
  const executionID = Number(process.env.ZENTAO_EXECUTION_ID || 0);
  return {
    baseUrl,
    token,
    executionID,
    assignedTo: String(process.env.ZENTAO_ASSIGNED_TO || '').trim(),
    type: String(process.env.ZENTAO_TASK_TYPE || 'devel').trim() || 'devel',
    configured: Boolean(baseUrl && token && executionID)
  };
}
function publicZentaoSettings() {
  const settings = zentaoSettings();
  return {
    configured: settings.configured,
    baseUrl: settings.baseUrl,
    executionID: settings.executionID || '',
    assignedTo: settings.assignedTo,
    taskEndpoint: settings.baseUrl ? `${settings.baseUrl}/api.php/v2/tasks` : ''
  };
}
async function createZentaoTask(task) {
  const settings = zentaoSettings();
  if (!settings.configured) throw new Error('禅道尚未配置，请先设置地址、Token 和执行ID');
  const payload = {
    name: task.name,
    executionID: settings.executionID,
    type: settings.type,
    pri: Number(task.pri || 3),
    estimate: Number(task.estimate || 1),
    desc: [
      '来源：实施项目管理平台',
      `项目：${task.project || '-'}`,
      `阶段：${task.stage || '-'}`,
      `负责人：${task.owner || '-'}`,
      `当前进度：${Number(task.progress || 0)}%`,
      task.progressNote ? `进展说明：${task.progressNote}` : ''
    ].filter(Boolean).join('\n')
  };
  if (settings.assignedTo) payload.assignedTo = settings.assignedTo;
  if (task.dueDate) payload.deadline = task.dueDate;
  const result = await fetch(`${settings.baseUrl}/api.php/v2/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: settings.token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const raw = await result.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!result.ok || data?.status === 'fail') throw new Error(data?.message || data?.error || `禅道返回 HTTP ${result.status}`);
  const zentaoTaskId = data?.id || data?.data?.id || data?.task?.id;
  if (!zentaoTaskId) throw new Error('禅道已响应，但未返回任务ID');
  return { id: String(zentaoTaskId), response: data };
}
function mysqlProject(row) {
  const health = Number(row.highRiskIssues) > 0 ? '高风险' : row.health;
  const startedAt=row.startedAt||row.started_at,pausedAt=row.pause_started_at,plannedGoLive=row.plannedGoLive||row.planned_go_live; const elapsed=startedAt?Math.max(0,Math.ceil(((pausedAt?new Date(pausedAt):new Date()).getTime()-new Date(startedAt).getTime())/86400000)):0; const runningDays=Math.max(0,elapsed-Number(row.paused_days||0));
  return { id: String(row.id), name: row.name, customer: row.customer, manager: row.manager_name, stage: row.stage, stageClass: stageClass(row.stage), progress: Number(row.progress), openIssues: Number(row.openIssues), plannedGoLive: plannedGoLive ? new Date(plannedGoLive).toISOString().slice(0, 10) : '', health, healthClass: healthClass(health), executionStatus:row.execution_status||'未启动', startedAt:startedAt?new Date(startedAt).toISOString():'', runningDays };
}
async function mysqlProjectList(pool, user) {
  const restricted = user && user.role !== 'admin';
  const joins = restricted ? 'INNER JOIN project_members pm ON pm.project_id=p.id' : '';
  const where = restricted ? 'WHERE pm.user_id=?' : '';
  const [rows] = await pool.query(`SELECT p.*, SUM(CASE WHEN i.status <> '已关闭' THEN 1 ELSE 0 END) AS openIssues, SUM(CASE WHEN i.status <> '已关闭' AND (i.level = '高' OR i.status = '阻塞') THEN 1 ELSE 0 END) AS highRiskIssues FROM projects p ${joins} LEFT JOIN issues i ON i.project_id = p.id ${where} GROUP BY p.id ORDER BY p.id DESC`, restricted ? [user.sub] : []);
  return rows.map(mysqlProject);
}
async function projectAccessAllowed(pool, user, projectId) {
  if (user?.role === 'admin') return true;
  const [rows] = await pool.execute('SELECT 1 FROM project_members WHERE project_id=? AND user_id=? LIMIT 1', [projectId, user?.sub]);
  return Boolean(rows[0]);
}
async function allowedProjectIds(pool, user) {
  if (user?.role === 'admin') return null;
  const [rows] = await pool.execute('SELECT project_id FROM project_members WHERE user_id=?', [user?.sub]);
  return new Set(rows.map(row => String(row.project_id)));
}
async function serveMysqlCoreApi(request, response, url) {
  if (!mysqlConfigured()) return false;
  const pool = getPool();
  const audit = (...args) => writeAudit(...args, request.user, request.ipAddress);
  const allowedRoles = ['admin', 'project_manager', 'project_member', 'developer', 'viewer'];
   // Schema changes are managed by scripts/migrate-round1-technical-audit.js.
  const hasPermission = (permission) => requirePermission(request.user, permission);
  if (request.method === 'GET' && url.pathname === '/api/project-user-options') {
    if (!hasPermission('project.create')) return json(response, 403, { message: '无权创建项目' }), true;
    const [rows] = await pool.query('SELECT u.id,u.username,u.display_name AS displayName,u.role,r.name AS roleName FROM users u LEFT JOIN roles r ON r.role_key=u.role WHERE u.status="active" ORDER BY u.display_name,u.id');
    return json(response, 200, rows.map(row => ({ ...row, id: String(row.id) }))), true;
  }
  if (url.pathname === '/api/sop/template' || /^\/api\/sop\/templates(?:\/\d+)?$/.test(url.pathname)) {
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && !(hasPermission('sop.create') || hasPermission('sop.edit'))) return json(response, 403, { message: '无权维护SOP模板' }), true;
  }
  if (url.pathname.startsWith('/api/integrations/zentao')) {
    if (request.method === 'GET' && url.pathname === '/api/integrations/zentao/status') {
      const [rows] = await pool.query("SELECT COUNT(*) AS total,SUM(status='已同步') AS synced,SUM(status='同步失败') AS failed FROM zentao_task_syncs");
      return json(response, 200, { ...publicZentaoSettings(), total: Number(rows[0].total), synced: Number(rows[0].synced || 0), failed: Number(rows[0].failed || 0) }), true;
    }
    if (request.method === 'GET' && url.pathname === '/api/integrations/zentao/syncs') {
      const allowed = await allowedProjectIds(pool, request.user);
      const [rows] = await pool.query('SELECT z.task_id AS taskId,z.zentao_task_id AS zentaoTaskId,z.status,z.error_message AS errorMessage,DATE_FORMAT(z.synced_at,"%Y-%m-%d %H:%i:%s") AS syncedAt,t.project_id AS projectId FROM zentao_task_syncs z JOIN tasks t ON t.id=z.task_id ORDER BY z.updated_at DESC');
      return json(response, 200, rows.filter(row => !allowed || allowed.has(String(row.projectId))).map(({ projectId, ...row }) => ({ ...row, taskId: String(row.taskId) }))), true;
    }
    const syncMatch = url.pathname.match(/^\/api\/integrations\/zentao\/tasks\/(\d+)\/sync$/);
    if (request.method === 'POST' && syncMatch) {
      const [rows] = await pool.execute('SELECT t.id,t.project_id AS projectId,t.name,p.name AS project,t.stage,t.owner_name AS owner,DATE_FORMAT(t.due_date,"%Y-%m-%d") AS dueDate,t.progress,t.status,t.progress_note AS progressNote FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?', [syncMatch[1]]);
      const task = rows[0];
      if (!task) return json(response, 404, { message: '任务不存在' }), true;
      if (!await projectAccessAllowed(pool, request.user, task.projectId)) return json(response, 403, { message: '无权同步该项目任务' }), true;
      try {
        const synced = await createZentaoTask(task);
        await pool.execute("INSERT INTO zentao_task_syncs (task_id,zentao_task_id,status,error_message,synced_at) VALUES (?,?, '已同步',NULL,NOW()) ON DUPLICATE KEY UPDATE zentao_task_id=VALUES(zentao_task_id),status='已同步',error_message=NULL,synced_at=NOW()", [task.id, synced.id]);
        audit('同步任务至禅道', 'task', String(task.id), `禅道任务#${synced.id}`);
        return json(response, 200, { taskId: String(task.id), zentaoTaskId: synced.id, status: '已同步' }), true;
      } catch (error) {
        const message = String(error.message || '同步失败').slice(0, 500);
        await pool.execute("INSERT INTO zentao_task_syncs (task_id,status,error_message) VALUES (?, '同步失败',?) ON DUPLICATE KEY UPDATE status='同步失败',error_message=VALUES(error_message)", [task.id, message]);
        return json(response, zentaoSettings().configured ? 502 : 400, { message }), true;
      }
    }
  }
  if (url.pathname === '/api/daily-reports') {
    if (request.method === 'GET') { const allowed=await allowedProjectIds(pool,request.user); const [rows]=await pool.query('SELECT d.id,d.project_id AS projectId,p.name AS project,DATE_FORMAT(d.report_date,"%Y-%m-%d") AS reportDate,d.reporter,d.mode,d.online_days AS onlineDays,d.system_status AS systemStatus,d.business_impact AS businessImpact,d.key_data AS keyData,d.completed_json AS completed,d.risks_json AS risks,d.coordination_json AS coordination,d.tomorrow_json AS tomorrow,d.notes,DATE_FORMAT(d.updated_at,"%Y-%m-%d %H:%i:%s") AS updatedAt FROM daily_reports d JOIN projects p ON p.id=d.project_id ORDER BY d.report_date DESC,d.id DESC'); return json(response,200,rows.filter(row=>!allowed||allowed.has(String(row.projectId))).map(row=>({...row,id:String(row.id),projectId:String(row.projectId),completed:parseJsonColumn(row.completed),risks:parseJsonColumn(row.risks),coordination:parseJsonColumn(row.coordination),tomorrow:parseJsonColumn(row.tomorrow)}))),true; }
    if (request.method === 'POST') { const body=await readBody(request);if(!body.projectId||!body.reportDate||!body.reporter)return json(response,400,{message:'请选择项目、日报日期并填写汇报人'}),true;if(!await projectAccessAllowed(pool,request.user,body.projectId))return json(response,403,{message:'无权为该项目提交日报'}),true;const values=[body.projectId,body.reportDate,body.reporter,body.mode||'现场',Number(body.onlineDays)||0,body.systemStatus||'正常',body.businessImpact||'',body.keyData||'',JSON.stringify(body.completed||[]),JSON.stringify(body.risks||[]),JSON.stringify(body.coordination||[]),JSON.stringify(body.tomorrow||[]),body.notes||''];await pool.execute('INSERT INTO daily_reports (project_id,report_date,reporter,mode,online_days,system_status,business_impact,key_data,completed_json,risks_json,coordination_json,tomorrow_json,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE reporter=VALUES(reporter),mode=VALUES(mode),online_days=VALUES(online_days),system_status=VALUES(system_status),business_impact=VALUES(business_impact),key_data=VALUES(key_data),completed_json=VALUES(completed_json),risks_json=VALUES(risks_json),coordination_json=VALUES(coordination_json),tomorrow_json=VALUES(tomorrow_json),notes=VALUES(notes)',values);audit('提交项目日报','daily_report',`${body.projectId}:${body.reportDate}`,body.reporter);return json(response,200,{ok:true}),true; }
  }
  if (url.pathname === '/api/report-templates') {
    if (request.method === 'GET') { const [rows] = await pool.query('SELECT id,name,report_type AS reportType,description,fields_json AS fields,status,DATE_FORMAT(updated_at,"%Y-%m-%d %H:%i:%s") AS updatedAt FROM report_templates ORDER BY updated_at DESC,id DESC'); return json(response, 200, rows.map(row => ({ ...row, id: String(row.id), fields: parseJsonColumn(row.fields) }))), true; }
    if (request.method === 'POST') { if (request.user?.role !== 'admin') return json(response,403,{message:'仅管理员可以维护报表模板'}),true; const body=await readBody(request); if(!body.name||!body.reportType||!Array.isArray(body.fields)) return json(response,400,{message:'请填写模板名称、报表类型和展示字段'}),true; const [result]=await pool.execute('INSERT INTO report_templates (name,report_type,description,fields_json,status) VALUES (?,?,?,?,?)',[body.name.trim(),body.reportType,body.description||'',JSON.stringify(body.fields),body.status||'已启用']); audit('创建报表模板','report_template',String(result.insertId),body.name.trim()); return json(response,201,{id:String(result.insertId)}),true; }
  }
  const reportTemplateMatch=url.pathname.match(/^\/api\/report-templates\/(\d+)$/);
  if(reportTemplateMatch){ if(request.method==='PUT'){ if(request.user?.role!=='admin')return json(response,403,{message:'仅管理员可以维护报表模板'}),true; const body=await readBody(request);if(!body.name||!body.reportType||!Array.isArray(body.fields))return json(response,400,{message:'请填写完整模板信息'}),true; const [result]=await pool.execute('UPDATE report_templates SET name=?,report_type=?,description=?,fields_json=?,status=? WHERE id=?',[body.name.trim(),body.reportType,body.description||'',JSON.stringify(body.fields),body.status||'已启用',reportTemplateMatch[1]]);if(!result.affectedRows)return json(response,404,{message:'模板不存在'}),true;audit('更新报表模板','report_template',reportTemplateMatch[1],body.name.trim());return json(response,200,{ok:true}),true;} if(request.method==='GET'){const [rows]=await pool.execute('SELECT id,name,report_type AS reportType,description,fields_json AS fields,status FROM report_templates WHERE id=?',[reportTemplateMatch[1]]);return rows[0]?(json(response,200,{...rows[0],id:String(rows[0].id),fields:parseJsonColumn(rows[0].fields)}),true):(json(response,404,{message:'模板不存在'}),true);} }
  if (request.method === 'GET' && url.pathname === '/api/users') {
    if (request.user?.role !== 'admin') return json(response, 403, { message: '仅管理员可以查看用户' }), true;
    const [rows] = await pool.query('SELECT id,username,display_name AS displayName,dingtalk_user_id AS dingtalkUserId,role,status,DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") AS createdAt FROM users ORDER BY id');
    return json(response, 200, rows.map(row => ({ ...row, id: String(row.id) }))), true;
  }
  if (request.method === 'POST' && url.pathname === '/api/users') {
    if (request.user?.role !== 'admin') return json(response, 403, { message: '仅管理员可以创建用户' }), true;
    const body = await readBody(request); if (!body.username || !body.password || !body.displayName) return json(response, 400, { message: '请填写账号、密码和姓名' }), true;
    if (!allowedRoles.includes(body.role || 'project_member')) return json(response, 400, { message: '角色无效' }), true;
    const hash = await bcrypt.hash(String(body.password), 12);
    try { const [result] = await pool.execute('INSERT INTO users (username,password_hash,display_name,role,status) VALUES (?,?,?,?,?)', [body.username.trim(), hash, body.displayName.trim(), body.role || 'project_member', 'active']); const [rows] = await pool.execute('SELECT id,username,display_name AS displayName,role,status,DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") AS createdAt FROM users WHERE id=?', [result.insertId]); audit('创建用户', 'user', String(result.insertId), body.username.trim()); return json(response, 201, { ...rows[0], id: String(rows[0].id) }), true; } catch (error) { if (error.code === 'ER_DUP_ENTRY') return json(response, 409, { message: '账号已存在' }), true; throw error; }
  }
  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && request.method === 'PATCH') {
    if (request.user?.role !== 'admin') return json(response, 403, { message: '仅管理员可以修改用户' }), true;
    const body = await readBody(request); const [current] = await pool.execute('SELECT id,role,status FROM users WHERE id=?', [userMatch[1]]); if (!current[0]) return json(response, 404, { message: '用户不存在' }), true;
    const role = body.role || current[0].role, status = body.status || current[0].status; if (!allowedRoles.includes(role) || !['active', 'disabled'].includes(status)) return json(response, 400, { message: '用户状态或角色无效' }), true;
    if (String(current[0].id) === String(request.user.sub) && (status !== 'active' || role !== 'admin')) return json(response, 400, { message: '不能降级或停用当前管理员账号' }), true;
    await pool.execute('UPDATE users SET role=?,status=?,display_name=COALESCE(?,display_name) WHERE id=?', [role, status, body.displayName || null, userMatch[1]]); const [rows] = await pool.execute('SELECT id,username,display_name AS displayName,role,status,DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") AS createdAt FROM users WHERE id=?', [userMatch[1]]); audit('更新用户', 'user', userMatch[1], `${role}/${status}`); return json(response, 200, { ...rows[0], id: String(rows[0].id) }), true;
  }
  if (request.method === 'GET' && url.pathname === '/api/sop/template') {
    const [rows] = await pool.execute('SELECT name, version, status, template_json FROM sop_templates WHERE id=1');
    return json(response, 200, rows[0] ? parseJsonColumn(rows[0].template_json) : {}), true;
  }
  if (request.method === 'GET' && url.pathname === '/api/sop/templates') { const [rows] = await pool.query('SELECT id,name,version,status,updated_at AS updatedAt FROM sop_templates ORDER BY updated_at DESC,id DESC'); return json(response,200,rows.map(row=>({...row,id:String(row.id)}))),true; }
  if (request.method === 'POST' && url.pathname === '/api/sop/templates') { const body=await readBody(request); if(!body.name||!Array.isArray(body.stages)) return json(response,400,{message:'请填写模板名称和阶段'}),true; normalizeSopWeights(body); const [idRows]=await pool.query('SELECT COALESCE(MAX(id),0)+1 AS nextId FROM sop_templates'); const templateId=Number(idRows[0].nextId); await pool.execute('INSERT INTO sop_templates (id,name,version,status,template_json) VALUES (?,?,?,?,?)',[templateId,body.name,body.version||'V1.0',body.status||'草稿',JSON.stringify(body)]); audit('创建SOP模板','sop',String(templateId),body.name); return json(response,201,{id:String(templateId),name:body.name,version:body.version||'V1.0',status:body.status||'草稿'}),true; }
  const sopTemplateMatch=url.pathname.match(/^\/api\/sop\/templates\/(\d+)$/);
  if (sopTemplateMatch && request.method === 'GET') { const [rows]=await pool.execute('SELECT template_json FROM sop_templates WHERE id=?',[sopTemplateMatch[1]]); return rows[0]?(json(response,200,parseJsonColumn(rows[0].template_json)),true):(json(response,404,{message:'模板不存在'}),true); }
  if (sopTemplateMatch && request.method === 'PUT') { const body=await readBody(request); if(!body.name||!Array.isArray(body.stages)) return json(response,400,{message:'请填写模板名称和阶段'}),true; normalizeSopWeights(body); await pool.execute('UPDATE sop_templates SET name=?,version=?,status=?,template_json=? WHERE id=?',[body.name,body.version||'V1.0',body.status||'草稿',JSON.stringify(body),sopTemplateMatch[1]]); audit('更新SOP模板','sop',sopTemplateMatch[1],body.name); return json(response,200,{...body,id:sopTemplateMatch[1]}),true; }
  if (request.method === 'PUT' && url.pathname === '/api/sop/template') {
    const body = await readBody(request); if (!Array.isArray(body.stages)) return json(response, 400, { message: 'SOP阶段不能为空' }), true; normalizeSopWeights(body);
    await pool.execute('INSERT INTO sop_templates (id,name,version,status,template_json) VALUES (1,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),version=VALUES(version),status=VALUES(status),template_json=VALUES(template_json)', [body.name || '标准实施SOP', body.version || 'V1.0', body.status || '草稿', JSON.stringify(body)]);
    audit('保存SOP模板', 'sop', '1', body.version || 'V1.0'); return json(response, 200, { ok: true }), true;
  }
  if (request.method === 'GET' && url.pathname === '/api/projects') { return json(response, 200, await mysqlProjectList(pool, request.user)), true; }
  if (request.method === 'POST' && url.pathname === '/api/projects') {
    const body = await readBody(request);
    if (!body.name || !body.customer || !body.managerUserId || !body.plannedGoLive) return json(response, 400, { message: '请填写项目名称、客户、项目经理和计划上线日期' }), true;
    if (request.user.role !== 'admin' && (request.user.role !== 'project_manager' || String(body.managerUserId) !== String(request.user.sub))) return json(response, 403, { message: '项目经理只能创建并负责自己的项目' }), true;
    const [managers] = await pool.execute('SELECT id,display_name FROM users WHERE id=? AND status="active" LIMIT 1', [body.managerUserId]); if (!managers[0]) return json(response, 400, { message: '请选择有效的项目经理账号' }), true;
    const [result] = await pool.execute('INSERT INTO projects (name, customer, manager_id, manager_name, stage, progress, planned_go_live, health) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [body.name, body.customer, managers[0].id, managers[0].display_name, '事前准备', 0, body.plannedGoLive, '正常']);
    await pool.execute('INSERT INTO project_members (project_id,user_id,role) VALUES (?,?,?)', [result.insertId, managers[0].id, 'manager']);
    const [templates] = await pool.execute('SELECT name, version, template_json FROM sop_templates WHERE id=?', [body.sopTemplateId || 1]);
    const sopApplied = Boolean(templates[0]);
    if (sopApplied) { const template = normalizeProjectPlanTracking(normalizeSopWeights(parseJsonColumn(templates[0].template_json))); const plan = { projectId: String(result.insertId), sourceTemplateId: String(body.sopTemplateId || 1), sourceTemplate: templates[0].name, sourceVersion: templates[0].version, createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), stages: template.stages }; await pool.execute('INSERT INTO project_plans (project_id, source_template, source_version, plan_json) VALUES (?, ?, ?, ?)', [result.insertId, templates[0].name, templates[0].version, JSON.stringify(plan)]); }
    const [rows] = await pool.execute(`SELECT p.*, 0 AS openIssues, 0 AS highRiskIssues FROM projects p WHERE p.id = ?`, [result.insertId]);
    audit('创建项目', 'project', String(result.insertId), body.name); return json(response, 201, { ...mysqlProject(rows[0]), sopApplied }), true;
  }
  const projectSopSyncMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/plan\/sync-sop$/);
  const projectPlanMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/plan$/);
  const projectChecklistMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/plan\/checklist$/);
  const projectChecklistItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/plan\/checklist\/([^/]+)$/);
  const projectStartMatch=url.pathname.match(/^\/api\/projects\/(\d+)\/start$/);
  if(projectSopSyncMatch&&request.method==='POST'){
    const projectId=projectSopSyncMatch[1];if(!await projectAccessAllowed(pool,request.user,projectId))return json(response,403,{message:'无权同步该项目的 SOP'}),true;
    const body=await readBody(request),mode=body.mode==='replace'?'replace':'merge';if(!body.sopTemplateId)return json(response,400,{message:'请选择要同步的 SOP 模板'}),true;
    const [[templateRows],[planRows],[projectRows]]=await Promise.all([
      pool.execute('SELECT id,name,version,status,template_json FROM sop_templates WHERE id=?',[body.sopTemplateId]),
      pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[projectId]),
      pool.execute('SELECT id,manager_name,stage,execution_status,started_at FROM projects WHERE id=?',[projectId])
    ]);
    const templateRow=templateRows[0],project=projectRows[0];if(!templateRow)return json(response,404,{message:'SOP 模板不存在'}),true;if(templateRow.status!=='已发布')return json(response,400,{message:'只能同步已发布的 SOP 模板'}),true;if(!project)return json(response,404,{message:'项目不存在'}),true;
    const oldPlan=planRows[0]?parseJsonColumn(planRows[0].plan_json):{projectId,stages:[]};
    const {plan,summary}=syncSopPlan(oldPlan,parseJsonColumn(templateRow.template_json),{projectId,templateId:templateRow.id,name:templateRow.name,version:templateRow.version},mode);
    await pool.execute('INSERT INTO project_plans (project_id,source_template,source_version,plan_json) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE source_template=VALUES(source_template),source_version=VALUES(source_version),plan_json=VALUES(plan_json),updated_at=CURRENT_TIMESTAMP',[projectId,templateRow.name,templateRow.version,JSON.stringify(plan)]);
    const validIds=new Set((plan.stages||[]).flatMap(stage=>(stage.tasks||[]).map(task=>String(task.id))));
    for(const stage of plan.stages||[])for(const task of stage.tasks||[]){
      await pool.execute('UPDATE tasks SET plan_task_id=?,name=?,stage=?,owner_name=? WHERE project_id=? AND (plan_task_id=? OR (plan_task_id IS NULL AND name=?))',[task.id,task.name,stage.name,task.owner||project.manager_name,projectId,task.id,task.name]);
      await pool.execute('UPDATE documents SET task_name=? WHERE project_id=? AND plan_task_id=?',[task.name,projectId,task.id]);
      if(project.execution_status==='执行中'&&stage.name===project.stage){const due=new Date();due.setDate(due.getDate()+Number(task.duration||1));await pool.execute('INSERT INTO tasks (project_id,plan_task_id,name,stage,owner_name,due_date,progress,status) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE project_id=? AND plan_task_id=?)',[projectId,task.id,task.name,stage.name,task.owner||project.manager_name,due.toISOString().slice(0,10),Number(task.actualProgress)||0,task.actualStatus||'未开始',projectId,task.id]);}
    }
    if(mode==='replace')for(const oldTask of (oldPlan.stages||[]).flatMap(stage=>stage.tasks||[]))if(!validIds.has(String(oldTask.id))){await pool.execute('DELETE FROM tasks WHERE project_id=? AND plan_task_id=?',[projectId,oldTask.id]);await pool.execute('UPDATE documents SET plan_task_id=NULL WHERE project_id=? AND plan_task_id=?',[projectId,oldTask.id]);}
    audit('同步项目SOP','project_plan',projectId,`${templateRow.name}/${templateRow.version}/${mode}`);return json(response,200,{plan,summary}),true;
  }
  if(projectStartMatch&&request.method==='POST'){
    if(!await projectAccessAllowed(pool,request.user,projectStartMatch[1]))return json(response,403,{message:'无权启动该项目'}),true;
    const [projects]=await pool.execute('SELECT * FROM projects WHERE id=?',[projectStartMatch[1]]);if(!projects[0])return json(response,404,{message:'项目不存在'}),true;
    const project=projects[0];if(project.execution_status==='已结项')return json(response,400,{message:'已结项项目不能重新启动'}),true;if(project.execution_status==='执行中'){const [rows]=await pool.execute('SELECT p.*,0 AS openIssues,0 AS highRiskIssues FROM projects p WHERE id=?',[project.id]);return json(response,200,mysqlProject(rows[0])),true;}const [plans]=await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[project.id]);if(!plans[0])return json(response,400,{message:'请先为项目套用 SOP 模板'}),true;
    const plan=parseJsonColumn(plans[0].plan_json),stage=project.execution_status==='已暂停'?(plan.stages||[]).find(item=>item.name===project.stage):plan.stages?.[0];if(!stage)return json(response,400,{message:'SOP 中没有可启动的阶段'}),true;
    normalizeProjectPlanTracking(plan);const start=new Date();for(const task of stage.tasks||[]){const due=new Date(start);due.setDate(due.getDate()+Number(task.duration||1));await pool.execute('INSERT INTO tasks (project_id,plan_task_id,name,stage,owner_name,due_date,progress,status) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE project_id=? AND (plan_task_id=? OR (name=? AND stage=?)))',[project.id,task.id,task.name,stage.name,task.owner||project.manager_name,due.toISOString().slice(0,10),Number(task.actualProgress)||0,task.actualStatus||'进行中',project.id,task.id,task.name,stage.name]);}await pool.execute('UPDATE project_plans SET plan_json=? WHERE project_id=?',[JSON.stringify(plan),project.id]);
    await pool.execute("UPDATE projects SET execution_status='执行中',started_at=COALESCE(started_at,NOW()),paused_days=paused_days+CASE WHEN pause_started_at IS NULL THEN 0 ELSE DATEDIFF(NOW(),pause_started_at) END,pause_started_at=NULL,stage=? WHERE id=?",[stage.name,project.id]);audit('启动项目','project',project.id,stage.name);const [rows]=await pool.execute('SELECT p.*,0 AS openIssues,0 AS highRiskIssues FROM projects p WHERE id=?',[project.id]);return json(response,200,mysqlProject(rows[0])),true;
  }
  const projectLifecycleMatch=url.pathname.match(/^\/api\/projects\/(\d+)\/(pause|close)$/);
   if(projectLifecycleMatch&&request.method==='POST'){if(!await projectAccessAllowed(pool,request.user,projectLifecycleMatch[1]))return json(response,403,{message:'无权操作该项目'}),true;const closing=projectLifecycleMatch[2]==='close';const [current]=await pool.execute('SELECT execution_status FROM projects WHERE id=?',[projectLifecycleMatch[1]]);if(!current[0])return json(response,404,{message:'项目不存在'}),true;if(!closing&&current[0].execution_status!=='执行中')return json(response,400,{message:'只有执行中的项目可以暂停'}),true;if(closing&&current[0].execution_status==='已结项')return json(response,400,{message:'项目已经结项'}),true;if(closing){const [blockers]=await Promise.all([pool.execute('SELECT COUNT(*) AS count FROM tasks WHERE project_id=? AND status<>"已完成"',[projectLifecycleMatch[1]]),pool.execute('SELECT COUNT(*) AS count FROM issues WHERE project_id=? AND status<>"已关闭"',[projectLifecycleMatch[1]]),pool.execute('SELECT COUNT(*) AS count FROM documents WHERE project_id=? AND status NOT IN ("已通过","已确认")',[projectLifecycleMatch[1]])]);const unfinishedTasks=Number(blockers[0][0][0].count),openIssues=Number(blockers[1][0][0].count),pendingDeliverables=Number(blockers[2][0][0].count);if(unfinishedTasks||openIssues||pendingDeliverables)return json(response,409,{message:'项目尚有结项阻塞项',blockers:{unfinishedTasks,openIssues,pendingDeliverables,total:unfinishedTasks+openIssues+pendingDeliverables}}),true;}await pool.execute(closing?"UPDATE projects SET execution_status='已结项',progress=100,pause_started_at=NULL WHERE id=?":"UPDATE projects SET execution_status='已暂停',pause_started_at=COALESCE(pause_started_at,NOW()) WHERE id=?",[projectLifecycleMatch[1]]);await audit(closing?'项目结项':'项目暂停','project',projectLifecycleMatch[1],'',request.user,request.ipAddress);const [rows]=await pool.execute('SELECT p.*,0 AS openIssues,0 AS highRiskIssues FROM projects p WHERE id=?',[projectLifecycleMatch[1]]);return json(response,200,mysqlProject(rows[0])),true;}
  if(projectChecklistMatch&&request.method==='PATCH'){
    if(!await projectAccessAllowed(pool,request.user,projectChecklistMatch[1]))return json(response,403,{message:'无权更新该项目检查项'}),true;const body=await readBody(request),[rows]=await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[projectChecklistMatch[1]]);if(!rows[0])return json(response,404,{message:'项目实施计划不存在'}),true;
    const plan=normalizeProjectPlanTracking(parseJsonColumn(rows[0].plan_json));let matchedTask,matchedCheck;for(const stage of plan.stages||[]){const task=(stage.tasks||[]).find(item=>String(item.id)===String(body.planTaskId));if(task){matchedTask=task;matchedCheck=(task.checklist||[]).find(item=>String(item.id)===String(body.checkId));break;}}
    if(!matchedTask||!matchedCheck)return json(response,404,{message:'计划任务或检查项不存在'}),true;matchedCheck.completed=Boolean(body.completed);matchedCheck.completedAt=matchedCheck.completed?new Date().toLocaleString('zh-CN',{hour12:false}):'';const total=matchedTask.checklist.length,done=matchedTask.checklist.filter(item=>item.completed).length,progress=total?Math.round(done/total*100):0;matchedTask.actualProgress=progress;matchedTask.actualStatus=progress===100?'已完成':progress>0?'进行中':'未开始';
    const [taskRows]=await pool.execute('SELECT id,project_id,plan_task_id,name,stage,owner_name,DATE_FORMAT(due_date,"%Y-%m-%d") AS dueDate,progress,status FROM tasks WHERE project_id=? AND plan_task_id=? LIMIT 1',[projectChecklistMatch[1],matchedTask.id]);let linkedTask=null;if(taskRows[0]){const status=taskStatus(progress,taskRows[0].dueDate);await pool.execute('UPDATE tasks SET progress=?,status=?,progress_note=? WHERE id=?',[progress,status,`检查项完成 ${done}/${total}`,taskRows[0].id]);linkedTask={id:String(taskRows[0].id),planTaskId:matchedTask.id,name:taskRows[0].name,stage:taskRows[0].stage,owner:taskRows[0].owner_name,dueDate:taskRows[0].dueDate,progress,status};matchedTask.actualStatus=status;}
    await pool.execute('UPDATE project_plans SET plan_json=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=?',[JSON.stringify(plan),projectChecklistMatch[1]]);audit('更新项目检查项','project_plan',projectChecklistMatch[1],`${matchedTask.name}:${matchedCheck.name}:${matchedCheck.completed?'完成':'恢复'}`);return json(response,200,{plan,task:linkedTask}),true;
  }
  if(projectChecklistMatch&&request.method==='POST'){if(!await projectAccessAllowed(pool,request.user,projectChecklistMatch[1]))return json(response,403,{message:'无权新增检查项'}),true;const body=await readBody(request),[rows]=await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[projectChecklistMatch[1]]);if(!body.planTaskId||!String(body.name||'').trim())return json(response,400,{message:'请选择计划任务并填写检查项'}),true;const plan=normalizeProjectPlanTracking(parseJsonColumn(rows[0]?.plan_json));let task;for(const stage of plan.stages||[]){task=(stage.tasks||[]).find(item=>String(item.id)===String(body.planTaskId));if(task)break;}if(!task)return json(response,404,{message:'计划任务不存在'}),true;const check={id:`${task.id}-check-${Date.now()}`,name:String(body.name).trim(),completed:false,completedAt:''};task.checklist=task.checklist||[];task.checklist.push(check);await persistChecklistPlan(pool,projectChecklistMatch[1],plan,task);audit('新增检查项','project_plan',projectChecklistMatch[1],check.name);return json(response,201,{plan,check}),true;}
  if(projectChecklistItemMatch&&['PUT','DELETE'].includes(request.method)){if(!await projectAccessAllowed(pool,request.user,projectChecklistItemMatch[1]))return json(response,403,{message:'无权维护检查项'}),true;const body=request.method==='PUT'?await readBody(request):{},[rows]=await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[projectChecklistItemMatch[1]]),plan=normalizeProjectPlanTracking(parseJsonColumn(rows[0]?.plan_json));let task,check,index=-1;for(const stage of plan.stages||[]){if(task)break;for(const candidate of stage.tasks||[]){index=(candidate.checklist||[]).findIndex(item=>String(item.id)===String(projectChecklistItemMatch[2]));if(index>=0){task=candidate;check=candidate.checklist[index];break;}}}if(!task)return json(response,404,{message:'检查项不存在'}),true;if(request.method==='PUT'){if(!String(body.name||'').trim())return json(response,400,{message:'检查项内容不能为空'}),true;check.name=String(body.name).trim();}else task.checklist.splice(index,1);await persistChecklistPlan(pool,projectChecklistItemMatch[1],plan,task);audit(request.method==='PUT'?'编辑检查项':'删除检查项','project_plan',projectChecklistItemMatch[1],check.name);return json(response,200,{plan}),true;}
  if (projectPlanMatch && request.method === 'PUT') {
    if (!await projectAccessAllowed(pool, request.user, projectPlanMatch[1])) return json(response, 403, { message: '无权更新该项目计划' }), true;
    const body=await readBody(request);if(!Array.isArray(body.stages))return json(response,400,{message:'计划阶段不能为空'}),true;const [oldRows]=await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[projectPlanMatch[1]]),oldPlan=oldRows[0]?normalizeProjectPlanTracking(parseJsonColumn(oldRows[0].plan_json)):null;
    const plan=normalizeProjectPlanTracking({...body,projectId:String(projectPlanMatch[1]),updatedAt:new Date().toLocaleString('zh-CN',{hour12:false})});
    await pool.execute('INSERT INTO project_plans (project_id,source_template,source_version,plan_json) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE plan_json=VALUES(plan_json),updated_at=CURRENT_TIMESTAMP',[projectPlanMatch[1],body.sourceTemplate||'手动维护计划',body.sourceVersion||'V1.0',JSON.stringify(plan)]);
    for(const stage of plan.stages||[])for(const task of stage.tasks||[]){await pool.execute('UPDATE tasks SET plan_task_id=COALESCE(plan_task_id,?),name=?,stage=?,owner_name=? WHERE project_id=? AND (plan_task_id=? OR (plan_task_id IS NULL AND name=?))',[task.id,task.name,stage.name,task.owner||'待分配',projectPlanMatch[1],task.id,task.name]);await pool.execute('UPDATE documents SET task_name=? WHERE project_id=? AND plan_task_id=?',[task.name,projectPlanMatch[1],task.id]);}
    const validIds=new Set((plan.stages||[]).flatMap(stage=>(stage.tasks||[]).map(task=>String(task.id))));for(const oldTask of (oldPlan?.stages||[]).flatMap(stage=>stage.tasks||[]))if(!validIds.has(String(oldTask.id))){await pool.execute('DELETE FROM tasks WHERE project_id=? AND plan_task_id=?',[projectPlanMatch[1],oldTask.id]);await pool.execute('UPDATE documents SET plan_task_id=NULL WHERE project_id=? AND plan_task_id=?',[projectPlanMatch[1],oldTask.id]);}
    audit('更新项目计划','project_plan',projectPlanMatch[1],'计划与任务管理同步');return json(response,200,plan),true;
  }
  if (projectPlanMatch && request.method === 'GET') {
    if (!await projectAccessAllowed(pool, request.user, projectPlanMatch[1])) return json(response,403,{message:'无权访问该项目计划'}),true;const [rows]=await pool.execute('SELECT plan_json FROM project_plans WHERE project_id=?',[projectPlanMatch[1]]);if(!rows[0])return json(response,404,{message:'项目尚未套用SOP模板'}),true;
    const plan=await backfillPlanTaskLinks(pool,projectPlanMatch[1],parseJsonColumn(rows[0].plan_json));await pool.execute('UPDATE project_plans SET plan_json=? WHERE project_id=?',[JSON.stringify(plan),projectPlanMatch[1]]);return json(response,200,plan),true;
  }
  const memberMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/members$/);
  if (memberMatch && request.method === 'GET') { if (request.user?.role !== 'admin') return json(response, 403, { message: '仅管理员可以查看项目成员' }), true; const [rows] = await pool.execute('SELECT u.id,u.username,u.display_name AS displayName,u.role,pm.role AS projectRole FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? ORDER BY u.id', [memberMatch[1]]); return json(response, 200, rows.map(row => ({ ...row, id: String(row.id) }))), true; }
  if (memberMatch && request.method === 'PUT') { if (request.user?.role !== 'admin') return json(response, 403, { message: '仅管理员可以分配项目成员' }), true; const body = await readBody(request); if (!Array.isArray(body.members)) return json(response, 400, { message: '成员列表格式不正确' }), true; const connection = await pool.getConnection(); try { await connection.beginTransaction(); await connection.execute('DELETE FROM project_members WHERE project_id=?', [memberMatch[1]]); for (const member of body.members) await connection.execute('INSERT INTO project_members (project_id,user_id,role) VALUES (?,?,?)', [memberMatch[1], member.userId, member.role || 'member']); const manager = body.members.find(member => member.role === 'manager'); if (manager) { const [users] = await connection.execute('SELECT id,display_name FROM users WHERE id=?', [manager.userId]); if (users[0]) await connection.execute('UPDATE projects SET manager_id=?,manager_name=? WHERE id=?', [users[0].id, users[0].display_name, memberMatch[1]]); } await connection.commit(); audit('更新项目成员', 'project', memberMatch[1], `${body.members.length} 人`); return json(response, 200, { ok: true }), true; } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); } }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && request.method === 'GET') { const projects = await mysqlProjectList(pool, request.user); const project = projects.find(item => item.id === projectMatch[1]); return project ? (json(response, 200, project), true) : (json(response, 404, { message: '项目不存在' }), true); }
  if (request.method === 'GET' && url.pathname === '/api/tasks') {
    const [rows] = await pool.query('SELECT t.id, t.project_id AS projectId, t.plan_task_id AS planTaskId, t.name, p.name AS project, t.stage, t.owner_name AS owner, DATE_FORMAT(t.due_date, "%Y-%m-%d") AS dueDate, t.progress, t.status, t.progress_note AS progressNote, DATE_FORMAT(t.updated_at, "%Y-%m-%d %H:%i:%s") AS updatedAt FROM tasks t JOIN projects p ON p.id = t.project_id ORDER BY t.id DESC'); const allowed = await allowedProjectIds(pool, request.user); return json(response, 200, rows.filter(row => !allowed || allowed.has(String(row.projectId))).map(({ projectId, ...row }) => ({ ...row, id: String(row.id), progress: Number(row.progress) }))), true;
  }
  if (request.method === 'POST' && url.pathname === '/api/tasks') {
    const body = await readBody(request); if (!body.name || !body.project || !body.owner || !body.dueDate) return json(response, 400, { message: '请填写任务、项目、负责人和计划完成日期' }), true;
    const [projects] = await pool.execute('SELECT id FROM projects WHERE name = ? OR customer = ? LIMIT 1', [body.project, body.project]); if (!projects[0]) return json(response, 400, { message: '请选择系统中的有效项目' }), true; if (!await projectAccessAllowed(pool, request.user, projects[0].id)) return json(response, 403, { message: '无权在该项目创建任务' }), true;
    const progress = Math.max(0, Math.min(100, Number(body.progress || 0))); const status = taskStatus(progress, body.dueDate); const [result] = await pool.execute('INSERT INTO tasks (project_id, name, stage, owner_name, due_date, progress, status, progress_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [projects[0].id, body.name, body.stage || '事前准备', body.owner, body.dueDate, progress, status, body.progressNote || null]);
    const [rows] = await pool.execute('SELECT t.id,t.plan_task_id AS planTaskId,t.name,p.name AS project,t.stage,t.owner_name AS owner,DATE_FORMAT(t.due_date, "%Y-%m-%d") AS dueDate,t.progress,t.status,t.progress_note AS progressNote FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?', [result.insertId]); audit('创建任务', 'task', String(result.insertId), body.name); return json(response, 201, { ...rows[0], id: String(rows[0].id), progress: Number(rows[0].progress) }), true;
  }
  const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === 'PUT') { const body = await readBody(request); const [found] = await pool.execute('SELECT id,project_id,plan_task_id,due_date,progress,name,stage,owner_name FROM tasks WHERE id=?', [taskMatch[1]]); if (!found[0]) return json(response, 404, { message: '任务不存在' }), true; if (!await projectAccessAllowed(pool, request.user, found[0].project_id)) return json(response, 403, { message: '无权更新该任务' }), true; const task = found[0], progress = body.progress === undefined ? Number(task.progress) : Math.max(0, Math.min(100, Number(body.progress))); const dueDate = body.dueDate || new Date(task.due_date).toISOString().slice(0, 10); const status = taskStatus(progress, dueDate); await pool.execute('UPDATE tasks SET name=?,stage=?,owner_name=?,due_date=?,progress=?,status=?,progress_note=? WHERE id=?', [body.name || task.name, body.stage || task.stage, body.owner || task.owner_name, dueDate, progress, status, body.progressNote === undefined ? null : String(body.progressNote).slice(0,1000), task.id]); const [rows] = await pool.execute('SELECT t.id,t.project_id,t.plan_task_id AS planTaskId,t.name,p.name AS project,t.stage,t.owner_name AS owner,DATE_FORMAT(t.due_date, "%Y-%m-%d") AS dueDate,t.progress,t.status,t.progress_note AS progressNote FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?', [task.id]); await syncTaskProgressToProjectPlan(pool,task.project_id,{...rows[0],plan_task_id:rows[0].planTaskId,owner_name:rows[0].owner,due_date:rows[0].dueDate}); audit('编辑任务', 'task', task.id, rows[0].name); return json(response, 200, { ...rows[0], id: String(rows[0].id), progress: Number(rows[0].progress) }), true; }
  if (taskMatch && request.method === 'PATCH') { const body = await readBody(request); const [found] = await pool.execute('SELECT id,project_id,plan_task_id,due_date,progress FROM tasks WHERE id=?', [taskMatch[1]]); if (!found[0]) return json(response, 404, { message: '任务不存在' }), true; if (!await projectAccessAllowed(pool, request.user, found[0].project_id)) return json(response, 403, { message: '无权更新该任务' }), true; const progress = body.progress === undefined ? Number(found[0].progress) : Math.max(0, Math.min(100, Number(body.progress))); const status = taskStatus(progress, new Date(found[0].due_date).toISOString().slice(0, 10)); await pool.execute('UPDATE tasks SET progress=?, status=?, progress_note=COALESCE(?, progress_note) WHERE id=?', [progress, status, body.progressNote === undefined ? null : String(body.progressNote).slice(0, 1000), taskMatch[1]]); const [rows] = await pool.execute('SELECT t.id,t.project_id,t.plan_task_id AS planTaskId,t.name,p.name AS project,t.stage,t.owner_name AS owner,DATE_FORMAT(t.due_date, "%Y-%m-%d") AS dueDate,t.progress,t.status,t.progress_note AS progressNote FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?', [taskMatch[1]]); await syncTaskProgressToProjectPlan(pool,found[0].project_id,{...rows[0],plan_task_id:rows[0].planTaskId,owner_name:rows[0].owner,due_date:rows[0].dueDate}); audit('更新任务进度', 'task', taskMatch[1], `${progress}%`); return json(response, 200, { ...rows[0], id: String(rows[0].id), progress: Number(rows[0].progress) }), true; }
  if (taskMatch && request.method === 'DELETE') { const [rows]=await pool.execute('SELECT id,project_id,plan_task_id,name,stage,owner_name,DATE_FORMAT(due_date,"%Y-%m-%d") AS dueDate FROM tasks WHERE id=?',[taskMatch[1]]);if(!rows[0])return json(response,404,{message:'任务不存在'}),true;if(!await projectAccessAllowed(pool,request.user,rows[0].project_id))return json(response,403,{message:'无权删除该任务'}),true;if(rows[0].plan_task_id)await syncTaskProgressToProjectPlan(pool,rows[0].project_id,{...rows[0],progress:0,status:'未开始',plan_task_id:rows[0].plan_task_id});await pool.execute('DELETE FROM tasks WHERE id=?',[taskMatch[1]]);audit('删除任务','task',taskMatch[1],rows[0].name);return json(response,200,{ok:true}),true; }
  const documentMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/documents(?:\/([^/]+)(?:\/(review|download))?)?$/);
  if (documentMatch) {
    const [, projectId, documentId, action] = documentMatch;
    if (!await projectAccessAllowed(pool, request.user, projectId)) return json(response, 403, { message: '无权访问该项目文档' }), true;
    const [projects] = await pool.execute('SELECT id FROM projects WHERE id=?', [projectId]); if (!projects[0]) return json(response, 404, { message: '项目不存在' }), true;
    const asDocument = row => ({ id: String(row.id), name: row.name, type: row.type, planTaskId: row.plan_task_id || '', task: row.task_name || '未关联任务', deliverable: row.deliverable_name || '', version: row.version, status: row.status, statusClass: statusClass(row.status), time: row.time, reviewComment: row.review_comment || '', hasFile: Boolean(row.object_key) });
    if (request.method === 'POST' && !documentId) { const body=await readBody(request); if(!body.name||!body.dataUrl||!body.planTaskId||!body.task||!body.deliverable)return json(response,400,{message:'请填写完整文档信息'}),true; let stored; try { stored=saveDataUrl(body.dataUrl,body.name); const [result]=await pool.execute('INSERT INTO documents (project_id,name,object_key,mime_type,type,plan_task_id,task_name,deliverable_name,version,status) VALUES (?,?,?,?,?,?,?,?,?,?)',[projectId,body.name,stored.key,stored.mimeType,body.type||'交付物',body.planTaskId,body.task,body.deliverable,body.version||'V1.0','待审核']); const [rows]=await pool.execute('SELECT id,name,type,plan_task_id,task_name,deliverable_name,version,status,review_comment,object_key,DATE_FORMAT(created_at,"%Y-%m-%d %H:%i:%s") AS time FROM documents WHERE id=?',[result.insertId]); await audit('上传项目交付文档','document',String(result.insertId),body.name); return json(response,201,asDocument(rows[0])),true; } catch(error) { if(stored?.key){try{deleteObject(stored.key);}catch(cleanupError){console.error('文档文件补偿删除失败',{key:stored.key,error:cleanupError.message});}} throw error; } }
    if (request.method === 'GET' && !documentId) { const [rows] = await pool.execute('SELECT id,name,type,plan_task_id,task_name,deliverable_name,version,status,review_comment,object_key,DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") AS time FROM documents WHERE project_id=? ORDER BY id DESC', [projectId]); return json(response, 200, rows.map(asDocument)), true; }
    const [rows] = await pool.execute('SELECT * FROM documents WHERE id=? AND project_id=?', [documentId, projectId]); const document = rows[0]; if (!document) return json(response, 404, { message: '文档不存在' }), true;
    if (request.method === 'PUT' && !action) { const body=await readBody(request);if(!body.name||!body.planTaskId||!body.task||!body.deliverable)return json(response,400,{message:'请填写文档名称并选择关联任务和输出物'}),true;await pool.execute('UPDATE documents SET name=?,type=?,plan_task_id=?,task_name=?,deliverable_name=?,version=? WHERE id=?',[body.name,body.type||document.type,body.planTaskId,body.task,body.deliverable,body.version||document.version,document.id]);const [updated]=await pool.execute('SELECT id,name,type,plan_task_id,task_name,deliverable_name,version,status,review_comment,object_key,DATE_FORMAT(created_at,"%Y-%m-%d %H:%i:%s") AS time FROM documents WHERE id=?',[document.id]);audit('编辑交付文档','document',String(document.id),body.name);return json(response,200,asDocument(updated[0])),true; }
    if (request.method === 'DELETE' && !action) { const connection=await pool.getConnection(); try { await connection.beginTransaction(); await connection.execute('DELETE FROM documents WHERE id=?',[document.id]); await connection.commit(); try { deleteObject(document.object_key); } catch(error) { console.error('文档文件删除补偿失败',{key:document.object_key,error:error.message}); } await audit('删除交付文档','document',String(document.id),document.name); return json(response,200,{ok:true}),true; } catch(error) { await connection.rollback(); throw error; } finally { connection.release(); } }
    if (request.method === 'PATCH' && action === 'review') { const body = await readBody(request); await pool.execute('UPDATE documents SET status=?, review_comment=? WHERE id=?', [body.status || document.status, body.reviewComment || '', document.id]); const [updated] = await pool.execute('SELECT id,name,type,plan_task_id,task_name,deliverable_name,version,status,review_comment,object_key,DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") AS time FROM documents WHERE id=?', [document.id]); audit('更新文档审核状态', 'document', String(document.id), updated[0].status); return json(response, 200, asDocument(updated[0])), true; }
    if (request.method === 'GET' && action === 'download') { const content = readObject(document.object_key); if (!content) return json(response, 404, { message: '该文档暂无可下载的源文件' }), true; response.writeHead(200, { 'Content-Type': document.mime_type || 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}` }); response.end(content); return true; }
    return json(response, 405, { message: '不支持的文档操作' }), true;
  }
  if (request.method === 'GET' && url.pathname === '/api/issues') { const [rows] = await pool.query('SELECT i.id, i.project_id AS projectId, i.title, p.name AS project, i.type, i.level, i.owner_name AS owner, DATE_FORMAT(i.due_date, "%Y-%m-%d") AS dueDate, i.status FROM issues i JOIN projects p ON p.id=i.project_id ORDER BY i.id DESC'); const allowed = await allowedProjectIds(pool, request.user); return json(response, 200, rows.filter(row => !allowed || allowed.has(String(row.projectId))).map(({ projectId, ...row }) => ({ ...row, id: String(row.id) }))), true; }
  if (request.method === 'POST' && url.pathname === '/api/issues') { const body = await readBody(request); if (!body.title || !body.project || !body.owner || !body.dueDate) return json(response, 400, { message: '请填写标题、项目、责任部门和计划解决日期' }), true; const [projects] = await pool.execute('SELECT id FROM projects WHERE name=? OR customer=? LIMIT 1', [body.project, body.project]); if (!projects[0]) return json(response, 400, { message: '请选择系统中的有效项目' }), true; if (!await projectAccessAllowed(pool, request.user, projects[0].id)) return json(response, 403, { message: '无权在该项目创建问题' }), true; const [result] = await pool.execute('INSERT INTO issues (project_id,title,type,level,owner_name,due_date,status) VALUES (?,?,?,?,?,?,?)', [projects[0].id, body.title, body.type || '其他问题', body.level || '中', body.owner, body.dueDate, '待处理']); const [rows] = await pool.execute('SELECT i.id, i.title,p.name AS project,i.type,i.level,i.owner_name AS owner,DATE_FORMAT(i.due_date, "%Y-%m-%d") AS dueDate,i.status FROM issues i JOIN projects p ON p.id=i.project_id WHERE i.id=?', [result.insertId]); audit('创建问题', 'issue', String(result.insertId), body.title); return json(response, 201, { ...rows[0], id: String(rows[0].id) }), true; }
  const issueMatch = url.pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (issueMatch && request.method === 'PUT') { const body = await readBody(request); const [found] = await pool.execute('SELECT id,project_id,title,type,level,owner_name,due_date,status FROM issues WHERE id=?', [issueMatch[1]]); if (!found[0]) return json(response, 404, { message: '问题不存在' }), true; if (!await projectAccessAllowed(pool, request.user, found[0].project_id)) return json(response, 403, { message: '无权更新该问题' }), true; const issue = found[0]; await pool.execute('UPDATE issues SET title=?,type=?,level=?,owner_name=?,due_date=?,status=? WHERE id=?', [body.title || issue.title, body.type || issue.type, body.level || issue.level, body.owner || issue.owner_name, body.dueDate || new Date(issue.due_date).toISOString().slice(0,10), body.status || issue.status, issue.id]); const [rows] = await pool.execute('SELECT i.id,i.title,p.name AS project,i.type,i.level,i.owner_name AS owner,DATE_FORMAT(i.due_date, "%Y-%m-%d") AS dueDate,i.status FROM issues i JOIN projects p ON p.id=i.project_id WHERE i.id=?', [issue.id]); audit('编辑问题风险', 'issue', issue.id, rows[0].title); return json(response, 200, { ...rows[0], id: String(rows[0].id) }), true; }
  if (issueMatch && request.method === 'PATCH') { const body = await readBody(request); const [found] = await pool.execute('SELECT project_id FROM issues WHERE id=?', [issueMatch[1]]); if (!found[0]) return json(response, 404, { message: '问题不存在' }), true; if (!await projectAccessAllowed(pool, request.user, found[0].project_id)) return json(response, 403, { message: '无权更新该问题' }), true; await pool.execute('UPDATE issues SET status=? WHERE id=?', [body.status || '待处理', issueMatch[1]]); const [rows] = await pool.execute('SELECT i.id,i.title,p.name AS project,i.type,i.level,i.owner_name AS owner,DATE_FORMAT(i.due_date, "%Y-%m-%d") AS dueDate,i.status FROM issues i JOIN projects p ON p.id=i.project_id WHERE i.id=?', [issueMatch[1]]); audit('更新问题状态', 'issue', issueMatch[1], rows[0].status); return json(response, 200, { ...rows[0], id: String(rows[0].id) }), true; }
  if (request.method === 'GET' && url.pathname === '/api/messages') { const allowed=await allowedProjectIds(pool,request.user); const [rows] = await pool.query('SELECT m.id, m.project_id AS projectId, COALESCE(p.name, "未归属") AS project, m.source, m.content, m.category, m.status, m.sender, DATE_FORMAT(m.received_at, "%Y-%m-%d %H:%i:%s") AS receivedAt FROM messages m LEFT JOIN projects p ON p.id=m.project_id ORDER BY m.id DESC'); return json(response, 200, rows.filter(row=>request.user?.role==='admin'||(row.projectId&&allowed.has(String(row.projectId)))).map(row => ({ ...row, id: String(row.id) }))), true; }
  if (request.method === 'GET' && url.pathname === '/api/dingtalk/monitor/overview') { const [rows] = await pool.query("SELECT COUNT(*) AS collectedMessages, SUM(status='待确认') AS pendingAnalysis, SUM(status='已确认') AS confirmedMessages, SUM(project_id IS NULL) AS unassignedMessages FROM messages"); const data = rows[0]; return json(response, 200, { streamStatus: '维护中', robotStatus: '运行正常', collectedMessages: Number(data.collectedMessages), pendingAnalysis: Number(data.pendingAnalysis || 0), confirmedMessages: Number(data.confirmedMessages || 0), failedMessages: 0, unassignedMessages: Number(data.unassignedMessages || 0) }), true; }
  const resolveMessageProject = async (body) => { if (!body.project) { if (request.user?.role !== 'admin') { const e = new Error('未归属消息仅管理员可操作'); e.statusCode = 403; throw e; } return null; } const [projects] = await pool.execute('SELECT id FROM projects WHERE name=? OR customer=? LIMIT 1', [body.project, body.project]); if (!projects[0]) { const e = new Error('项目不存在'); e.statusCode = 400; throw e; } if (!await projectAccessAllowed(pool, request.user, projects[0].id)) { const e = new Error('无权访问该项目'); e.statusCode = 403; throw e; } return projects[0].id; };
  const createMessage = async (projectId, body, source, category, sender) => { const [result] = await pool.execute('INSERT INTO messages (project_id, source, content, category, status, sender) VALUES (?, ?, ?, ?, ?, ?)', [projectId, source, body.content, category, '待确认', body.sender || sender]); const [rows] = await pool.execute('SELECT m.id,COALESCE(p.name,"未归属") AS project,m.source,m.content,m.category,m.status,m.sender,DATE_FORMAT(m.received_at,"%Y-%m-%d %H:%i:%s") AS receivedAt FROM messages m LEFT JOIN projects p ON p.id=m.project_id WHERE m.id=?', [result.insertId]); return rows[0]; };
  if (request.method === 'POST' && url.pathname === '/api/messages/robot') { if (request.user?.role !== 'admin') return json(response, 403, { message: '机器人入口仅管理员可用' }), true; const body = await readBody(request); const projectId = await resolveMessageProject(body); const message = await createMessage(projectId, { ...body, content: body.content || '机器人采集的项目沟通消息' }, 'BOT_MENTION', '待办任务', '项目成员'); return json(response, 201, { ...message, id: String(message.id) }), true; }
  if (request.method === 'POST' && url.pathname === '/api/messages/manual') { const body = await readBody(request); if (!body.project || !body.content) return json(response, 400, { message: '请选择项目并填写消息内容' }), true; const projectId = await resolveMessageProject(body); const message = await createMessage(projectId, body, 'MESSAGE_MENU', body.category || '项目进展', '消息菜单提交人'); audit('提交消息菜单采集', 'message', String(message.id), message.category); return json(response, 201, { ...message, id: String(message.id) }), true; }
  if (request.method === 'POST' && url.pathname === '/api/messages/daily-card') { const body = await readBody(request); if (!body.project || !body.content) return json(response, 400, { message: '请选择项目并至少填写一项进展' }), true; const projectId = await resolveMessageProject(body); const message = await createMessage(projectId, body, 'DAILY_CARD', '项目进展', '每日进展卡片填写人'); audit('提交每日进展卡片', 'message', String(message.id), '项目进展'); return json(response, 201, { ...message, id: String(message.id) }), true; }
  const confirmedMessageMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/confirm$/);
  if (confirmedMessageMatch && request.method === 'POST') {
    const body = await readBody(request); const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT * FROM messages WHERE id=? FOR UPDATE', [confirmedMessageMatch[1]]); const message = rows[0];
      if (!message) { await connection.rollback(); return json(response, 404, { message: '消息不存在' }), true; }
      if (message.project_id && request.user?.role !== 'admin') { const [members] = await connection.execute('SELECT 1 FROM project_members WHERE project_id=? AND user_id=? LIMIT 1', [message.project_id, request.user?.sub]); if (!members[0]) { await connection.rollback(); return json(response, 403, { message: '无权确认该项目消息' }), true; } }
      if (!message.project_id && request.user?.role !== 'admin') { await connection.rollback(); return json(response, 403, { message: '未归属消息仅管理员可确认' }), true; }
      const result = validateStructuredMessageResult(body.structuredResult || body.result);
      if (!message.generated_task && result.task && message.project_id) await connection.execute('INSERT INTO tasks (project_id,name,stage,owner_name,due_date,progress,status) VALUES (?,?,?,?,?,?,?)', [message.project_id, result.task.name, result.task.stage || '', result.task.owner || '', result.task.dueDate, result.task.progress, result.task.status]);
      if (!message.generated_issue && result.issue && message.project_id) await connection.execute('INSERT INTO issues (project_id,title,type,level,owner_name,due_date,status) VALUES (?,?,?,?,?,?,?)', [message.project_id, result.issue.title, result.issue.type, result.issue.level, result.issue.owner || '', result.issue.dueDate, result.issue.status]);
      await connection.execute('UPDATE messages SET generated_task=?,generated_issue=?,status=? WHERE id=?', [message.generated_task || (result.task ? 1 : 0), message.generated_issue || (result.issue ? 1 : 0), '已确认', message.id]); await connection.commit();
      await audit('确认消息', 'message', String(message.id), message.category, request.user, request.ipAddress); return json(response, 200, { ...message, status: '已确认' }), true;
    } catch (error) { try { await connection.rollback(); } catch (rollbackError) { console.error('消息确认回滚失败', rollbackError); } if (error.statusCode === 400) return json(response, 400, { message: error.message }), true; throw error; } finally { connection.release(); }
  }
  if (request.method === 'GET' && url.pathname === '/api/reports/weekly') {
    const allowed=await allowedProjectIds(pool,request.user), projectFilter=request.user?.role==='admin'?'': ' WHERE p.id IN (SELECT project_id FROM project_members WHERE user_id=?)', filterParams=request.user?.role==='admin'?[]:[request.user.sub];
    const [projectRows, taskRows, issueRows, documentRows] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, SUM(p.health="高风险") AS highRisk FROM projects p${projectFilter}`,filterParams),
      pool.query(`SELECT COUNT(*) AS total, SUM(t.status="已完成") AS completed, SUM(t.status="进行中") AS inProgress, SUM(t.status="已延期") AS delayedCount FROM tasks t${request.user?.role==='admin'?'':' WHERE t.project_id IN (SELECT project_id FROM project_members WHERE user_id=?)'}`,filterParams),
      pool.query(`SELECT COUNT(*) AS total, SUM(i.status<>"已关闭") AS open, SUM(i.level="高") AS highRisk FROM issues i${request.user?.role==='admin'?'':' WHERE i.project_id IN (SELECT project_id FROM project_members WHERE user_id=?)'}`,filterParams),
      pool.query(`SELECT COUNT(*) AS total, SUM(d.status IN ("已通过","已确认")) AS approved FROM documents d${request.user?.role==='admin'?'':' WHERE d.project_id IN (SELECT project_id FROM project_members WHERE user_id=?)'}`,filterParams)
    ]);
    const projects = projectRows[0][0], tasks = taskRows[0][0], issues = issueRows[0][0], documents = documentRows[0][0];
    const report = ['# 实施项目管理平台 · 项目周报', '', `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`, '', '## 一、项目总体情况', `项目总数：${projects.total}`, `高风险项目：${projects.highRisk || 0}`, '', '## 二、任务进展', `任务总数：${tasks.total}`, `已完成：${tasks.completed || 0}`, `进行中：${tasks.inProgress || 0}`, `已延期：${tasks.delayedCount || 0}`, '', '## 三、问题与风险', `问题总数：${issues.total}`, `未关闭问题：${issues.open || 0}`, `高风险问题：${issues.highRisk || 0}`, '', '## 四、交付文档', `交付文档总数：${documents.total}`, `已通过审核：${documents.approved || 0}`, `待审核/待确认：${Number(documents.total) - Number(documents.approved || 0)}`].join('\n');
    response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('项目周报.md')}` }); response.end(report); return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/dashboard') { const projects = await mysqlProjectList(pool, request.user); const [delayed] = await pool.query(request.user?.role === 'admin' ? "SELECT COUNT(DISTINCT project_id) AS total FROM tasks WHERE status='已延期'" : "SELECT COUNT(DISTINCT t.project_id) AS total FROM tasks t JOIN project_members pm ON pm.project_id=t.project_id WHERE t.status='已延期' AND pm.user_id=?", request.user?.role === 'admin' ? [] : [request.user.sub]); return json(response, 200, { total: projects.length, active: projects.filter(item => item.progress < 100).length, delayed: Number(delayed[0].total), highRisk: projects.filter(item => item.health === '高风险').length }), true; }
  if (url.pathname === '/api/knowledge' || url.pathname.startsWith('/api/knowledge/')) {
    const knowledgeMatch = url.pathname.match(/^\/api\/knowledge\/(\d+)(?:\/(submit|review|deposit))?$/);
    const can = permission => hasPermission(permission);
    if (request.method === 'GET' && url.pathname === '/api/knowledge') { if (!can('knowledge.view')) return json(response,403,{message:'无权查看知识库'}),true; const [items]=await pool.query('SELECT id,title,summary,content,category,status,source_type AS sourceType,review_comment AS reviewComment,updated_at AS updatedAt FROM knowledge_articles ORDER BY updated_at DESC'); return json(response,200,{items:items.map(item=>({...item,id:String(item.id)})),metrics:{total:items.length,published:items.filter(item=>item.status==='已发布').length,pending:items.filter(item=>item.status==='待审核').length,deposited:items.filter(item=>item.sourceType==='项目沉淀').length}}),true; }
    if (knowledgeMatch && request.method === 'GET') { if (!can('knowledge.view')) return json(response,403,{message:'无权查看知识库'}),true; const [rows]=await pool.execute('SELECT id,title,summary,content,category,status,source_type AS sourceType,review_comment AS reviewComment FROM knowledge_articles WHERE id=?',[knowledgeMatch[1]]); return rows[0]?(json(response,200,{...rows[0],id:String(rows[0].id)}),true):(json(response,404,{message:'知识不存在'}),true); }
    if (request.method === 'POST' && url.pathname === '/api/knowledge') { if (!can('knowledge.create')) return json(response,403,{message:'无权创建知识'}),true; const body=await readBody(request); if(!body.title||!body.category)return json(response,400,{message:'知识标题和分类不能为空'}),true; const status=body.publishNow&&can('knowledge.review')?'已发布':'草稿'; const [result]=await pool.execute('INSERT INTO knowledge_articles (title,summary,content,category,status,source_type,author_id,author_name) VALUES (?,?,?,?,?,?,?,?)',[body.title,body.summary||'',body.content||'',body.category,status,body.sourceType||'标准知识',request.user.sub,request.user.displayName||request.user.username||'']); return json(response,201,{id:String(result.insertId),status}),true; }
    if (knowledgeMatch && request.method === 'PUT') { if (!can('knowledge.edit')) return json(response,403,{message:'无权编辑知识'}),true; const body=await readBody(request); const [result]=await pool.execute('UPDATE knowledge_articles SET title=?,summary=?,content=?,category=? WHERE id=?',[body.title,body.summary||'',body.content||'',body.category,knowledgeMatch[1]]); return result.affectedRows?(json(response,200,{ok:true}),true):(json(response,404,{message:'知识不存在'}),true); }
    if (knowledgeMatch && knowledgeMatch[2] === 'submit' && request.method === 'POST') { if (!can('knowledge.edit')) return json(response,403,{message:'无权提交知识'}),true; await pool.execute('UPDATE knowledge_articles SET status="待审核" WHERE id=?',[knowledgeMatch[1]]); return json(response,200,{ok:true}),true; }
    if (knowledgeMatch && knowledgeMatch[2] === 'review' && request.method === 'POST') { if (!can('knowledge.review')) return json(response,403,{message:'无权审核知识'}),true; const body=await readBody(request); await pool.execute('UPDATE knowledge_articles SET status=?,review_comment=? WHERE id=?',[body.approved?'已发布':'已驳回',body.comment||null,knowledgeMatch[1]]); return json(response,200,{ok:true}),true; }
    if (knowledgeMatch && knowledgeMatch[2] === 'deposit' && request.method === 'POST') { if (!can('knowledge.create')) return json(response,403,{message:'无权沉淀知识'}),true; const body=await readBody(request); const [result]=await pool.execute('INSERT INTO knowledge_articles (title,summary,content,category,status,source_type,source_project_id,source_document_id,author_id,author_name) VALUES (?,?,?,?,?,?,?,?,?,?)',[body.title,body.summary||'',body.content||'',body.category||'项目案例','草稿','项目沉淀',body.sourceProjectId||null,body.sourceDocumentId||null,request.user.sub,request.user.displayName||request.user.username||'']); return json(response,201,{id:String(result.insertId),status:'草稿'}),true; }
    if (knowledgeMatch && request.method === 'DELETE') { if (!can('knowledge.delete')) return json(response,403,{message:'无权删除知识'}),true; await pool.execute('DELETE FROM knowledge_articles WHERE id=?',[knowledgeMatch[1]]); return json(response,200,{ok:true}),true; }
  }
  return false;
}
function serveStatic(response, relativePath) {
  const target = path.join(root, relativePath);
  if (!target.startsWith(root) || !fs.existsSync(target)) return false;
  const type = target.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
  response.writeHead(200, target.endsWith('.html') ? { 'Content-Type': type, 'Cache-Control': 'no-store, max-age=0' } : { 'Content-Type': type });
  fs.createReadStream(target).pipe(response);
  return true;
}

function serveDeliverableTemplate(response, pathname) {
  const match = pathname.match(/^\/templates\/([^/]+\.(docx|xlsx))$/);
  if (!match) return false;
  let fileName;
  try { fileName = decodeURIComponent(match[1]); } catch { return false; }
  if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) return false;
  const target = path.join(templateDirectory, fileName);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  const contentType = match[2] === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': fs.statSync(target).size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'public, max-age=300'
  });
  fs.createReadStream(target).pipe(response);
  return true;
}

const port = Number(process.env.PORT || 3030);
async function validateDatabaseSchema() {
  if (!mysqlConfigured()) throw new Error('系统业务功能需要配置 MySQL');
  const [rows] = await getPool().execute('SELECT version FROM schema_migrations WHERE version=?', ['round1-technical-audit']);
  if (!rows.length) throw new Error('数据库缺少 round1-technical-audit 迁移，请先执行 npm run db:migrate-round1');
}
async function startServer() {
  await validateDatabaseSchema();
  return http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'pis-project-delivery-center' });
    if (request.method === 'GET' && url.pathname === '/api/auth/config') {
      return json(response, 200, { passwordLogin: authReady(), dingtalkLogin: Boolean(process.env.DINGTALK_CLIENT_ID && process.env.DINGTALK_CLIENT_SECRET && process.env.DINGTALK_CORP_ID) });
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readBody(request);
      if (!body.username || !body.password) return json(response, 400, { message: '请输入账号和密码' });
      if (!authReady()) return json(response, 503, { message: '登录服务尚未配置：请完成 MySQL 与 JWT_SECRET 配置' });
      const result = await passwordLogin(String(body.username).trim(), String(body.password));
      if (!result) return json(response, 401, { message: '账号或密码错误，或账号已停用' });
      // Direct HTTP deployments cannot retain cookies marked Secure. Enable this
      // explicitly once the service is placed behind an HTTPS reverse proxy.
      const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
      response.setHeader('Set-Cookie', `pis_session=${encodeURIComponent(result.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`);
      return json(response, 200, { user: result.user });
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      response.setHeader('Set-Cookie', 'pis_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      return json(response, 200, { ok: true });
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const token = readCookie(request, 'pis_session');
      if (!token) return json(response, 401, { message: '未登录' });
      try { return json(response, 200, { user: verifyToken(token) }); } catch { return json(response, 401, { message: '登录已失效，请重新登录' }); }
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/permissions') {
      const token = readCookie(request, 'pis_session');
      try {
        const user = verifyToken(token);
        const permissions = await loadUserPermissions(getPool(), user);
        return json(response, 200, { permissions });
      } catch { return json(response, 401, { message: '请先登录' }); }
    }
    if (url.pathname.startsWith('/api/')) {
      const token = readCookie(request, 'pis_session');
      try {
        request.user = verifyToken(token);
        const forwarded = request.headers['x-forwarded-for'];
        request.ipAddress = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '')).split(',')[0].trim() || request.socket?.remoteAddress || '-';
        if (mysqlConfigured()) request.user.permissions = await loadUserPermissions(getPool(), request.user);
      } catch { return json(response, 401, { message: '请先登录后再访问系统数据' }); }
    }
    if (await serveMysqlCoreApi(request, response, url)) return;
    if (request.method === 'GET' && url.pathname === '/api/integrations/zentao/status') {
      const tasks = readTasks();
      return json(response, 200, { ...publicZentaoSettings(), total: tasks.filter(task => task.zentaoStatus).length, synced: tasks.filter(task => task.zentaoStatus === '已同步').length, failed: tasks.filter(task => task.zentaoStatus === '同步失败').length });
    }
    if (request.method === 'GET' && url.pathname === '/api/integrations/zentao/syncs') {
      return json(response, 200, readTasks().filter(task => task.zentaoStatus).map(task => ({ taskId: task.id, zentaoTaskId: task.zentaoTaskId || '', status: task.zentaoStatus, errorMessage: task.zentaoError || '', syncedAt: task.zentaoSyncedAt || '' })));
    }
    const localZentaoSyncMatch = url.pathname.match(/^\/api\/integrations\/zentao\/tasks\/([^/]+)\/sync$/);
    if (request.method === 'POST' && localZentaoSyncMatch) {
      const tasks = readTasks(), task = tasks.find(item => String(item.id) === String(localZentaoSyncMatch[1]));
      if (!task) return json(response, 404, { message: '任务不存在' });
      try {
        const synced = await createZentaoTask(task);
        Object.assign(task, { zentaoTaskId: synced.id, zentaoStatus: '已同步', zentaoError: '', zentaoSyncedAt: new Date().toLocaleString('zh-CN', { hour12: false }) });
        writeTasks(tasks);
        return json(response, 200, { taskId: task.id, zentaoTaskId: synced.id, status: '已同步' });
      } catch (error) {
        task.zentaoStatus = '同步失败'; task.zentaoError = String(error.message || '同步失败').slice(0, 500); writeTasks(tasks);
        return json(response, zentaoSettings().configured ? 502 : 400, { message: task.zentaoError });
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/projects') return json(response, 200, projectViews());
    if (request.method === 'POST' && url.pathname === '/api/projects') {
      const body = await readBody(request);
      if (!body.name || !body.customer || !body.manager || !body.plannedGoLive) return json(response, 400, { message: '请填写项目名称、客户、项目经理和计划上线日期' });
      const projects = readProjects();
      const project = { id: `project-${Date.now()}`, name: body.name, customer: body.customer, manager: body.manager, stage: '事前准备', stageClass: 'blue', progress: 0, openIssues: 0, plannedGoLive: body.plannedGoLive, health: '正常', healthClass: 'green' };
      projects.unshift(project); writeProjects(projects);
      const sop = readSop();
      if (sop && Array.isArray(sop.stages)) {
        const plans = readProjectPlans();
        plans[project.id] = { projectId: project.id, sourceTemplate: sop.name || '标准实施SOP', sourceVersion: sop.version || 'V1.0', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), stages: JSON.parse(JSON.stringify(sop.stages)) };
        writeProjectPlans(plans); project.sopApplied = true;
      } else project.sopApplied = false;
      return json(response, 201, project);
    }
    const projectPlanMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/plan$/);
    const localChecklistMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/plan\/checklist$/),localChecklistItemMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/plan\/checklist\/([^/]+)$/);
    if((localChecklistMatch||localChecklistItemMatch)&&['POST','PATCH','PUT','DELETE'].includes(request.method)){const projectId=(localChecklistMatch||localChecklistItemMatch)[1],plans=readProjectPlans(),plan=normalizeProjectPlanTracking(plans[projectId]);if(!plan)return json(response,404,{message:'项目实施计划不存在'});const body=request.method==='DELETE'?{}:await readBody(request);let task,check,index=-1;for(const stage of plan.stages||[]){for(const candidate of stage.tasks||[]){if(localChecklistMatch&&String(candidate.id)===String(body.planTaskId))task=candidate;if(localChecklistItemMatch){index=(candidate.checklist||[]).findIndex(item=>String(item.id)===String(localChecklistItemMatch[2]));if(index>=0){task=candidate;check=candidate.checklist[index];}}if(task)break;}if(task)break;}if(request.method==='POST'){if(!task||!String(body.name||'').trim())return json(response,400,{message:'请选择任务并填写检查项'});check={id:`${task.id}-check-${Date.now()}`,name:String(body.name).trim(),completed:false,completedAt:''};task.checklist.push(check);}else if(!task||(!check&&request.method!=='PATCH'))return json(response,404,{message:'检查项不存在'});else if(request.method==='PATCH'){check=(task.checklist||[]).find(item=>String(item.id)===String(body.checkId));if(!check)return json(response,404,{message:'检查项不存在'});check.completed=Boolean(body.completed);check.completedAt=check.completed?new Date().toLocaleString('zh-CN',{hour12:false}):'';}else if(request.method==='PUT')check.name=String(body.name||'').trim();else task.checklist.splice(index,1);plans[projectId]=plan;writeProjectPlans(plans);return json(response,request.method==='POST'?201:200,{plan,check});}
    if (projectPlanMatch && request.method === 'GET') { const plan = readProjectPlans()[projectPlanMatch[1]]; return plan ? json(response, 200, plan) : json(response, 404, { message: '项目尚未套用SOP模板' }); }
    if (projectPlanMatch && request.method === 'PUT') { const body=await readBody(request);if(!Array.isArray(body.stages))return json(response,400,{message:'计划阶段不能为空'});const plan=normalizeProjectPlanTracking({...body,projectId:projectPlanMatch[1],updatedAt:new Date().toLocaleString('zh-CN',{hour12:false})}),plans=readProjectPlans(),tasks=readTasks(),documents=readDocuments();plans[projectPlanMatch[1]]=plan;for(const stage of plan.stages||[])for(const task of stage.tasks||[]){tasks.filter(item=>(item.projectId===projectPlanMatch[1]||item.project===projectViews().find(project=>project.id===projectPlanMatch[1])?.name)&&(String(item.planTaskId||'')===String(task.id)||(!item.planTaskId&&item.name===task.name))).forEach(item=>Object.assign(item,{planTaskId:task.id,name:task.name,stage:stage.name,owner:task.owner||item.owner}));documents.filter(item=>(item.projectId||'1')===projectPlanMatch[1]&&String(item.planTaskId||'')===String(task.id)).forEach(item=>{item.task=task.name;});}writeProjectPlans(plans);writeTasks(tasks);writeDocuments(documents);return json(response,200,plan); }
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === 'GET') { const project = projectViews().find(item => item.id === projectMatch[1]); return project ? json(response, 200, project) : json(response, 404, { message: '项目不存在' }); }
    if (request.method === 'GET' && url.pathname === '/api/tasks') return json(response, 200, readTasks());
    if (request.method === 'POST' && url.pathname === '/api/tasks') {
      const body = await readBody(request);
      if (!body.name || !body.project || !body.owner || !body.dueDate) return json(response, 400, { message: '请填写任务、项目、负责人和计划完成日期' });
      if (!projectReferenceExists(body.project)) return json(response, 400, { message: '请选择系统中的有效项目' });
      const task = { id: `task-${Date.now()}`, name: body.name, project: body.project, stage: body.stage || '事前准备', owner: body.owner, dueDate: body.dueDate, progress: Number(body.progress || 0), progressNote: body.progressNote || '', status: taskStatus(Number(body.progress || 0), body.dueDate), updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) };
      const tasks = readTasks(); tasks.unshift(task); writeTasks(tasks); return json(response, 201, task);
    }
    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === 'PATCH') {
      const body = await readBody(request); const tasks = readTasks(); const task = tasks.find(item => item.id === taskMatch[1]);
      if (!task) return json(response, 404, { message: '任务不存在' });
      if (body.progress !== undefined) task.progress = Math.max(0, Math.min(100, Number(body.progress)));
      if (body.progressNote !== undefined) task.progressNote = String(body.progressNote).slice(0, 1000);
      task.status = taskStatus(task.progress, task.dueDate); task.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false }); writeTasks(tasks); audit('更新任务进度', 'task', task.id, `${task.progress}%`); return json(response, 200, task);
    }
    if(taskMatch&&request.method==='PUT'){const body=await readBody(request),tasks=readTasks(),task=tasks.find(item=>item.id===taskMatch[1]);if(!task)return json(response,404,{message:'任务不存在'});Object.assign(task,{name:body.name||task.name,stage:body.stage||task.stage,owner:body.owner||task.owner,dueDate:body.dueDate||task.dueDate,progress:body.progress===undefined?task.progress:Number(body.progress),progressNote:body.progressNote===undefined?task.progressNote:body.progressNote});task.status=taskStatus(task.progress,task.dueDate);writeTasks(tasks);return json(response,200,task);}
    if(taskMatch&&request.method==='DELETE'){const tasks=readTasks(),index=tasks.findIndex(item=>item.id===taskMatch[1]);if(index<0)return json(response,404,{message:'任务不存在'});tasks.splice(index,1);writeTasks(tasks);return json(response,200,{ok:true});}
    if (request.method === 'GET' && url.pathname === '/api/issues') return json(response, 200, readIssues());
    if (request.method === 'POST' && url.pathname === '/api/issues') {
      const body = await readBody(request);
      if (!body.title || !body.project || !body.owner || !body.dueDate) return json(response, 400, { message: '请填写标题、项目、责任部门和计划解决日期' });
      if (!projectReferenceExists(body.project)) return json(response, 400, { message: '请选择系统中的有效项目' });
      const issue = { id: `issue-${Date.now()}`, title: body.title, project: body.project, type: body.type || '其他问题', level: body.level || '中', owner: body.owner, dueDate: body.dueDate, status: '待处理' };
      const issues = readIssues(); issues.unshift(issue); writeIssues(issues); return json(response, 201, issue);
    }
    const issueMatch = url.pathname.match(/^\/api\/issues\/([^/]+)$/);
    if (issueMatch && request.method === 'PATCH') {
      const body = await readBody(request); const issues = readIssues(); const issue = issues.find(item => item.id === issueMatch[1]);
      if (!issue) return json(response, 404, { message: '问题不存在' });
      issue.status = body.status || issue.status; writeIssues(issues); return json(response, 200, issue);
    }

    if (request.method === 'GET' && url.pathname === '/api/sop/template') return json(response, 200, readSop() || {});
    if (request.method === 'PUT' && url.pathname === '/api/sop/template') { const body = await readBody(request); if (!body.stages) return json(response, 400, { message: 'SOP阶段不能为空' }); normalizeSopWeights(body); writeSop({ ...body, savedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }); return json(response, 200, { ok: true }); }
    if (false) {
      if (!message) return json(response, 404, { message: '消息不存在' });
      const body = await readBody(request); const result = body.structuredResult || body.result;
      if (result?.task && !message.generated?.task) {
        if (!String(result.task.name || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(result.task.dueDate || ''))) return json(response, 400, { message: '任务名称和截止日期格式不正确' });
        const tasks = readTasks(); tasks.unshift({ id: `task-${Date.now()}`, name: String(result.task.name).trim(), project: message.project, stage: result.task.stage || '未分配', owner: result.task.owner || '未分配', dueDate: result.task.dueDate, progress: Math.max(0, Math.min(100, Number(result.task.progress) || 0)), status: result.task.status || '未开始', sourceMessageId: message.id }); writeTasks(tasks); message.generated = { ...(message.generated || {}), task: true };
      }
      if (result?.issue && !message.generated?.issue) {
        if (!String(result.issue.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(result.issue.dueDate || ''))) return json(response, 400, { message: '问题标题和截止日期格式不正确' });
        const issues = readIssues(); issues.unshift({ id: `issue-${Date.now()}`, title: String(result.issue.title).trim(), project: message.project, type: result.issue.type || '其他问题', level: result.issue.level || '中', owner: result.issue.owner || '未分配', dueDate: result.issue.dueDate, status: result.issue.status || '待处理', sourceMessageId: message.id }); writeIssues(issues); message.generated = { ...(message.generated || {}), issue: true };
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/audit-logs') {
      if (!mysqlConfigured()) return json(response, 200, readAuditLogs());
      const [rows] = await getPool().query('SELECT id, action, target_type AS targetType, target_id AS targetId, detail, "系统" AS operator, DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") AS time FROM audit_logs ORDER BY id DESC LIMIT 500');
      return json(response, 200, rows.map(row => ({ ...row, id: String(row.id) })));
    }
    if (request.method === 'GET' && url.pathname === '/api/reports/weekly') {
      const projects = readProjects(), tasks = readTasks(), issues = readIssues(), documents = readDocuments();
      const text = [
        '# 实施项目管理平台 · 项目周报', '',
        `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`, '',
        '## 一、项目总体情况', `项目总数：${projects.length}`, `高风险项目：${projects.filter(item => item.health === '高风险').length}`, '',
        '## 二、任务进展', `任务总数：${tasks.length}`, `已完成：${tasks.filter(item => item.status === '已完成').length}`, `进行中：${tasks.filter(item => item.status === '进行中').length}`, `已延期：${tasks.filter(item => item.status === '已延期').length}`, '',
        '## 三、问题与风险', `问题总数：${issues.length}`, `未关闭问题：${issues.filter(item => item.status !== '已关闭').length}`, `高风险问题：${issues.filter(item => item.level === '高').length}`, '',
        '## 四、交付文档', `交付文档总数：${documents.length}`, `已通过审核：${documents.filter(item => ['已通过', '已确认'].includes(item.status)).length}`, `待审核/待确认：${documents.filter(item => !['已通过', '已确认'].includes(item.status)).length}`
      ].join('\n');
      response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="weekly-report.md"; filename*=UTF-8''${encodeURIComponent('项目周报.md')}` }); return response.end(text);
    }
    if (request.method === 'GET' && url.pathname === '/api/dashboard') {
      const projects = projectViews();
      const delayedProjects = new Set(readTasks().filter(task => task.status === '已延期').map(task => {
        const project = projects.find(item => item.name.includes(task.project) || task.project.includes(item.customer));
        return project && project.id;
      }).filter(Boolean));
      return json(response, 200, { total: projects.length, active: projects.filter(item => item.progress < 100).length, delayed: delayedProjects.size, highRisk: projects.filter(item => item.health === '高风险').length });
    }
    const documentMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/documents(?:\/([^/]+)(?:\/(review|download))?)?$/);
    if (documentMatch) {
      const [, projectId, documentId, action] = documentMatch;
      if (!projectViews().some(project => project.id === projectId)) return json(response, 404, { message: '项目不存在' });
      const documents = readDocuments();
      // Older local data did not retain a project ID; keep those sample records under project 1.
      const belongsToProject = item => (item.projectId || '1') === projectId;
      if (request.method === 'GET' && !documentId) return json(response, 200, documents.filter(belongsToProject));
      if (request.method === 'POST' && !documentId) {
        const body = await readBody(request);
        if (!body.name || !body.dataUrl) return json(response, 400, { message: '文件和文档名称不能为空' });
        if (!body.planTaskId || !body.task || !body.deliverable) return json(response, 400, { message: '请选择实施计划任务和输出物' });
        const document = { id: `doc-${Date.now()}`, projectId, name: body.name, type: body.type || '交付物', planTaskId: body.planTaskId, task: body.task, deliverable: body.deliverable, version: body.version || 'V1.0', status: '待审核', statusClass: 'orange', time: new Date().toLocaleString('zh-CN', { hour12: false }), dataUrl: body.dataUrl };
        documents.unshift(document); writeDocuments(documents); audit('上传项目交付文档', 'document', document.id, projectId); return json(response, 201, document);
      }
      const document = documents.find(item => item.id === documentId && belongsToProject(item));
      if (!document) return json(response, 404, { message: '文档不存在' });
      if(request.method==='PUT'&&!action){const body=await readBody(request);Object.assign(document,{name:body.name||document.name,type:body.type||document.type,planTaskId:body.planTaskId||document.planTaskId,task:body.task||document.task,deliverable:body.deliverable||document.deliverable,version:body.version||document.version});writeDocuments(documents);return json(response,200,document);}
      if(request.method==='DELETE'&&!action){documents.splice(documents.indexOf(document),1);writeDocuments(documents);return json(response,200,{ok:true});}
      if (request.method === 'PATCH' && action === 'review') {
        const body = await readBody(request); document.status = body.status || document.status; document.statusClass = statusClass(document.status); document.reviewer = body.reviewer || ''; document.reviewComment = body.reviewComment || ''; writeDocuments(documents); audit('更新文档审核状态', 'document', document.id, document.status); return json(response, 200, document);
      }
      if (request.method === 'GET' && action === 'download') {
        if (!document.dataUrl) return json(response, 404, { message: '此示例文档没有源文件可下载' });
        const [header, encoded] = document.dataUrl.split(','); const mime = (header.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}` }); return response.end(Buffer.from(encoded, 'base64'));
      }
    }
    if (request.method === 'GET' && serveDeliverableTemplate(response, url.pathname)) return;
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveStatic(response, 'index.html');
    json(response, 404, { message: '接口不存在' });
  } catch (error) { json(response, 500, { message: error.message || '服务器错误' }); }
  }).listen(port, () => console.log(`实施项目管理平台运行于 http://localhost:${port}`));
}
startServer().catch(error => { console.error(error.message); process.exitCode = 1; });
