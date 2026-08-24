import { createRouter, createWebHistory } from 'vue-router';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    permission?: string;
    public?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('../views/dashboard/DashboardView.vue'),
          meta: { title: '工作台', permission: PERMISSIONS.PROJECT_VIEW },
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('../views/projects/ProjectsView.vue'),
          meta: { title: '项目管理', permission: PERMISSIONS.PROJECT_VIEW },
        },
        {
          path: 'projects/:id',
          name: 'project-detail',
          component: () => import('../views/projects/ProjectDetailView.vue'),
          meta: { title: '项目详情', permission: PERMISSIONS.PROJECT_VIEW },
          beforeEnter: (to) =>
            typeof to.query.tab === 'string'
              ? true
              : { path: to.path, query: { ...to.query, tab: 'execution' }, replace: true },
        },
        {
          path: 'plans',
          name: 'plans',
          component: () => import('../views/plans/PlansView.vue'),
          meta: { title: '实施计划', permission: PERMISSIONS.PLAN_VIEW },
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('../views/tasks/TasksView.vue'),
          meta: { title: '任务中心', permission: PERMISSIONS.TASK_VIEW },
        },
        {
          path: 'issues',
          name: 'issues',
          component: () => import('../views/issues/IssuesView.vue'),
          meta: { title: '问题与风险', permission: PERMISSIONS.ISSUE_VIEW },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('../views/documents/DocumentsView.vue'),
          meta: { title: '交付文档', permission: PERMISSIONS.DOCUMENT_VIEW },
        },
        {
          path: 'messages',
          name: 'messages',
          component: () => import('../views/messages/MessagesView.vue'),
          meta: { title: '消息中心', permission: PERMISSIONS.MESSAGE_VIEW },
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('../views/reports/ReportsView.vue'),
          meta: { title: '日报周报', permission: PERMISSIONS.REPORT_VIEW },
        },
        {
          path: 'sop',
          name: 'sop',
          component: () => import('../views/sop/SopView.vue'),
          meta: { title: 'SOP 管理', permission: PERMISSIONS.SOP_VIEW },
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('../views/knowledge/KnowledgeView.vue'),
          meta: { title: '知识库', permission: PERMISSIONS.KNOWLEDGE_VIEW },
        },
        {
          path: 'system/users',
          name: 'users',
          component: () => import('../views/system/UsersView.vue'),
          meta: { title: '用户管理', permission: PERMISSIONS.USER_MANAGE },
        },
        {
          path: 'system/roles',
          name: 'roles',
          component: () => import('../views/system/RolesView.vue'),
          meta: { title: '角色权限', permission: PERMISSIONS.ROLE_MANAGE },
        },
        {
          path: 'system/integrations',
          name: 'integrations',
          component: () => import('../views/system/IntegrationsView.vue'),
          meta: { title: '集成配置', permission: PERMISSIONS.INTEGRATION_MANAGE },
        },
        {
          path: 'system/audit',
          name: 'audit',
          component: () => import('../views/system/AuditView.vue'),
          meta: { title: '审计日志', permission: PERMISSIONS.AUDIT_VIEW },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) await auth.load();
  if (to.meta.public) return auth.authenticated ? '/dashboard' : true;
  if (!auth.authenticated) return { path: '/login', query: { redirect: to.fullPath } };
  if (!auth.has(to.meta.permission)) return '/dashboard';
  return true;
});
router.afterEach((to) => {
  document.title = `${to.meta.title ?? '工作台'} · 实施项目管理平台`;
});
export default router;
