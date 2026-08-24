<script setup lang="ts">
import { computed, reactive, ref, toRef } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { projectsApi } from '../../api/projects.api';
import { sopApi } from '../../api/sop.api';
import { documentsApi } from '../../api/documents.api';
import { useAuthStore } from '../../stores/auth';
import { ApiError } from '../../api/client';
import { projectQueryKey } from '../../composables/project-query';
import StatusTag from '../../components/StatusTag.vue';
import TaskExecutionDrawer from '../tasks/TaskExecutionDrawer.vue';
import type {
  DocumentRecord,
  ProjectDeliverable,
  ProjectWorkItem,
  UserRef,
} from '../../types/domain';

const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const selectedVersion = ref('');
const syncDialog = ref(false);
const drawer = ref(false);
const selectedTaskId = ref('');
const uploadDialog = ref(false);
const selectedDeliverable = ref<ProjectDeliverable>();
const selectedDocumentId = ref('');
const documentName = ref('');
const uploadVersion = ref('V1.0');
const uploadFile = ref<File>();
const editTaskDialog = ref(false);
const editingTaskId = ref('');
const memberOptions = ref<UserRef[]>([]);
const editTaskForm = reactive({ ownerUserId: '', plannedStartDate: '', plannedEndDate: '' });
const preview = ref<{
  diff: Array<{ operation: string; entity: string; path: string }>;
  diffHash: string;
} | null>(null);

const plan = useQuery({
  queryKey: projectQueryKey('project-plan', projectId),
  queryFn: () => projectsApi.plan(projectId.value),
  retry: false,
});
const planMissing = computed(
  () => plan.error.value instanceof ApiError && plan.error.value.code === 'PROJECT_PLAN_NOT_FOUND',
);
const templates = useQuery({ queryKey: ['sop-templates'], queryFn: sopApi.list });
const generate = useMutation({
  mutationFn: () => projectsApi.generatePlan(projectId.value, selectedVersion.value),
  onSuccess: async () => {
    ElMessage.success('实施计划已生成');
    await refreshExecutionData();
  },
  onError: (error: Error) => ElMessage.error(error.message),
});

async function refreshExecutionData(): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['project-plan', projectId.value] }),
    client.invalidateQueries({ queryKey: ['project-execution', projectId.value] }),
    client.invalidateQueries({ queryKey: ['project', projectId.value] }),
    client.invalidateQueries({ queryKey: ['tasks'] }),
    client.invalidateQueries({ queryKey: ['task-detail'] }),
    client.invalidateQueries({ queryKey: ['documents'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}
async function showSync(): Promise<void> {
  if (!selectedVersion.value) return;
  try {
    preview.value = (await projectsApi.syncPreview(
      projectId.value,
      selectedVersion.value,
    )) as typeof preview.value;
    syncDialog.value = true;
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function applySync(): Promise<void> {
  if (!preview.value) return;
  await ElMessageBox.confirm(
    '直接同步仅适用于未启动、无人工/变更任务且没有执行记录的项目。存在自定义执行数据时系统会拒绝同步，避免数据丢失。确定继续？',
    '确认 SOP 同步',
    { type: 'warning' },
  );
  try {
    await projectsApi.syncPlan(projectId.value, selectedVersion.value, preview.value.diffHash);
    ElMessage.success('SOP 同步已应用');
    syncDialog.value = false;
    await refreshExecutionData();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function toggleChecklist(id: string, completed: unknown): Promise<void> {
  try {
    await projectsApi.completeChecklist(id, Boolean(completed));
    await refreshExecutionData();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function openTaskEdit(task: ProjectWorkItem): Promise<void> {
  editingTaskId.value = task.id;
  Object.assign(editTaskForm, {
    ownerUserId: task.owner?.id ?? '',
    plannedStartDate: task.plannedStartDate?.slice(0, 10) ?? '',
    plannedEndDate: task.plannedEndDate?.slice(0, 10) ?? '',
  });
  try {
    const members = await projectsApi.members(projectId.value);
    memberOptions.value = members.members?.map((item) => item.user) ?? [];
    editTaskDialog.value = true;
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function saveTaskPlan(): Promise<void> {
  try {
    await projectsApi.updatePlanTask(editingTaskId.value, {
      ownerUserId: editTaskForm.ownerUserId || undefined,
      plannedStartDate: editTaskForm.plannedStartDate || undefined,
      plannedEndDate: editTaskForm.plannedEndDate || undefined,
    });
    editTaskDialog.value = false;
    ElMessage.success('任务计划已更新');
    await refreshExecutionData();
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
  const document = deliverable.documents[0];
  selectedDeliverable.value = deliverable;
  selectedDocumentId.value = document?.id ?? '';
  documentName.value = document?.name ?? deliverable.name;
  uploadVersion.value = nextVersion(document);
  uploadFile.value = undefined;
  uploadDialog.value = true;
}
async function uploadDeliverable(): Promise<void> {
  if (!selectedDeliverable.value || !uploadFile.value) return;
  const form = new FormData();
  form.set('file', uploadFile.value);
  form.set('version', uploadVersion.value);
  if (selectedDocumentId.value) {
    await documentsApi.addVersion(selectedDocumentId.value, form);
  } else {
    form.set('name', documentName.value.trim() || selectedDeliverable.value.name);
    form.set('description', selectedDeliverable.value.description ?? '');
    await documentsApi.uploadForDeliverable(selectedDeliverable.value.id, form);
  }
  uploadDialog.value = false;
  ElMessage.success(selectedDocumentId.value ? '交付物新版本已上传' : '交付物已上传');
  await refreshExecutionData();
}
async function reviewDeliverable(
  documentId: string,
  status: 'APPROVED' | 'REJECTED',
): Promise<void> {
  let comment = '';
  if (status === 'REJECTED') {
    const response = await ElMessageBox.prompt('请输入驳回原因', '驳回交付物', {
      inputValidator: (value) => Boolean(value) || '请输入原因',
    });
    comment = response.value;
  }
  await documentsApi.review(documentId, status, comment);
  ElMessage.success(status === 'APPROVED' ? '交付物审核通过' : '交付物已驳回');
  await refreshExecutionData();
}
function openTask(task: ProjectWorkItem): void {
  selectedTaskId.value = task.id;
  drawer.value = true;
}
</script>

<template>
  <div>
    <div class="filters plan-toolbar">
      <div>
        <strong>计划结构</strong>
        <p class="muted">SOP 负责生成计划结构；检查项和交付物可直接在计划中执行，任务抽屉提供完整详情。</p>
      </div>
      <div class="filter-row">
        <el-select
          v-model="selectedVersion"
          filterable
          placeholder="选择已发布 SOP 版本"
          style="width: 360px"
        >
          <template v-for="template in templates.data.value ?? []" :key="template.id">
            <el-option
              v-for="version in template.versions.filter((item) => item.status === 'PUBLISHED')"
              :key="version.id"
              :label="`${template.name} · ${version.version}`"
              :value="version.id"
            />
          </template>
        </el-select>
        <el-button
          v-if="!plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          type="primary"
          :disabled="!selectedVersion"
          :loading="generate.isPending.value"
          @click="generate.mutate()"
        >生成计划</el-button>
        <el-button
          v-else-if="plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          :disabled="!selectedVersion || selectedVersion === plan.data.value.sourceSopVersionId"
          @click="showSync"
        >预览 SOP 同步</el-button>
      </div>
    </div>

    <el-result
      v-if="plan.isError.value && planMissing"
      icon="info"
      title="尚未生成实施计划"
      sub-title="可以先创建人工任务；选择已发布 SOP 后再生成正式计划结构"
    />
    <el-result
      v-else-if="plan.isError.value"
      icon="error"
      :title="
        plan.error.value instanceof ApiError && plan.error.value.code === 'PERMISSION_DENIED'
          ? '无权查看实施计划'
          : '实施计划加载失败'
      "
    >
      <template #extra><el-button @click="plan.refetch()">重试</el-button></template>
    </el-result>

    <div v-else-if="plan.data.value">
      <div class="plan-summary">
        <strong>{{ plan.data.value.name }}</strong>
        <span>整体进度 {{ plan.data.value.progress }}%</span>
      </div>
      <article v-for="stage in plan.data.value.stages" :key="stage.id" class="plan-stage">
        <div class="plan-stage-header">
          <div>
            <strong>{{ stage.name }}</strong>
            <span class="muted"> · 权重 {{ stage.weight }}%</span>
          </div>
          <el-progress :percentage="stage.progress" style="width: min(260px, 45%)" />
        </div>
        <div v-for="task in stage.workItems" :key="task.id" class="plan-task compact-task">
          <div>
            <strong>{{ task.name }}</strong>
            <div class="muted task-meta">
              {{ task.owner?.displayName ?? '未分配' }} ·
              {{ task.plannedStartDate?.slice(0, 10) ?? '-' }} 至
              {{ task.plannedEndDate?.slice(0, 10) ?? '-' }}
            </div>
          </div>
          <span>检查项 {{ task.checklistSummary?.completed ?? 0 }}/{{ task.checklistSummary?.total ?? 0 }}</span>
          <span>交付物 {{ task.deliverableSummary?.approved ?? 0 }}/{{ task.deliverableSummary?.total ?? 0 }}</span>
          <el-progress :percentage="task.progress" :stroke-width="7" />
          <StatusTag :value="task.status" />
          <div class="task-actions">
            <el-button
              v-if="auth.has(PERMISSIONS.PLAN_EDIT) || auth.has(PERMISSIONS.TASK_EDIT)"
              link
              @click="openTaskEdit(task)"
            >编辑计划</el-button>
            <el-button link type="primary" @click="openTask(task)">打开任务</el-button>
          </div>

          <div v-if="task.checklistItems.length" class="checklist-inline">
            <el-checkbox
              v-for="item in task.checklistItems"
              :key="item.id"
              :model-value="item.completed"
              :disabled="!(auth.has(PERMISSIONS.TASK_EDIT) || auth.has(PERMISSIONS.PLAN_EDIT))"
              @change="toggleChecklist(item.id, $event)"
            >
              {{ item.name }}<span v-if="item.required" class="required-mark"> *</span>
            </el-checkbox>
          </div>

          <div v-if="task.deliverables.length" class="deliverables-inline">
            <article
              v-for="deliverable in task.deliverables"
              :key="deliverable.id"
              class="project-deliverable-card"
            >
              <div class="deliverable-header">
                <div>
                  <strong>{{ deliverable.name }}</strong>
                  <el-tag size="small" :type="deliverable.required ? 'danger' : 'info'" effect="plain">
                    {{ deliverable.required ? '必交' : '可选' }}
                  </el-tag>
                </div>
                <StatusTag :value="deliverable.effectiveStatus" />
              </div>
              <p v-if="deliverable.description" class="muted">{{ deliverable.description }}</p>
              <div v-if="deliverable.templates.length" class="deliverable-links">
                <span class="muted">标准模板：</span>
                <a
                  v-for="template in deliverable.templates"
                  :key="template.id"
                  :href="projectsApi.deliverableTemplateDownloadUrl(template.id)"
                >{{ template.fileName }}</a>
              </div>
              <div v-if="deliverable.documents[0]?.versions[0]" class="deliverable-links">
                <span class="muted">当前文件：</span>
                <a :href="documentsApi.downloadUrl(deliverable.documents[0].versions[0].id)">
                  {{ deliverable.documents[0].versions[0].fileName }}
                </a>
              </div>
              <div class="deliverable-actions">
                <el-button
                  v-if="auth.has(PERMISSIONS.DOCUMENT_UPLOAD)"
                  size="small"
                  @click="openUpload(deliverable)"
                >{{ deliverable.documents[0] ? '上传新版本' : '上传交付物' }}</el-button>
                <template
                  v-if="
                    deliverable.documents[0]?.status === 'PENDING_REVIEW' &&
                    auth.has(PERMISSIONS.DOCUMENT_REVIEW)
                  "
                >
                  <el-button
                    size="small"
                    type="success"
                    @click="reviewDeliverable(deliverable.documents[0].id, 'APPROVED')"
                  >通过</el-button>
                  <el-button
                    size="small"
                    type="danger"
                    @click="reviewDeliverable(deliverable.documents[0].id, 'REJECTED')"
                  >驳回</el-button>
                </template>
              </div>
            </article>
          </div>
        </div>
      </article>
    </div>

    <el-dialog v-model="editTaskDialog" title="编辑任务计划" width="min(560px,94vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="负责人">
          <el-select v-model="editTaskForm.ownerUserId" clearable style="width: 100%">
            <el-option
              v-for="member in memberOptions"
              :key="member.id"
              :label="member.displayName"
              :value="member.id"
            />
          </el-select>
        </el-form-item>
        <div class="content-grid">
          <el-form-item label="计划开始">
            <el-date-picker
              v-model="editTaskForm.plannedStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="计划结束">
            <el-date-picker
              v-model="editTaskForm.plannedEndDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editTaskDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTaskPlan">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="syncDialog" title="SOP 同步差异" width="min(760px,95vw)">
      <el-alert
        title="未启动项目可直接同步；如存在人工/变更任务或执行记录，后端会拒绝破坏性同步。已启动项目必须走项目变更。"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-table :data="preview?.diff ?? []" max-height="480">
        <el-table-column prop="operation" label="操作" width="100" />
        <el-table-column prop="entity" label="对象" width="110" />
        <el-table-column prop="path" label="路径" min-width="260" />
      </el-table>
      <el-empty v-if="preview && !preview.diff.length" description="两个版本无差异" />
      <template #footer>
        <el-button @click="syncDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!preview?.diff.length" @click="applySync">确认应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="uploadDialog" title="上传实际交付物" width="min(560px,94vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="文档名称" required>
          <el-input v-model.trim="documentName" :disabled="Boolean(selectedDocumentId)" />
        </el-form-item>
        <el-form-item label="版本号" required>
          <el-input v-model.trim="uploadVersion" />
        </el-form-item>
        <el-form-item label="文件" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="(item: { raw?: File }) => (uploadFile = item.raw)"
          >
            <el-button>选择文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!uploadFile || !uploadVersion || (!selectedDocumentId && !documentName)"
          @click="uploadDeliverable"
        >上传</el-button>
      </template>
    </el-dialog>

    <TaskExecutionDrawer v-model="drawer" :task-id="selectedTaskId" />
  </div>
</template>

<style scoped>
.plan-toolbar,
.plan-summary,
.plan-stage-header,
.deliverable-header,
.deliverable-actions,
.deliverable-links {
  display: flex;
  align-items: center;
  gap: 16px;
}
.plan-toolbar,
.plan-summary,
.plan-stage-header,
.deliverable-header { justify-content: space-between; }
.plan-toolbar { margin-bottom: 14px; }
.plan-toolbar p { margin: 4px 0 0; }
.plan-summary { margin-bottom: 12px; }
.plan-stage { margin-bottom: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; }
.plan-stage-header { margin-bottom: 10px; }
.compact-task {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) 120px 110px minmax(120px, 1fr) 100px minmax(150px, auto);
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.task-actions { display: flex; align-items: center; gap: 4px; }
.checklist-inline,
.deliverables-inline { grid-column: 1 / -1; }
.checklist-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.checklist-inline .el-checkbox { margin-right: 0; }
.deliverables-inline { display: grid; gap: 8px; }
.project-deliverable-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
}
.deliverable-header > div { display: flex; align-items: center; gap: 8px; }
.deliverable-header strong { margin: 0; }
.project-deliverable-card p { margin: 6px 0 0; }
.deliverable-links { justify-content: flex-start; flex-wrap: wrap; margin-top: 8px; gap: 8px; }
.deliverable-actions { justify-content: flex-start; margin-top: 10px; gap: 8px; }
.required-mark { color: var(--el-color-danger); }
.task-meta { margin-top: 4px; font-size: 12px; }
.muted { color: var(--el-text-color-secondary); }
@media (max-width: 900px) {
  .plan-toolbar { align-items: flex-start; flex-direction: column; }
  .compact-task { grid-template-columns: 1fr 130px; }
  .compact-task > span,
  .compact-task > .el-progress { display: none; }
  .checklist-inline,
  .deliverables-inline { grid-column: 1 / -1; }
  .deliverable-header { align-items: flex-start; }
}
</style>