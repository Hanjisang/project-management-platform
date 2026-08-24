<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
import { documentsApi } from '../../api/documents.api';
import { sopApi } from '../../api/sop.api';
import StatusTag from '../../components/StatusTag.vue';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import { ApiError } from '../../api/client';
import { projectQueryKey } from '../../composables/project-query';
import type { DocumentRecord, PlanTask, ProjectDeliverable } from '../../types/domain';
const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const selectedVersion = ref('');
const syncDialog = ref(false);
const taskDialog = ref(false);
const deliverableDialog = ref(false);
const deliverableFile = ref<File>();
const selectedProjectDeliverable = ref<ProjectDeliverable>();
const selectedDocumentId = ref('');
const deliverableForm = ref({ name: '', description: '', version: 'V1.0' });
const editingTaskId = ref('');
const taskForm = ref({ ownerUserId: '', plannedStartDate: '', plannedEndDate: '' });
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
const members = useQuery({
  queryKey: projectQueryKey('project-members', projectId),
  queryFn: () => projectsApi.members(projectId.value),
});
const generate = useMutation({
  mutationFn: () => projectsApi.generatePlan(projectId.value, selectedVersion.value),
  onSuccess: async () => {
    ElMessage.success('实施计划已生成');
    await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
const complete = useMutation({
  mutationFn: ({ id, value }: { id: string; value: boolean }) =>
    projectsApi.completeChecklist(id, value),
  onSuccess: async () => {
    await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
    await client.invalidateQueries({ queryKey: ['project', projectId.value] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
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
  await ElMessageBox.confirm('同步会更新模板节点，已有执行数据会保留。确定应用？', '确认同步', {
    type: 'warning',
  });
  try {
    await projectsApi.syncPlan(projectId.value, selectedVersion.value, preview.value.diffHash);
    ElMessage.success('SOP 同步已应用');
    syncDialog.value = false;
    await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
function onChecklistChange(id: string, value: unknown): void {
  complete.mutate({ id, value: Boolean(value) });
}
function openTaskEdit(task: PlanTask): void {
  editingTaskId.value = task.id;
  taskForm.value = {
    ownerUserId: task.owner?.id ?? '',
    plannedStartDate: task.plannedStartDate?.slice(0, 10) ?? '',
    plannedEndDate: task.plannedEndDate?.slice(0, 10) ?? '',
  };
  taskDialog.value = true;
}
async function saveTask(): Promise<void> {
  await projectsApi.updatePlanTask(editingTaskId.value, {
    ownerUserId: taskForm.value.ownerUserId || undefined,
    plannedStartDate: taskForm.value.plannedStartDate || undefined,
    plannedEndDate: taskForm.value.plannedEndDate || undefined,
  });
  taskDialog.value = false;
  ElMessage.success('计划任务已更新');
  await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
}
function selectDeliverableFile(uploadFile: { raw?: File }): void {
  deliverableFile.value = uploadFile.raw;
}
function nextVersion(document?: DocumentRecord): string {
  const values =
    document?.versions
      .map((item) => /^V?(\d+)\.(\d+)$/.exec(item.version))
      .filter((item): item is RegExpExecArray => Boolean(item)) ?? [];
  const latest = values.sort(
    (a, b) => Number(b[1]) - Number(a[1]) || Number(b[2]) - Number(a[2]),
  )[0];
  return latest ? `V${latest[1]}.${Number(latest[2]) + 1}` : 'V1.0';
}
function openDeliverableUpload(deliverable: ProjectDeliverable): void {
  const document = deliverable.documents[0];
  selectedProjectDeliverable.value = deliverable;
  selectedDocumentId.value = document?.id ?? '';
  deliverableFile.value = undefined;
  deliverableForm.value = {
    name: deliverable.name,
    description: deliverable.description ?? '',
    version: nextVersion(document),
  };
  deliverableDialog.value = true;
}
async function uploadDeliverable(): Promise<void> {
  const deliverable = selectedProjectDeliverable.value!;
  const data = new FormData();
  data.set('file', deliverableFile.value!);
  data.set('version', deliverableForm.value.version);
  if (selectedDocumentId.value) await documentsApi.addVersion(selectedDocumentId.value, data);
  else {
    data.set('name', deliverableForm.value.name);
    data.set('description', deliverableForm.value.description);
    await documentsApi.uploadForDeliverable(deliverable.id, data);
  }
  deliverableDialog.value = false;
  ElMessage.success(selectedDocumentId.value ? '交付物新版本已上传' : '实际交付物已上传');
  await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
  await client.invalidateQueries({ queryKey: ['documents', projectId.value] });
}
async function submitDeliverable(documentId: string): Promise<void> {
  await documentsApi.submit(documentId);
  ElMessage.success('交付物已提交审核');
  await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
}
async function reviewDeliverable(
  documentId: string,
  status: 'APPROVED' | 'REJECTED',
): Promise<void> {
  let comment = '';
  if (status === 'REJECTED') {
    const result = await ElMessageBox.prompt('请输入驳回原因', '驳回交付物', {
      inputValidator: (value) => Boolean(value) || '请输入原因',
    });
    comment = result.value;
  }
  await documentsApi.review(documentId, status, comment);
  ElMessage.success(status === 'APPROVED' ? '交付物已审核通过' : '交付物已驳回');
  await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
}
function fileSize(value: string): string {
  const bytes = Number(value);
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>
<template>
  <div>
    <div class="filters">
      <div class="filter-row">
        <el-select
          v-model="selectedVersion"
          filterable
          placeholder="选择已发布 SOP 版本"
          style="width: 360px"
          ><template v-for="template in templates.data.value ?? []" :key="template.id"
            ><el-option
              v-for="version in template.versions.filter((item) => item.status === 'PUBLISHED')"
              :key="version.id"
              :label="`${template.name} · ${version.version}`"
              :value="version.id" /></template></el-select
        ><el-button
          v-if="!plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          type="primary"
          :disabled="!selectedVersion"
          :loading="generate.isPending.value"
          @click="generate.mutate()"
          >生成计划</el-button
        ><el-button
          v-else-if="plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          :disabled="!selectedVersion || selectedVersion === plan.data.value.sourceSopVersionId"
          @click="showSync"
          >预览 SOP 同步</el-button
        >
      </div>
    </div>
    <el-result
      v-if="plan.isError.value && planMissing"
      icon="info"
      title="尚未生成实施计划"
      sub-title="选择已发布 SOP 版本后生成项目独立快照"
    />
    <el-result
      v-else-if="plan.isError.value"
      icon="error"
      :title="
        plan.error.value instanceof ApiError && plan.error.value.code === 'PERMISSION_DENIED'
          ? '无权查看实施计划'
          : '实施计划加载失败'
      "
      ><template #extra><el-button @click="plan.refetch()">重试</el-button></template></el-result
    >
    <div v-else-if="plan.data.value">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px">
        <strong>{{ plan.data.value.name }}</strong
        ><span>整体进度 {{ plan.data.value.progress }}%</span>
      </div>
      <article v-for="stage in plan.data.value.stages" :key="stage.id" class="plan-stage">
        <div class="plan-stage-header">
          <div>
            <strong>{{ stage.name }}</strong
            ><span class="muted"> · 权重 {{ stage.weight }}%</span>
          </div>
          <el-progress :percentage="stage.progress" style="width: min(240px, 45%)" />
        </div>
        <div v-for="task in stage.workItems" :key="task.id" class="plan-task">
          <div style="display: flex; justify-content: space-between; gap: 12px">
            <div>
              <strong>{{ task.name }}</strong>
              <div class="muted" style="font-size: 12px; margin-top: 3px">
                {{ task.plannedStartDate?.slice(0, 10) ?? '-' }} 至
                {{ task.plannedEndDate?.slice(0, 10) ?? '-' }}
              </div>
            </div>
            <StatusTag
              :value="task.progress === 100 ? 'DONE' : task.progress > 0 ? 'IN_PROGRESS' : 'TODO'"
            />
            <router-link :to="{ path: '/tasks', query: { taskId: task.id } }"
              ><el-button link type="primary">查看任务</el-button></router-link
            >
            <el-button
              v-if="auth.has(PERMISSIONS.PLAN_EDIT)"
              link
              type="primary"
              @click="openTaskEdit(task)"
              >编辑</el-button
            >
          </div>
          <el-progress :percentage="task.progress" :stroke-width="7" style="margin-top: 8px" />
          <div v-if="task.checklistItems.length" class="checklist">
            <el-checkbox
              v-for="item in task.checklistItems"
              :key="item.id"
              :model-value="item.completed"
              :disabled="complete.isPending.value || !auth.has(PERMISSIONS.PLAN_EDIT)"
              @change="onChecklistChange(item.id, $event)"
              >{{ item.name }} <span v-if="item.required" class="danger-text">*</span></el-checkbox
            >
          </div>
          <section class="project-deliverables">
            <div class="project-deliverables-title">
              <strong>交付物</strong><span class="muted">{{ task.deliverables.length }} 项</span>
            </div>
            <div
              v-for="deliverable in task.deliverables"
              :key="deliverable.id"
              class="project-deliverable-card"
            >
              <div class="project-deliverable-header">
                <div>
                  <strong>{{ deliverable.name }}</strong>
                  <el-tag
                    :type="deliverable.required ? 'danger' : 'info'"
                    size="small"
                    effect="plain"
                    style="margin-left: 8px"
                    >{{ deliverable.required ? '必交' : '可选' }}</el-tag
                  >
                  <p v-if="deliverable.description" class="muted">{{ deliverable.description }}</p>
                </div>
                <StatusTag :value="deliverable.effectiveStatus" />
              </div>
              <div class="deliverable-row">
                <span class="muted">标准模板</span>
                <div v-if="deliverable.templates.length" class="deliverable-links">
                  <a
                    v-for="template in deliverable.templates"
                    :key="template.id"
                    :href="projectsApi.deliverableTemplateDownloadUrl(template.id)"
                    >{{ template.fileName }}（{{ fileSize(template.size) }}）</a
                  >
                </div>
                <span v-else class="muted">无模板</span>
              </div>
              <div class="deliverable-row">
                <span class="muted">实际交付</span>
                <template v-if="deliverable.documents[0]">
                  <a
                    v-if="deliverable.documents[0].versions[0]"
                    :href="documentsApi.downloadUrl(deliverable.documents[0].versions[0].id)"
                    >{{ deliverable.documents[0].versions[0].fileName }}</a
                  >
                  <StatusTag :value="deliverable.documents[0].status" />
                  <el-button
                    v-if="auth.has(PERMISSIONS.DOCUMENT_UPLOAD)"
                    size="small"
                    @click="openDeliverableUpload(deliverable)"
                    >上传新版本</el-button
                  >
                  <el-button
                    v-if="
                      ['DRAFT', 'REJECTED'].includes(deliverable.documents[0].status) &&
                      auth.has(PERMISSIONS.DOCUMENT_UPLOAD)
                    "
                    size="small"
                    type="primary"
                    @click="submitDeliverable(deliverable.documents[0].id)"
                    >提交审核</el-button
                  >
                  <template
                    v-if="
                      deliverable.documents[0].status === 'PENDING_REVIEW' &&
                      auth.has(PERMISSIONS.DOCUMENT_REVIEW)
                    "
                  >
                    <el-button
                      size="small"
                      type="success"
                      @click="reviewDeliverable(deliverable.documents[0].id, 'APPROVED')"
                      >通过</el-button
                    ><el-button
                      size="small"
                      type="danger"
                      @click="reviewDeliverable(deliverable.documents[0].id, 'REJECTED')"
                      >驳回</el-button
                    >
                  </template>
                </template>
                <template v-else>
                  <span class="muted">未上传</span>
                  <el-button
                    v-if="auth.has(PERMISSIONS.DOCUMENT_UPLOAD)"
                    size="small"
                    type="primary"
                    @click="openDeliverableUpload(deliverable)"
                    >上传交付物</el-button
                  >
                </template>
              </div>
            </div>
            <span v-if="!task.deliverables.length" class="muted">该任务无交付物要求</span>
          </section>
        </div>
      </article>
    </div>
    <el-dialog v-model="syncDialog" title="SOP 同步差异" width="min(760px,95vw)"
      ><el-table :data="preview?.diff ?? []" max-height="480"
        ><el-table-column prop="operation" label="操作" width="100" /><el-table-column
          prop="entity"
          label="对象"
          width="110" /><el-table-column prop="path" label="路径" min-width="260" /></el-table
      ><el-empty v-if="preview && !preview.diff.length" description="两个版本无差异" /><template
        #footer
        ><el-button @click="syncDialog = false">取消</el-button
        ><el-button type="primary" :disabled="!preview?.diff.length" @click="applySync"
          >确认应用</el-button
        ></template
      ></el-dialog
    >
    <el-dialog v-model="taskDialog" title="编辑计划任务" width="min(520px, 95vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="负责人">
          <el-select v-model="taskForm.ownerUserId" clearable filterable placeholder="选择项目成员">
            <el-option
              v-for="member in members.data.value?.members ?? []"
              :key="member.userId"
              :label="member.user.displayName"
              :value="member.userId"
            />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="计划开始"
            ><el-date-picker
              v-model="taskForm.plannedStartDate"
              type="date"
              value-format="YYYY-MM-DD"
          /></el-form-item>
          <el-form-item label="计划结束"
            ><el-date-picker
              v-model="taskForm.plannedEndDate"
              type="date"
              value-format="YYYY-MM-DD"
          /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="taskDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="deliverableDialog"
      :title="selectedDocumentId ? '上传交付物新版本' : '上传实际交付物'"
      width="min(560px, 95vw)"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item v-if="!selectedDocumentId" label="文档名称" required>
          <el-input v-model.trim="deliverableForm.name" />
        </el-form-item>
        <el-form-item label="版本号" required>
          <el-input v-model.trim="deliverableForm.version" placeholder="V1.0" />
        </el-form-item>
        <el-form-item v-if="!selectedDocumentId" label="说明">
          <el-input v-model="deliverableForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="实际交付文件（最大 50MB）" required>
          <el-upload :auto-upload="false" :limit="1" :on-change="selectDeliverableFile">
            <el-button>选择文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliverableDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!deliverableFile || !deliverableForm.name || !deliverableForm.version"
          @click="uploadDeliverable"
          >上传</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.project-deliverables {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.project-deliverables-title,
.project-deliverable-header,
.deliverable-row,
.deliverable-links {
  display: flex;
  align-items: center;
  gap: 10px;
}
.project-deliverables-title,
.project-deliverable-header {
  justify-content: space-between;
}
.project-deliverables-title {
  margin-bottom: 8px;
}
.project-deliverable-card {
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
}
.project-deliverable-header p {
  margin: 4px 0 0;
}
.deliverable-row {
  align-items: flex-start;
  flex-wrap: wrap;
  margin-top: 8px;
}
.deliverable-row > .muted:first-child {
  width: 72px;
}
.deliverable-links {
  align-items: flex-start;
  flex-direction: column;
}
@media (max-width: 640px) {
  .project-deliverable-header {
    align-items: flex-start;
  }
  .deliverable-row > .muted:first-child {
    width: 100%;
  }
}
</style>
