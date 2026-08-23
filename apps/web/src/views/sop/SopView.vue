<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { sopApi } from '../../api/sop.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
const client = useQueryClient();
const selectedId = ref('');
const templateDialog = ref(false);
const taskDialog = ref(false);
const selectedStage = ref('');
const templateForm = reactive({ code: '', name: '', description: '' });
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
  queryKey: ['sop-template', selectedId],
  queryFn: () => sopApi.get(selectedId.value),
  enabled: () => Boolean(selectedId.value),
});
async function refresh(): Promise<void> {
  await client.invalidateQueries({ queryKey: ['sop-templates'] });
  if (selectedId.value) await client.invalidateQueries({ queryKey: ['sop-template', selectedId] });
}
async function createTemplate(): Promise<void> {
  try {
    const result = (await sopApi.createTemplate(templateForm)) as { id: string };
    selectedId.value = result.id;
    templateDialog.value = false;
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
</script>
<template>
  <div>
    <PageHeader
      title="SOP 管理"
      description="版本发布后不可变；项目使用独立快照，模板后续变更不会污染在执行项目"
      ><el-button type="primary" @click="templateDialog = true">创建模板</el-button></PageHeader
    >
    <div class="content-grid" style="grid-template-columns: minmax(240px, 320px) minmax(0, 1fr)">
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
        <el-empty v-if="!selectedId" description="请选择或创建 SOP 模板" /><template
          v-else-if="detail.data.value"
          ><div class="detail-hero">
            <div>
              <el-tag effect="plain">{{ detail.data.value.code }}</el-tag>
              <h2>{{ detail.data.value.name }}</h2>
              <p class="muted">{{ detail.data.value.description || '暂无说明' }}</p>
            </div>
            <el-button type="primary" plain @click="createVersion">创建版本</el-button>
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
                  v-if="version.status === 'DRAFT'"
                  type="primary"
                  @click="addStage(version.id)"
                  >新增阶段</el-button
                ><el-button
                  v-if="version.status === 'DRAFT'"
                  type="success"
                  @click="publish(version.id)"
                  >发布版本</el-button
                ><el-button v-else @click="clone(version.id)">创建新草稿</el-button>
              </div>
              <article v-for="stage in version.stages ?? []" :key="stage.id" class="plan-stage">
                <div class="plan-stage-header">
                  <div>
                    <strong>{{ stage.name }}</strong
                    ><span class="muted">
                      · {{ stage.defaultDurationDays }}天 · 权重 {{ stage.weight }}%</span
                    >
                  </div>
                  <el-button
                    v-if="version.status === 'DRAFT'"
                    size="small"
                    @click="openTask(stage.id)"
                    >新增任务</el-button
                  >
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
                    <el-button
                      v-if="version.status === 'DRAFT'"
                      size="small"
                      text
                      @click="addChecklist(task.id)"
                      >新增检查项</el-button
                    >
                  </div>
                  <div class="checklist">
                    <div v-for="check in task.checklistItems" :key="check.id">
                      □ {{ check.name }}<span v-if="check.required" class="danger-text"> *</span>
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
    <el-dialog v-model="templateDialog" title="创建 SOP 模板" width="min(560px,94vw)"
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
