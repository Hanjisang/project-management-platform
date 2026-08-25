<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '../stores/auth';
import { notificationsApi } from '../api/notifications.api';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  DataAnalysis,
  Bell,
  Document,
  FolderOpened,
  House,
  Management,
  Menu,
  Message,
  Notebook,
  Opportunity,
  Setting,
  Tickets,
  User,
  UserFilled,
  Warning,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const queryClient = useQueryClient();
const notifications = useQuery({
  queryKey: ['notifications'],
  queryFn: notificationsApi.list,
  refetchInterval: 60_000,
});
const markRead = useMutation({
  mutationFn: notificationsApi.read,
  onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
});
const mobileOpen = ref(false);
const collapsed = ref(false);
const items = [
  { path: '/dashboard', label: '工作台', icon: House, permission: PERMISSIONS.PROJECT_VIEW },
  {
    path: '/projects',
    label: '项目管理',
    icon: FolderOpened,
    permission: PERMISSIONS.PROJECT_VIEW,
  },
  { path: '/plans', label: '实施计划', icon: Management, permission: PERMISSIONS.PLAN_VIEW },
  { path: '/tasks', label: '任务中心', icon: Tickets, permission: PERMISSIONS.TASK_VIEW },
  { path: '/issues', label: '问题与风险', icon: Warning, permission: PERMISSIONS.ISSUE_VIEW },
  { path: '/documents', label: '交付文档', icon: Document, permission: PERMISSIONS.DOCUMENT_VIEW },
  { path: '/messages', label: '消息中心', icon: Message, permission: PERMISSIONS.MESSAGE_VIEW },
  { path: '/reports', label: '日报周报', icon: DataAnalysis, permission: PERMISSIONS.REPORT_VIEW },
  { path: '/sop', label: 'SOP 管理', icon: Notebook, permission: PERMISSIONS.SOP_VIEW },
  {
    path: '/knowledge',
    label: '知识库',
    icon: Opportunity,
    permission: PERMISSIONS.KNOWLEDGE_VIEW,
  },
];
const systemItems = [
  { path: '/system/users', label: '用户', icon: User, permission: PERMISSIONS.USER_MANAGE },
  {
    path: '/system/roles',
    label: '角色权限',
    icon: UserFilled,
    permission: PERMISSIONS.ROLE_MANAGE,
  },
  {
    path: '/system/integrations',
    label: '集成配置',
    icon: Setting,
    permission: PERMISSIONS.INTEGRATION_MANAGE,
  },
  {
    path: '/system/audit',
    label: '审计日志',
    icon: DataAnalysis,
    permission: PERMISSIONS.AUDIT_VIEW,
  },
];
const visibleItems = computed(() => items.filter((item) => auth.has(item.permission)));
const visibleSystemItems = computed(() => systemItems.filter((item) => auth.has(item.permission)));
async function navigate(path: string): Promise<void> {
  mobileOpen.value = false;
  await router.push(path);
}
async function logout(): Promise<void> {
  await ElMessageBox.confirm('确定退出当前账号？', '退出登录', { type: 'warning' });
  await auth.logout();
  await router.replace('/login');
}
async function openNotification(item: { id: string; projectId?: string | null }): Promise<void> {
  await markRead.mutateAsync(item.id);
  if (item.projectId) await router.push(`/projects/${item.projectId}?tab=changes`);
}
watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    document.getElementById('main-content')?.focus();
  },
  { immediate: true },
);
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <aside class="sidebar" :class="{ collapsed }">
      <div class="brand">
        <span class="brand-mark">P</span
        ><span v-if="!collapsed" class="brand-copy"
          ><strong>实施管理平台</strong><small>Production V2</small></span
        >
      </div>
      <nav aria-label="主导航">
        <button
          v-for="item in visibleItems"
          :key="item.path"
          class="nav-item"
          :class="{
            active:
              route.path === item.path ||
              (item.path === '/projects' && route.path.startsWith('/projects/')),
          }"
          :aria-label="item.label"
          @click="navigate(item.path)"
        >
          <el-icon><component :is="item.icon" /></el-icon
          ><span v-if="!collapsed">{{ item.label }}</span>
        </button>
        <div v-if="visibleSystemItems.length" class="nav-section">
          <span v-if="!collapsed">系统管理</span>
        </div>
        <button
          v-for="item in visibleSystemItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          :aria-label="item.label"
          @click="navigate(item.path)"
        >
          <el-icon><component :is="item.icon" /></el-icon
          ><span v-if="!collapsed">{{ item.label }}</span>
        </button>
      </nav>
      <button
        class="collapse-button"
        :aria-label="collapsed ? '展开导航' : '收起导航'"
        @click="collapsed = !collapsed"
      >
        <el-icon><Menu /></el-icon><span v-if="!collapsed">收起导航</span>
      </button>
    </aside>
    <el-drawer
      v-model="mobileOpen"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="mobile-drawer"
      ><div class="mobile-nav">
        <div class="brand">
          <span class="brand-mark">P</span
          ><span class="brand-copy"><strong>实施管理平台</strong><small>Production V2</small></span>
        </div>
        <button
          v-for="item in [...visibleItems, ...visibleSystemItems]"
          :key="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          @click="navigate(item.path)"
        >
          <el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span>
        </button>
      </div></el-drawer
    >
    <div class="app-main">
      <header class="topbar">
        <button class="mobile-menu" aria-label="打开导航" @click="mobileOpen = true">
          <el-icon><Menu /></el-icon>
        </button>
        <div>
          <div class="page-eyebrow">医疗信息化实施中心</div>
          <h1>{{ route.meta.title }}</h1>
        </div>
        <div class="topbar-actions">
          <el-dropdown trigger="click" placement="bottom-end">
            <el-badge
              :value="notifications.data.value?.unread ?? 0"
              :hidden="!(notifications.data.value?.unread ?? 0)"
            >
              <button class="icon-button" aria-label="通知">
                <el-icon><Bell /></el-icon>
              </button>
            </el-badge>
            <template #dropdown>
              <el-dropdown-menu class="notification-menu">
                <el-dropdown-item
                  v-for="item in notifications.data.value?.items ?? []"
                  :key="item.id"
                  :class="{ 'notification-unread': !item.readAt }"
                  @click="openNotification(item)"
                >
                  <span class="notification-entry"
                    ><strong>{{ item.title }}</strong
                    ><small>{{ item.content }}</small></span
                  >
                </el-dropdown-item>
                <el-dropdown-item v-if="!notifications.data.value?.items.length" disabled
                  >暂无通知</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click"
            ><button class="user-button">
              <span class="user-avatar">{{ auth.user?.displayName.slice(0, 1) }}</span
              ><span>{{ auth.user?.displayName }}</span></button
            ><template #dropdown
              ><el-dropdown-menu
                ><el-dropdown-item disabled>{{ auth.user?.username }}</el-dropdown-item
                ><el-dropdown-item divided @click="logout"
                  >退出登录</el-dropdown-item
                ></el-dropdown-menu
              ></template
            ></el-dropdown
          >
        </div>
      </header>
      <main id="main-content" class="page-content" tabindex="-1"><router-view /></main>
    </div>
  </div>
</template>
