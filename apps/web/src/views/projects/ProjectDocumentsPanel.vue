<script setup lang="ts">
import { reactive, ref, toRef } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { documentsApi } from '../../api/documents.api';
import { knowledgeApi } from '../../api/knowledge.api';
import StatusTag from '../../components/StatusTag.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import { projectQueryKey } from '../../composables/project-query';
import type { DocumentRecord } from '../../types/domain';
const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const dialog = ref(false);
const file = ref<File>();
const versionDialog = ref(false);
const versionDocumentId = ref('');
const versionFile = ref<File>();
const version = ref('V1.1');
const form = reactive({ name: '', description: '', version: 'V1.0', required: false });
function resetUploadForm(): void {
  file.value = undefined;
  Object.assign(form, { name: '', description: '', version: 'V1.0', required: false });
}
const query = useQuery({
  queryKey: projectQueryKey('documents', projectId),
  queryFn: () => documentsApi.list(projectId.value),
});
const categories = useQuery({
  queryKey: ['knowledge-categories'],
  queryFn: knowledgeApi.categories,
});
const upload = useMutation({
  mutationFn: async () => {
    const data = new FormData();
    data.set('file', file.value!);
    data.set('name', form.name);
    data.set('description', form.description);
    data.set('version', form.version);
    data.set('required', String(form.required));
    return documentsApi.upload(projectId.value, data);
  },
  onSuccess: async () => {
    ElMessage.success('文档已上传');
    dialog.value = false;
    resetUploadForm();
    await client.invalidateQueries({ queryKey: ['documents', projectId.value] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function select(uploadFile: { raw?: File }): void {
  file.value = uploadFile.raw;
}
function selectVersion(uploadFile: { raw?: File }): void {
  versionFile.value = uploadFile.raw;
}
function openVersion(id: string): void {
  versionDocumentId.value = id;
  version.value = 'V1.1';
  versionFile.value = undefined;
  versionDialog.value = true;
}
async function addVersion(): Promise<void> {
  const data = new FormData();
  data.set('file', versionFile.value!);
  data.set('version', version.value);
  await documentsApi.addVersion(versionDocumentId.value, data);
  ElMessage.success('新版本已上传，文档已回到草稿状态');
  versionDialog.value = false;
  await client.invalidateQueries({ queryKey: ['documents', projectId.value] });
}
async function submit(id: string): Promise<void> {
  await documentsApi.submit(id);
  ElMessage.success('文档已提交审核');
  await client.invalidateQueries({ queryKey: ['documents', projectId.value] });
}
async function remove(id: string): Promise<void> {
  await ElMessageBox.confirm('删除后文档及版本将不再显示，确定继续？', '删除文档', {
    type: 'warning',
  });
  await documentsApi.remove(id);
  ElMessage.success('文档已删除');
  await client.invalidateQueries({ queryKey: ['documents', projectId.value] });
}
async function deposit(row: unknown): Promise<void> {
  const document = row as DocumentRecord;
  const category = categories.data.value?.[0];
  if (!category) {
    ElMessage.error('请先在知识库创建分类');
    return;
  }
  await ElMessageBox.confirm(
    `将“${document.name}”沉淀到分类“${category.name}”并创建知识草稿？`,
    '沉淀知识',
  );
  await knowledgeApi.depositDocument(document.id, {
    categoryId: category.id,
    title: document.name,
  });
  ElMessage.success('已创建知识草稿');
}
async function review(id: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
  let comment = '';
  if (status === 'REJECTED') {
    const result = await ElMessageBox.prompt('请输入驳回原因', '驳回文档', {
      inputValidator: (value) => Boolean(value) || '请输入原因',
    });
    comment = result.value;
  }
  await documentsApi.review(id, status, comment);
  ElMessage.success(status === 'APPROVED' ? '文档已审核通过' : '文档已驳回');
  await client.invalidateQueries({ queryKey: ['documents', projectId.value] });
}
</script>
<template>
  <div>
    <div class="page-toolbar">
      <div>
        <h2 style="font-size: 16px">交付文档</h2>
        <p>逻辑文档、文档版本与审核记录分离管理</p>
      </div>
      <el-button v-if="auth.has(PERMISSIONS.DOCUMENT_UPLOAD)" type="primary" @click="dialog = true"
        >上传文档</el-button
      >
    </div>
    <ApiErrorView
      v-if="query.isError.value"
      :error="query.error.value"
      title="文档列表加载失败"
      @retry="query.refetch()"
    />
    <div v-else class="table-wrap">
      <el-table :data="query.data.value ?? []"
        ><el-table-column type="expand"
          ><template #default="scope"
            ><div class="panel-body">
              <strong>版本历史</strong>
              <ul>
                <li v-for="item in scope.row.versions" :key="item.id">
                  {{ item.version }} · {{ item.fileName }}
                </li>
              </ul>
              <strong>审核记录</strong>
              <ul>
                <li v-for="item in scope.row.reviews" :key="item.id">
                  {{ item.reviewer.displayName }} · {{ item.status }} · {{ item.comment || '-' }}
                </li>
              </ul>
            </div>
          </template></el-table-column
        ><el-table-column prop="name" label="文档" min-width="190" /><el-table-column
          prop="planTask.name"
          label="计划节点"
          min-width="150"
        /><el-table-column label="当前版本" width="110"
          ><template #default="scope">{{
            scope.row.versions[0]?.version ?? '-'
          }}</template></el-table-column
        ><el-table-column label="状态" width="110"
          ><template #default="scope"
            ><StatusTag :value="scope.row.status" /></template></el-table-column
        ><el-table-column label="文件" min-width="190"
          ><template #default="scope"
            ><a
              v-if="scope.row.versions[0]"
              :href="documentsApi.downloadUrl(scope.row.versions[0].id)"
              >{{ scope.row.versions[0].fileName }}</a
            ></template
          ></el-table-column
        ><el-table-column label="操作" width="300" fixed="right"
          ><template #default="scope"
            ><el-button
              v-if="auth.has(PERMISSIONS.DOCUMENT_UPLOAD)"
              link
              @click="openVersion(scope.row.id)"
              >新版本</el-button
            ><el-button
              v-if="
                ['DRAFT', 'REJECTED'].includes(scope.row.status) &&
                auth.has(PERMISSIONS.DOCUMENT_UPLOAD)
              "
              link
              type="primary"
              @click="submit(scope.row.id)"
              >提交审核</el-button
            ><el-button
              v-if="scope.row.status === 'PENDING_REVIEW' && auth.has(PERMISSIONS.DOCUMENT_REVIEW)"
              link
              type="success"
              @click="review(scope.row.id, 'APPROVED')"
              >通过</el-button
            ><el-button
              v-if="scope.row.status === 'PENDING_REVIEW' && auth.has(PERMISSIONS.DOCUMENT_REVIEW)"
              link
              type="danger"
              @click="review(scope.row.id, 'REJECTED')"
              >驳回</el-button
            ><el-button
              v-if="auth.has(PERMISSIONS.DOCUMENT_DELETE)"
              link
              type="danger"
              @click="remove(scope.row.id)"
              >删除</el-button
            ><el-button
              v-if="scope.row.status === 'APPROVED' && auth.has(PERMISSIONS.KNOWLEDGE_CREATE)"
              link
              @click="deposit(scope.row)"
              >沉淀知识</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog
      v-model="dialog"
      title="上传交付文档"
      width="min(560px,94vw)"
      destroy-on-close
      @closed="resetUploadForm"
      ><el-form label-position="top"
        ><el-form-item label="文档名称" required><el-input v-model.trim="form.name" /></el-form-item
        ><el-form-item label="版本" required
          ><el-input v-model.trim="form.version" placeholder="V1.0" /></el-form-item
        ><el-form-item label="说明"
          ><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item
        ><el-form-item
          ><el-checkbox v-model="form.required">设为项目结项必需交付物</el-checkbox></el-form-item
        ><el-form-item label="文件（最大 20MB）" required
          ><el-upload :auto-upload="false" :limit="1" :on-change="select"
            ><el-button>选择文件</el-button></el-upload
          ></el-form-item
        ></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!file || !form.name || !form.version"
          :loading="upload.isPending.value"
          @click="upload.mutate()"
          >上传</el-button
        ></template
      ></el-dialog
    ><el-dialog v-model="versionDialog" title="上传新版本" width="min(520px,94vw)" destroy-on-close
      ><el-form label-position="top"
        ><el-form-item label="版本号" required><el-input v-model.trim="version" /></el-form-item
        ><el-form-item label="文件" required
          ><el-upload :auto-upload="false" :limit="1" :on-change="selectVersion"
            ><el-button>选择文件</el-button></el-upload
          ></el-form-item
        ></el-form
      ><template #footer
        ><el-button @click="versionDialog = false">取消</el-button
        ><el-button type="primary" :disabled="!version || !versionFile" @click="addVersion"
          >上传版本</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
