<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { documentsApi } from '../../api/documents.api';
import StatusTag from '../../components/StatusTag.vue';
const props = defineProps<{ projectId: string }>();
const client = useQueryClient();
const dialog = ref(false);
const file = ref<File>();
const form = reactive({ name: '', description: '', version: 'V1.0', required: false });
const query = useQuery({
  queryKey: ['documents', props.projectId],
  queryFn: () => documentsApi.list(props.projectId),
});
const upload = useMutation({
  mutationFn: async () => {
    const data = new FormData();
    data.set('file', file.value!);
    data.set('name', form.name);
    data.set('description', form.description);
    data.set('version', form.version);
    data.set('required', String(form.required));
    return documentsApi.upload(props.projectId, data);
  },
  onSuccess: async () => {
    ElMessage.success('文档已上传');
    dialog.value = false;
    file.value = undefined;
    await client.invalidateQueries({ queryKey: ['documents', props.projectId] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function select(uploadFile: { raw?: File }): void {
  file.value = uploadFile.raw;
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
  await client.invalidateQueries({ queryKey: ['documents', props.projectId] });
}
</script>
<template>
  <div>
    <div class="page-toolbar">
      <div>
        <h2 style="font-size: 16px">交付文档</h2>
        <p>逻辑文档、文档版本与审核记录分离管理</p>
      </div>
      <el-button type="primary" @click="dialog = true">上传文档</el-button>
    </div>
    <div class="table-wrap">
      <el-table :data="query.data.value ?? []"
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
        ><el-table-column label="操作" width="170" fixed="right"
          ><template #default="scope"
            ><el-button link type="success" @click="review(scope.row.id, 'APPROVED')"
              >通过</el-button
            ><el-button link type="danger" @click="review(scope.row.id, 'REJECTED')"
              >驳回</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog v-model="dialog" title="上传交付文档" width="min(560px,94vw)"
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
    >
  </div>
</template>
