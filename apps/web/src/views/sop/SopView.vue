<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { sopApi } from '../../api/sop.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import type { SopVersion } from '../../types/domain';
const auth = useAuthStore();
const client = useQueryClient();
const selectedId = ref('');
const templateDialog = ref(false);
const taskDialog = ref(false);
const selectedStage = ref('');
const templateForm = reactive({ code: '', name: '', description: '' });
function resetTemplateForm(): void {
  Object.assign(templateForm, { code: '', name: '', description: '' });
}
const taskForm = reactive({
  name: '',
  description: '',
  defaultDurationDays: 1,
  required: true,
  deliverableRequired: false,
  deliverableName: '',
  deliverableTemplate: '',
});
const list = useQuery({ queryKey: ['sop-templates'], queryFn: sopApi.list });
const detail = useQuery({
  queryKey: computed(() => ['sop-template', selectedId.value]),
  queryFn: () => sopApi.get(selectedId.value),
  enabled: () => Boolean(selectedId.value),
});
async function refresh(): Promise<void> {
  await client.invalidateQueries({ queryKey: ['sop-templates'] });
  if (selectedId.value)
    await client.invalidateQueries({ queryKey: ['sop-template', selectedId.value] });
}
async function createTemplate(): Promise<void> {
  try {
    const result = (await sopApi.createTemplate(templateForm)) as { id: string };
    selectedId.value = result.id;
    templateDialog.value = false;
    resetTemplateForm();
    ElMessage.success('SOP 模板已创建');
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function createVersion(): Promise<void> {
  if (!selectedId.value) return;
  const { value } = await ElMessageBox.prompt('请输入新版本号，例如 V1.0', '创建 SOP 版本', {
    inputPattern: /^V?\d+\.\d+(?:\.\d+)?$/,
    inputErrorMessage: '版本号格式不正确',
  });
  await sopApi.createVersion(selectedId.value, { version: value });
  ElMessage.success('草稿版本已创建');
  await refresh();
}
async function addStage(versionId: string): Promise<void> {
  const { value } = await ElMessageBox.prompt('阶段名称', '新增 SOP 阶段', {
    inputValidator: (value) => Boolean(value) || '请输入阶段名称',
  });
  await sopApi.createStage(versionId, { name: value, defaultDurationDays: 5 });
  ElMessage.success('阶段已新增');
  await refresh();
}
function openTask(stageId: string): void {
  selectedStage.value = stageId;
  Object.assign(taskForm, {
    name: '',
    description: '',
    defaultDurationDays: 1,
    required: true,
    deliverableRequired: false,
    deliverableName: '',
    deliverableTemplate: '',
  });
  taskDialog.value = true;
}
async function addTask(): Promise<void> {
  try {
    await sopApi.createTask(selectedStage.value, {
      ...taskForm,
      deliverableName: taskForm.deliverableRequired ? taskForm.deliverableName : undefined,
      deliverableTemplate: taskForm.deliverableTemplate || undefined,
    });
    taskDialog.value = false;
    ElMessage.success('SOP 任务已新增');
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function addChecklist(taskId: string): Promise<void> {
  const { value } = await ElMessageBox.prompt('检查项名称', '新增检查项', {
    inputValidator: (value) => Boolean(value) || '请输入检查项',
  });
  await sopApi.createChecklist(taskId, { name: value, required: true });
  ElMessage.success('检查项已新增');
  await refresh();
}
async function publish(versionId: string): Promise<void> {
  await ElMessageBox.confirm(
    '发布后版本不可直接修改，系统将按工期重算同层权重为 100%。',
    '发布 SOP 版本',
    { type: 'warning' },
  );
  await sopApi.publish(versionId);
  ElMessage.success('SOP 版本已发布');
  await refresh();
}
async function clone(versionId: string): Promise<void> {
  const { value } = await ElMessageBox.prompt('请输入新版本号', '从当前版本创建草稿', {
    inputPattern: /^V?\d+\.\d+(?:\.\d+)?$/,
    inputErrorMessage: '版本号格式不正确',
  });
  await sopApi.clone(versionId, { version: value });
  ElMessage.success('新草稿版本已创建');
  await refresh();
}
async function editStage(stage: NonNullable<SopVersion['stages']>[number]): Promise<void> {
  const { value } = await ElMessageBox.prompt('阶段名称', '编辑 SOP 阶段', {
    inputValue: stage.name,
  });
  await sopApi.updateStage(stage.id, { name: value });
  await refresh();
}
async function removeStage(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除该阶段及其任务？', '删除阶段', { type: 'warning' });
  await sopApi.removeStage(id);
  await refresh();
}
async function editTask(
  task: NonNullable<SopVersion['stages']>[number]['tasks'][number],
): Promise<void> {
  const { value } = await ElMessageBox.prompt('任务名称', '编辑 SOP 任务', {
    inputValue: task.name,
  });
  await sopApi.updateTask(task.id, {
    name: value,
    description: task.description,
    sortOrder: task.sortOrder,
    defaultDurationDays: task.defaultDurationDays,
    required: task.required,
    deliverableRequired: task.deliverableRequired,
    deliverableName: task.deliverableName,
  });
  await refresh();
}
async function removeTask(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除该任务及检查项？', '删除任务', { type: 'warning' });
  await sopApi.removeTask(id);
  await refresh();
}
async function removeChecklist(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除该检查项？', '删除检查项', { type: 'warning' });
  await sopApi.removeChecklist(id);
  await refresh();
}
</script>
<template>
  <div>
    <PageHeader
      title="SOP 管理"
      description="版本发布后不可变；项目使用独立快照，模板后续变更不会污染在执行项目"
      ><el-button
        v-if="auth.has(PERMISSIONS.SOP_CREATE)"
        type="primary"
        @click="templateDialog = true"
        >创建模板</el-button
      ></PageHeader
    >
    <ApiErrorView
      v-if="list.isError.value"
      :error="list.error.value"
      title="SOP 模板加载失败"
      @retry="list.refetch()"
    />
    <div
      v-else
      class="content-grid"
      style="grid-template-columns: minmax(240px, 320px) minmax(0, 1fr)"
    >
      <aside class="panel">
        <div class="panel-header"><h3>模板库</h3></div>
        <div style="padding: 8px">
          <button
            v-for="item in list.data.value ?? []"
            :key="item.id"
            class="nav-item"
            :class="{ active: selectedId === item.id }"
            style="color: var(--text); margin-bottom: 4px"
            @click="selectedId = item.id"
          >
            <span style="display: block"
              ><strong>{{ item.name }}</strong
              ><small class="muted" style="display: block; margin-top: 3px"
                >{{ item.code }} · {{ item.versions.length }} 个版本</small
              ></span
            ></button
          ><el-empty v-if="!list.data.value?.length" description="暂无 SOP 模板" :image-size="64" />
        </div>
      </aside>
      <section>
        <ApiErrorView
          v-if="detail.isError.value"
          :error="detail.error.value"
          title="SOP 详情加载失败"
          @retry="detail.refetch()"
        />
        <el-empty v-else-if="!selectedId" description="请选择或创建 SOP 模板" /><template
          v-else-if="detail.data.value"
          ><div class="detail-hero">
            <div>
              <el-tag effect="plain">{{ detail.data.value.code }}</el-tag>
              <h2>{{ detail.data.value.name }}</h2>
              <p class="muted">{{ detail.data.value.description || '暂无说明' }}</p>
            </div>
            <el-button
              v-if="auth.has(PERMISSIONS.SOP_CREATE)"
              type="primary"
              plain
              @click="createVersion"
              >创建版本</el-button
            >
          </div>
          <el-collapse accordion
            ><el-collapse-item
              v-for="version in detail.data.value.versions"
              :key="version.id"
              :name="version.id"
              ><template #title
                ><div style="display: flex; align-items: center; gap: 10px">
                  <strong>{{ version.version }}</strong
                  ><StatusTag :value="version.status" /><span class="muted"
                    >{{ version.stages?.length ?? 0 }} 个阶段</span
                  >
                </div></template
              >
              <div class="toolbar-actions" style="margin-bottom: 12px">
                <el-button
                  v-if="version.status === 'DRAFT' && auth.has(PERMISSIONS.SOP_EDIT)"
                  type="primary"
                  @click="addStage(version.id)"
                  >新增阶段</el-button
                ><el-button
                  v-if="version.status === 'DRAFT' && auth.has(PERMISSIONS.SOP_PUBLISH)"
                  type="success"
                  @click="publish(version.id)"
                  >发布版本</el-button
                ><el-button v-else-if="auth.has(PERMISSIONS.SOP_CREATE)" @click="clone(version.id)"
                  >创建新草稿</el-button
                >
              </div>
              <article v-for="stage in version.stages ?? []" :key="stage.id" class="plan-stage">
                <div class="plan-stage-header">
                  <div>
                    <strong>{{ stage.name }}</strong
                    ><span class="muted">
                      · {{ stage.defaultDurationDays }}天 · 权重 {{ stage.weight }}%</span
                    >
                  </div>
                  <div
                    v-if="version.status === 'DRAFT' && auth.has(PERMISSIONS.SOP_EDIT)"
                    class="toolbar-actions"
                  >
                    <el-button size="small" @click="editStage(stage)">编辑阶段</el-button
                    ><el-button size="small" @click="openTask(stage.id)">新增任务</el-button
                    ><el-button size="small" type="danger" @click="removeStage(stage.id)"
                      >删除阶段</el-button
                    >
                  </div>
                </div>
                <div v-for="task in stage.tasks" :key="task.id" class="plan-task">
                  <div style="display: flex; justify-content: space-between; gap: 12px">
                    <div>
                      <strong>{{ task.name }}</strong
                      ><span class="muted">
                        · {{ task.defaultDurationDays }}天 · {{ task.weight }}%</span
                      >
                      <div v-if="task.deliverableRequired" class="muted" style="margin-top: 4px">
                        交付物：{{ task.deliverableName }}
                      </div>
                    </div>
                    <div
                      v-if="version.status === 'DRAFT' && auth.has(PERMISSIONS.SOP_EDIT)"
                      class="toolbar-actions"
                    >
                      <el-button size="small" text @click="editTask(task)">编辑</el-button
                      ><el-button size="small" text @click="addChecklist(task.id)"
                        >新增检查项</el-button
                      ><el-button size="small" text type="danger" @click="removeTask(task.id)"
                        >删除</el-button
                      >
                    </div>
                  </div>
                  <div class="checklist">
                    <div v-for="check in task.checklistItems" :key="check.id">
                      □ {{ check.name }}<span v-if="check.required" class="danger-text"> *</span
                      ><el-button
                        v-if="version.status === 'DRAFT' && auth.has(PERMISSIONS.SOP_EDIT)"
                        text
                        type="danger"
                        size="small"
                        @click="removeChecklist(check.id)"
                        >删除</el-button
                      >
                    </div>
                    <span v-if="!task.checklistItems.length" class="muted">暂无检查项</span>
                  </div>
                </div>
              </article></el-collapse-item
            ></el-collapse
          ></template
        >
      </section>
    </div>
    <el-dialog
      v-model="templateDialog"
      title="创建 SOP 模板"
      width="min(560px,94vw)"
      destroy-on-close
      @closed="resetTemplateForm"
      ><el-form label-position="top"
        ><el-form-item label="模板编码" required
          ><el-input
            v-model.trim="templateForm.code"
            placeholder="MEDICAL_IMPLEMENTATION" /></el-form-item
        ><el-form-item label="模板名称" required
          ><el-input v-model.trim="templateForm.name" /></el-form-item
        ><el-form-item label="说明"
          ><el-input
            v-model="templateForm.description"
            type="textarea"
            :rows="3" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="templateDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!templateForm.code || !templateForm.name"
          @click="createTemplate"
          >创建</el-button
        ></template
      ></el-dialog
    ><el-dialog v-model="taskDialog" title="新增 SOP 任务" width="min(620px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="任务名称" required
          ><el-input v-model.trim="taskForm.name" /></el-form-item
        ><el-form-item label="说明"
          ><el-input v-model="taskForm.description" type="textarea" :rows="3" /></el-form-item
        ><el-form-item label="默认工期（天）"
          ><el-input-number
            v-model="taskForm.defaultDurationDays"
            :min="1"
            :max="3650" /></el-form-item
        ><el-checkbox v-model="taskForm.required">必需任务</el-checkbox
        ><el-checkbox v-model="taskForm.deliverableRequired">需要交付物</el-checkbox
        ><template v-if="taskForm.deliverableRequired"
          ><el-form-item label="交付物名称" required
            ><el-input v-model.trim="taskForm.deliverableName" /></el-form-item
          ><el-form-item label="标准模板文件"
            ><el-input
              v-model.trim="taskForm.deliverableTemplate"
              placeholder="例：上线确认单.docx" /></el-form-item></template></el-form
      ><template #footer
        ><el-button @click="taskDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!taskForm.name || (taskForm.deliverableRequired && !taskForm.deliverableName)"
          @click="addTask"
          >新增</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
