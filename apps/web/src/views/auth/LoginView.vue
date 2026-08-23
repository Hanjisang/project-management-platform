<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../stores/auth';
import { ApiError } from '../../api/client';
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(false);
const form = reactive({ username: '', password: '' });
async function submit(): Promise<void> {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  loading.value = true;
  try {
    await auth.login(form.username.trim(), form.password);
    await router.replace(
      typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard',
    );
  } catch (error) {
    ElMessage.error(error instanceof ApiError ? error.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="login-page">
    <section class="login-panel">
      <div class="brand">
        <span class="brand-mark">P</span
        ><span class="brand-copy"
          ><strong>实施项目管理平台</strong><small>Production V2</small></span
        >
      </div>
      <h1>欢迎回到实施中心</h1>
      <p>使用平台账号登录，统一管理项目、SOP、任务、风险与交付。</p>
      <el-form label-position="top" @submit.prevent="submit"
        ><el-form-item label="账号"
          ><el-input
            v-model.trim="form.username"
            autocomplete="username"
            size="large"
            placeholder="请输入账号"
            @keyup.enter="submit" /></el-form-item
        ><el-form-item label="密码"
          ><el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
            size="large"
            placeholder="请输入密码"
            @keyup.enter="submit" /></el-form-item
        ><el-button
          type="primary"
          size="large"
          :loading="loading"
          style="width: 100%"
          @click="submit"
          >登录</el-button
        ></el-form
      >
    </section>
    <section class="login-visual">
      <h2>让每一个实施节点<br />都有依据、有进度、有闭环</h2>
      <p>面向医疗信息化实施团队的模块化项目管理平台，从标准 SOP 到项目交付和知识沉淀。</p>
    </section>
  </div>
</template>
