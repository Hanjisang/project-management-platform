<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { messagesApi } from '../../api/messages.api';
import { projectsApi } from '../../api/projects.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import type { MessageRecord, PendingAction } from '../../types/domain';
const client = useQueryClient();
const dialog = ref(false);
const filters = reactive({ projectId: '', status: '' });
const form = reactive({ projectId: '', senderName: '', content: '' });
const projects = useQuery({
  queryKey: ['projects', 'message-selector'],
  queryFn: () => projectsApi.list({ pageSize: 100 }),
});
const query = useQuery({
  queryKey: ['messages', filters],
  queryFn: () => messagesApi.list({ ...filters, pageSize: 100 }),
});
const ai = useQuery({ queryKey: ['ai-status'], queryFn: messagesApi.aiStatus });
const create = useMutation({
  mutationFn: () => messagesApi.create({ ...form, projectId: form.projectId || undefined }),
  onSuccess: async () => {
    ElMessage.success('消息已录入');
    dialog.value = false;
    await client.invalidateQueries({ queryKey: ['messages'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
async function analyze(item: MessageRecord): Promise<void> {
  try {
    await messagesApi.analyze(item.id);
    ElMessage.success('分析已完成，请人工确认待办操作');
    await client.invalidateQueries({ queryKey: ['messages'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function decide(
  message: MessageRecord,
  action: PendingAction,
  decision: 'CONFIRM' | 'REJECT',
): Promise<void> {
  await ElMessageBox.confirm(
    decision === 'CONFIRM' ? '确认后将事务创建正式业务数据。' : '确定拒绝该待办操作？',
    decision === 'CONFIRM' ? '人工确认' : '拒绝操作',
    { type: decision === 'CONFIRM' ? 'warning' : 'info' },
  );
  try {
    await messagesApi.confirm(message.id, [{ actionId: action.id, decision }]);
    ElMessage.success(decision === 'CONFIRM' ? '已确认并幂等执行' : '已拒绝');
    await client.invalidateQueries({ queryKey: ['messages'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>
<template>
  <div>
    <PageHeader
      title="消息中心"
      description="所有来源先进入 Message，AI 只生成 PendingAction，人工确认后才写入业务数据"
      ><el-button type="primary" @click="dialog = true">人工录入</el-button></PageHeader
    ><el-alert
      v-if="ai.data.value && !ai.data.value.configured"
      title="AI 服务未配置"
      description="平台其他功能正常可用；分析接口会明确返回 AI_NOT_CONFIGURED，不会伪造结果。"
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 14px"
    />
    <div class="filters">
      <div class="filter-row">
        <el-select
          v-model="filters.projectId"
          clearable
          filterable
          placeholder="项目"
          style="width: 240px"
          ><el-option
            v-for="project in projects.data.value?.items ?? []"
            :key="project.id"
            :label="project.name"
            :value="project.id" /></el-select
        ><el-select v-model="filters.status" clearable placeholder="状态" style="width: 180px"
          ><el-option
            v-for="item in [
              'RECEIVED',
              'ANALYZED',
              'PENDING_CONFIRMATION',
              'CONFIRMED',
              'IGNORED',
              'FAILED',
            ]"
            :key="item"
            :label="item"
            :value="item"
        /></el-select>
      </div>
    </div>
    <div style="display: grid; gap: 12px">
      <article v-for="item in query.data.value?.items ?? []" :key="item.id" class="panel">
        <div class="panel-header">
          <div>
            <strong>{{ item.senderName }}</strong
            ><span class="muted">
              · {{ item.project?.name ?? '未归属' }} ·
              {{ new Date(item.receivedAt).toLocaleString('zh-CN') }}</span
            >
          </div>
          <StatusTag :value="item.status" />
        </div>
        <div class="panel-body">
          <p style="white-space: pre-wrap; line-height: 1.7">{{ item.content }}</p>
          <div class="toolbar-actions">
            <el-button
              v-if="['RECEIVED', 'FAILED'].includes(item.status)"
              type="primary"
              plain
              :disabled="!ai.data.value?.configured"
              @click="analyze(item)"
              >AI 结构化分析</el-button
            >
          </div>
          <div v-if="item.pendingActions.length" style="margin-top: 14px">
            <h4>待确认操作</h4>
            <div
              v-for="action in item.pendingActions"
              :key="action.id"
              style="
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 0;
                border-top: 1px solid var(--border);
              "
            >
              <div>
                <StatusTag :value="action.status" /> <strong>{{ action.type }}</strong>
                <div class="muted" style="margin-top: 5px; font-size: 12px">
                  {{ JSON.stringify(action.payload) }}
                </div>
              </div>
              <div v-if="action.status === 'PENDING'" class="toolbar-actions">
                <el-button type="success" size="small" @click="decide(item, action, 'CONFIRM')"
                  >确认</el-button
                ><el-button size="small" @click="decide(item, action, 'REJECT')">拒绝</el-button>
              </div>
            </div>
          </div>
        </div>
      </article>
      <el-empty v-if="!query.data.value?.items.length" description="暂无消息" />
    </div>
    <el-dialog v-model="dialog" title="人工录入项目消息" width="min(620px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="所属项目"
          ><el-select v-model="form.projectId" clearable filterable style="width: 100%"
            ><el-option
              v-for="project in projects.data.value?.items ?? []"
              :key="project.id"
              :label="project.name"
              :value="project.id" /></el-select></el-form-item
        ><el-form-item label="发送人" required
          ><el-input v-model.trim="form.senderName" /></el-form-item
        ><el-form-item label="消息内容" required
          ><el-input v-model="form.content" type="textarea" :rows="7" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!form.senderName || !form.content"
          :loading="create.isPending.value"
          @click="create.mutate()"
          >录入消息</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
