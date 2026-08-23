import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { AuthUser } from '@pmp/shared-types';
import { authApi } from '../api/auth.api';
import { initializeCsrf } from '../api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const authenticated = computed(() => Boolean(user.value));
  const has = (permission?: string) =>
    !permission ||
    Boolean(user.value?.isAdministrator || user.value?.permissions.includes(permission));
  async function load(): Promise<void> {
    try {
      await initializeCsrf();
      user.value = await authApi.me();
    } catch {
      user.value = null;
    } finally {
      initialized.value = true;
    }
  }
  async function login(username: string, password: string): Promise<void> {
    user.value = await authApi.login({ username, password });
    initialized.value = true;
  }
  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
    }
  }
  window.addEventListener('auth:expired', () => {
    user.value = null;
  });
  return { user, initialized, authenticated, has, load, login, logout };
});
