<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { tasksApi } from '../../api/tasks.api';
import { projectsApi } from '../../api/projects.api';
import { documentsApi } from '../../api/documents.api';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import StatusTag from '../../components/StatusTag.vue';
import type { DocumentRecord, ProjectDeliverable } from '../../types/domain';

const props = defineProps<{ modelValue: boolean; taskId: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const auth = useAuthStore();
const client = useQueryClient();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
const detail = useQuery({
  queryKey: computed(() => ['task-detail', props.taskId]),
  queryFn: () => tasksApi.get(props.taskId),
  enabled: computed(() => visible.value && Boolean(props.taskId)),
});
const context = computed(() => detail.data.value);
const requiredChecklist = computed(
  () => context.value?.checklistItems.filter((item) => item.required) ?? [],
);
const checklistDone = computed(
  () => requiredChecklist.value.filter((item) => item.completed).length,
);
const selectedDeliverable = ref<ProjectDeliverable>();
const selectedDocumentId = ref('');
const uploadDialog = ref(false);
const file = ref<File>();
const version = ref('V1.0');

function sourceLabel(value: string): string {
  return {
    SOP: 'SOP 任务',
    MANUAL: '人工任务',
    MESSAGE: '消息任务',
    ISSUE: '问题任务',
    ZENTAO: '禅道任务',
    CHANGE: '变更新增',
  }[value] ?? value;
}
function sourceTagType(value: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return (
    {
      SOP: 'primary',
      MESSAGE: 'success',
      ISSUE: 'danger',
      ZENTAO: 'info',
      CHANGE: 'warning',
      MANUAL: 'info',
    }[value] ?? 'info'
  ) as 'primary' | 'success' | 'warning' | 'info' | 'danger';
}

async function refresh(): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['task-detail', props.taskId] }),
    client.invalidateQueries({ queryKey: ['tasks'] }),
    client.invalidateQueries({ queryKey: ['project-plan'] }),
    client.invalidateQueries({ queryKey: ['project-execution'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}
async function toggleChecklist(id: string, completed: unknown): Promise<void> {
  try {
    await projectsApi.completeChecklist(id, Boolean(completed));
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
function nextVersion(document?: DocumentRecord): string {
  const latest = document?.versions
    .map((item) => /^V?(\d+)\.(\d+)$/.exec(item.version))
    .filter((item): item is RegExpExecArray => Boolean(item))
    .sort((a, b) => Number(b[1]) - Number(a[1]) || Number(b[2]) - Number(a[2]))[0];
  return latest ? `V${latest[1]}.${Number(latest[2]) + 1}` : 'V1.0';
}
function openUpload(deliverable: ProjectDeliverable): void {
  selectedDeliverable.value = deliverable;
  selectedDocumentId.value = deliverable.documents[0]?.id ?? '';
  version.value = nextVersion(deliverable.documents[0]);
  file.value = undefined;
  uploadDialog.value = true;
}
async function upload(): Promise<void> {
  if (!selectedDeliverable.value || !file.value) return;
  const data = new FormData();
  data.set('file', file.value);
  data.set('version', version.value);
  if (selectedDocumentId.value) await documentsApi.addVersion(selectedDocumentId.value, data);
  else {
    data.set('name', selectedDeliverable.value.name);
    data.set('description', selectedDeliverable.value.description ?? '');
    await documentsApi.uploadForDeliverable(selectedDeliverable.value.id, data);
  }
  uploadDialog.value = false;
  ElMessage.success('交付物已上传');
  await refresh();
}
async function submit(id: string): Promise<void> {
  await documentsApi.submit(id);
  ElMessage.success('已提交人工审核');
  await refresh();
}
async function review(id: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
  let comment = '';
  if (status === 'REJECTED') {
    const response = await ElMessageBox.prompt('请输入驳回原因', '驳回交付物', {
      inputValidator: (value) => Boolean(value) || '请输入原因',
    });
    comment = response.value;
  }
  await documentsApi.review(id, status, comment);
  ElMessage.success(status === 'APPROVED' ? '审核已通过' : '已驳回');
  await refresh();
}
async function completeTask(): Promise<void> {
  try {
    await tasksApi.complete(props.taskId);
    ElMessage.success('任务已完成');
    await refresh();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'WORK_ITEM_COMPLETION_BLOCKED') {
      const details = error.details as {
        checklist?: Array<{ name: string }>;
        deliverables?: Array<{ name: string; status: string }>;
      };
      const lines = [
        ...(details.checklist ?? []).map((item) => `检查项：${item.name}`),
        ...(details.deliverables ?? []).map((item) => `交付物：${item.name}（${item.status}）`),
      ];
      await ElMessageBox.alert(lines.join('\n'), '任务尚不能完成', { type: 'warning' });
      return;
    }
    ElMessage.error((error as Error).message);
  }
}
</script>

<template>
  <el-drawer v-model="visible" title="任务详情" size="min(760px, 96vw)">
    <el-skeleton v-if="detail.isLoading.value" :rows="8" animated />
    <el-result v-else-if="detail.isError.value" icon="error" title="任务加载失败" />
    <template v-else-if="detail.data.value">
      <div class="task-head">
        <div>
          <el-tag :type="sourceTagType(String(detail.data.value.sourceType))">
            {{ sourceLabel(String(detail.data.value.sourceType)) }}
          </el-tag>
          <h2>{{ detail.data.value.name }}</h2>
          <p class="muted">
            {{ detail.data.value.project.name }} · {{ detail.data.value.stage?.name ?? '-' }} ·
            {{ detail.data.value.owner?.displayName ?? '未分配' }}
          </p>
        </div>
        <StatusTag :value="detail.data.value.status" />
      </div>
      <el-progress :percentage="detail.data.value.progress" />
      <template v-if="context">
        <section class="execution-section">
          <div class="section-title">
            <strong>执行检查项</strong>
            <span>{{ checklistDone }} / {{ requiredChecklist.length }}</span>
          </div>
          <el-checkbox
            v-for="item in context.checklistItems"
            :key="item.id"
            :model-value="item.completed"
            :disabled="!(auth.has(PERMISSIONS.TASK_EDIT) || auth.has(PERMISSIONS.PLAN_EDIT))"
            @change="toggleChecklist(item.id, $event)"
            >{{ item.name }} <span v-if="item.required" class="danger-text">*</span></el-checkbox
          >
          <el-empty v-if="!context.checklistItems.length" description="无检查项" :image-size="64" />
        </section>
        <section class="execution-section">
          <div class="section-title">
            <strong>应交付资料</strong><span>{{ context.deliverables.length }} 项</span>
          </div>
          <article
            v-for="deliverable in context.deliverables"
            :key="deliverable.id"
            class="deliverable-card"
          >
            <div class="section-title">
              <div>
                <strong>{{ deliverable.name }}</strong>
                <el-tag size="small" :type="deliverable.required ? 'danger' : 'info'">{{
                  deliverable.required ? '必交' : '可选'
                }}</el-tag>
              </div>
              <StatusTag :value="deliverable.effectiveStatus" />
            </div>
            <p v-if="deliverable.description" class="muted">{{ deliverable.description }}</p>
            <div v-if="deliverable.templates.length" class="links">
              标准模板：
              <a
                v-for="template in deliverable.templates"
                :key="template.id"
                :href="projectsApi.deliverableTemplateDownloadUrl(template.id)"
                >{{ template.fileName }}</a
              >
            </div>
            <div v-if="deliverable.documents[0]" class="links">
              已上传：
              <a
                v-if="deliverable.documents[0].versions[0]"
                :href="documentsApi.downloadUrl(deliverable.documents[0].versions[0].id)"
                >{{ deliverable.documents[0].versions[0].fileName }}</a
              >
            </div>
            <div v-if="deliverable.documents[0]?.versions[0]?.reviews.length" class="review-history">
              <div
                v-for="reviewItem in deliverable.documents[0].versions[0].reviews"
                :key="reviewItem.id"
                class="review-card"
              >
                <div class="section-title">
                  <strong>{{ reviewItem.reviewType === 'AI' ? '历史 AI 审核' : '人工审核' }}</strong>
                  <StatusTag :value="reviewItem.status" />
                </div>
                <p v-if="reviewItem.score !== undefined" class="muted">评分：{{ reviewItem.score }}</p>
                <p v-if="reviewItem.summary">{{ reviewItem.summary }}</p>
                <ul v-if="reviewItem.findings.length">
                  <li v-for="finding in reviewItem.findings" :key="finding.id">
                    <strong>{{ finding.title }}</strong>：{{ finding.description }}
                    <span v-if="finding.suggestion" class="muted">（建议：{{ finding.suggestion }}）</span>
                  </li>
                </ul>
              </div>
            </div>
            <div class="actions">
              <el-button
                v-if="auth.has(PERMISSIONS.DOCUMENT_UPLOAD)"
                size="small"
                @click="openUpload(deliverable)"
                >{{ deliverable.documents[0] ? '上传新版本' : '上传' }}</el-button
              >
              <el-button
                v-if="
                  deliverable.documents[0] &&
                  ['DRAFT', 'REJECTED'].includes(deliverable.documents[0].status) &&
                  auth.has(PERMISSIONS.DOCUMENT_UPLOAD)
                "
                size="small"
                type="primary"
                @click="submit(deliverable.documents[0].id)"
                >提交人工审核</el-button
              >
              <template
                v-if="
                  deliverable.documents[0]?.status === 'PENDING_REVIEW' &&
                  auth.has(PERMISSIONS.DOCUMENT_REVIEW)
                "
              >
                <el-button size="small" type="success" @click="review(deliverable.documents[0].id, 'APPROVED')">通过</el-button>
                <el-button size="small" type="danger" @click="review(deliverable.documents[0].id, 'REJECTED')">驳回</el-button>
              </template>
            </div>
          </article>
          <el-empty v-if="!context.deliverables.length" description="无交付物要求" :image-size="64" />
        </section>
      </template>
      <div class="drawer-footer">
        <el-button
          v-if="auth.has(PERMISSIONS.TASK_COMPLETE) && !['DONE', 'CANCELLED'].includes(detail.data.value.status)"
          type="success"
          @click="completeTask"
          >完成任务</el-button
        >
      </div>
    </template>
  </el-drawer>
  <el-dialog v-model="uploadDialog" title="上传交付物" width="min(520px, 94vw)" append-to-body>
    <el-form label-position="top">
      <el-form-item label="版本号"><el-input v-model.trim="version" /></el-form-item>
      <el-form-item label="文件">
        <el-upload :auto-upload="false" :limit="1" :on-change="(item: { raw?: File }) => (file = item.raw)">
          <el-button>选择文件</el-button>
        </el-upload>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="uploadDialog = false">取消</el-button>
      <el-button type="primary" :disabled="!file || !version" @click="upload">上传</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.task-head,
.section-title,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.task-head h2 { margin: 8px 0; }
.execution-section { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--el-border-color-lighter); }
.execution-section > .el-checkbox { display: flex; margin: 10px 0; }
.deliverable-card { margin-top: 12px; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.review-history { margin-top: 12px; }
.review-card { padding: 10px; margin-top: 8px; border-radius: 6px; background: var(--el-fill-color-light); }
.links { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.actions { justify-content: flex-start; margin-top: 12px; }
.drawer-footer { margin-top: 24px; text-align: right; }
.muted { color: var(--el-text-color-secondary); }
.danger-text { color: var(--el-color-danger); }
</style>