const TASK_STATUSES = ['未开始', '进行中', '已延期', '已完成'];
const ISSUE_TYPES = ['客户需求', '产品缺陷', '代码缺陷', '接口缺陷', '项目风险', '配置问题'];
const ISSUE_LEVELS = ['高', '中', '低'];
const ISSUE_STATUSES = ['待处理', '处理中', '待验证', '阻塞', '已关闭'];

function invalid(message) { const error = new Error(message); error.statusCode = 400; throw error; }
function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${label}必须是有效的YYYY-MM-DD日期`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(`${label}必须是有效的YYYY-MM-DD日期`);
  return value;
}
function text(value, label) { if (typeof value !== 'string' || !value.trim()) invalid(`${label}不能为空`); return value.trim(); }
function optionalText(value, label) { return value === undefined || value === null ? undefined : text(value, label); }

function validateStructuredMessageResult(result) {
  if (!result) return { task: null, issue: null };
  const normalized = { task: null, issue: null };
  if (result.task) {
    const task = result.task;
    const progress = task.progress === undefined ? 0 : Number(task.progress);
    if (!Number.isFinite(progress)) invalid('任务进度必须是数字');
    if (!TASK_STATUSES.includes(task.status || '未开始')) invalid('任务状态不合法');
    normalized.task = { ...task, name: text(task.name, '任务名称'), dueDate: date(task.dueDate, '任务截止日期'), progress: Math.max(0, Math.min(100, progress)), status: task.status || '未开始', stage: optionalText(task.stage, '任务阶段'), owner: optionalText(task.owner, '任务负责人') };
  }
  if (result.issue) {
    const issue = result.issue;
    if (!ISSUE_TYPES.includes(issue.type)) invalid('问题类型不合法');
    if (!ISSUE_LEVELS.includes(issue.level)) invalid('问题等级不合法');
    if (!ISSUE_STATUSES.includes(issue.status || '待处理')) invalid('问题状态不合法');
    normalized.issue = { ...issue, title: text(issue.title, '问题标题'), dueDate: date(issue.dueDate, '问题截止日期'), status: issue.status || '待处理', owner: optionalText(issue.owner, '问题负责人') };
  }
  return normalized;
}
module.exports = { validateStructuredMessageResult, TASK_STATUSES, ISSUE_TYPES, ISSUE_LEVELS, ISSUE_STATUSES };
