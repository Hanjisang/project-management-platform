const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function apiPermissionForRequest(method, pathname) {
  if (!WRITE_METHODS.has(method)) return null;
  if (pathname === '/api/projects' && method === 'POST') return 'project.create';
  if (/^\/api\/projects\/\d+$/.test(pathname)) return method === 'DELETE' ? 'project.delete' : 'project.edit';
  if (/^\/api\/projects\/\d+\/members$/.test(pathname)) return 'project.members';
  if (/^\/api\/projects\/\d+\/(?:start|pause|close)$/.test(pathname)) return 'project.lifecycle';
  if (/^\/api\/projects\/\d+\/(?:schedule|operations)$/.test(pathname)) return 'project.edit';
  if (/^\/api\/projects\/\d+\/plan(?:\/|$)/.test(pathname)) return 'plan.edit';
  if (pathname === '/api/tasks' && method === 'POST') return 'task.create';
  if (/^\/api\/tasks\/\d+$/.test(pathname)) return method === 'DELETE' ? 'task.delete' : method === 'PATCH' ? 'task.update' : 'task.edit';
  if (pathname === '/api/issues' && method === 'POST') return 'issue.create';
  if (/^\/api\/issues\/\d+$/.test(pathname)) return method === 'DELETE' ? 'issue.delete' : method === 'PATCH' ? 'issue.update' : 'issue.edit';
  const documentMatch = pathname.match(/^\/api\/projects\/\d+\/documents(?:\/\d+(?:\/(review|download))?)?$/);
  if (documentMatch) return documentMatch[1] === 'review' ? 'document.review' : method === 'POST' ? 'document.create' : method === 'DELETE' ? 'document.delete' : 'document.edit';
  if (pathname === '/api/daily-reports') return 'daily.create';
  if (pathname === '/api/report-templates' || /^\/api\/report-templates\/\d+$/.test(pathname)) return 'report.template';
  if (pathname === '/api/sop/template' || /^\/api\/sop\/templates(?:\/\d+)?$/.test(pathname)) return method === 'DELETE' ? 'sop.delete' : method === 'POST' ? 'sop.create' : 'sop.edit';
  if (/^\/api\/integrations\/zentao\/tasks\/\d+\/sync$/.test(pathname)) return 'integration.sync';
  if (/^\/api\/messages\/(?:manual|daily-card|robot)$/.test(pathname)) return 'message.create';
  if (/^\/api\/messages\/\d+\/confirm$/.test(pathname)) return 'message.confirm';
  return null;
}

function sameOriginWriteAllowed(request) {
  if (!WRITE_METHODS.has(request.method)) return true;
  if (String(request.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false;
  const origin = String(request.headers.origin || '');
  if (!origin) return true;
  try { return new URL(origin).host === String(request.headers.host || ''); } catch { return false; }
}

class LoginThrottle {
  constructor({ maxAttempts = 5, windowMs = 15 * 60 * 1000, blockMs = 15 * 60 * 1000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.blockMs = blockMs;
    this.failures = new Map();
  }
  blocked(key, now = Date.now()) {
    const item = this.failures.get(key);
    if (!item) return false;
    if (item.blockedUntil > now) return true;
    if (item.lastAttempt + this.windowMs < now) this.failures.delete(key);
    return false;
  }
  fail(key, now = Date.now()) {
    const previous = this.failures.get(key);
    const attempts = previous && previous.lastAttempt + this.windowMs >= now ? previous.attempts + 1 : 1;
    this.failures.set(key, { attempts, lastAttempt: now, blockedUntil: attempts >= this.maxAttempts ? now + this.blockMs : 0 });
  }
  clear(key) { this.failures.delete(key); }
}

module.exports = { apiPermissionForRequest, sameOriginWriteAllowed, LoginThrottle };
