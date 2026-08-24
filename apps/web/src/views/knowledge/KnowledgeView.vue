<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { knowledgeApi } from '../../api/knowledge.api';
import { useAuthStore } from '../../stores/auth';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import type { KnowledgeArticle } from '../../types/domain';
import type { KnowledgeStatus } from '@pmp/shared-types';
const auth = useAuthStore();
const client = useQueryClient();
const dialog = ref(false);
const editingId = ref('');
const drawer = ref(false);
const selected = ref<KnowledgeArticle>();
const filters = reactive({ search: '', categoryId: '', status: '' as KnowledgeStatus | '' });
const form = reactive({ categoryId: '', title: '', summary: '', content: '', tags: '' });
const categories = useQuery({
  queryKey: ['knowledge-categories'],
  queryFn: knowledgeApi.categories,
});
const query = useQuery({
  queryKey: computed(() => ['knowledge', { ...filters }]),
  queryFn: () => knowledgeApi.list(filters),
});
const create = useMutation({
  mutationFn: () =>
    editingId.value
      ? knowledgeApi.update(editingId.value, {
          ...form,
          tags: form.tags
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
        })
      : knowledgeApi.create({
          ...form,
          tags: form.tags
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
  onSuccess: async () => {
    ElMessage.success(editingId.value ? '知识草稿已更新' : '知识草稿已保存');
    dialog.value = false;
    editingId.value = '';
    Object.assign(form, { categoryId: '', title: '', summary: '', content: '', tags: '' });
    await client.invalidateQueries({ queryKey: ['knowledge'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function openCreate(): void {
  editingId.value = '';
  Object.assign(form, { categoryId: '', title: '', summary: '', content: '', tags: '' });
  dialog.value = true;
}
function edit(item: KnowledgeArticle): void {
  editingId.value = item.id;
  Object.assign(form, {
    categoryId: item.category.id,
    title: item.title,
    summary: item.summary ?? '',
    content: item.content,
    tags: item.tags?.join(', ') ?? '',
  });
  dialog.value = true;
}
async function remove(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除该知识文章？', '删除知识', { type: 'warning' });
  await knowledgeApi.remove(id);
  drawer.value = false;
  await client.invalidateQueries({ queryKey: ['knowledge'] });
}
async function createCategory(): Promise<void> {
  const { value } = await ElMessageBox.prompt('分类名称', '新增知识分类');
  await knowledgeApi.createCategory(value);
  await client.invalidateQueries({ queryKey: ['knowledge-categories'] });
}
async function removeAttachment(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除附件？', '删除附件', { type: 'warning' });
  await knowledgeApi.removeAttachment(id);
  if (selected.value) selected.value = await knowledgeApi.get(selected.value.id);
}
function open(item: KnowledgeArticle): void {
  selected.value = item;
  drawer.value = true;
}
async function submit(id: string): Promise<void> {
  await knowledgeApi.submit(id);
  ElMessage.success('已提交审核');
  await client.invalidateQueries({ queryKey: ['knowledge'] });
}
async function review(id: string, status: 'PUBLISHED' | 'REJECTED'): Promise<void> {
  let comment = '';
  if (status === 'REJECTED') {
    const result = await ElMessageBox.prompt('请输入驳回原因', '驳回知识文章');
    comment = result.value;
  }
  await knowledgeApi.review(id, status, comment);
  ElMessage.success(status === 'PUBLISHED' ? '文章已发布' : '文章已驳回');
  drawer.value = false;
  await client.invalidateQueries({ queryKey: ['knowledge'] });
}
async function uploadAttachment(file: UploadFile): Promise<void> {
  if (!selected.value || !file.raw) return;
  try {
    await knowledgeApi.uploadAttachment(selected.value.id, file.raw);
    selected.value = await knowledgeApi.get(selected.value.id);
    ElMessage.success('附件已上传');
    await client.invalidateQueries({ queryKey: ['knowledge'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>
<template>
  <div>
    <PageHeader title="知识库" description="已审核项目文档可沉淀为草稿，审核发布后供团队复用"
      ><el-button v-if="auth.has(PERMISSIONS.KNOWLEDGE_CREATE)" @click="createCategory"
        >新增分类</el-button
      ><el-button v-if="auth.has(PERMISSIONS.KNOWLEDGE_CREATE)" type="primary" @click="openCreate"
        >创建知识</el-button
      ></PageHeader
    >
    <div class="filters">
      <div class="filter-row">
        <el-input
          v-model="filters.search"
          clearable
          placeholder="搜索标题、摘要或内容"
          style="width: 260px"
        /><el-select v-model="filters.categoryId" clearable placeholder="分类" style="width: 170px"
          ><el-option
            v-for="item in categories.data.value ?? []"
            :key="item.id"
            :label="item.name"
            :value="item.id" /></el-select
        ><el-select v-model="filters.status" clearable placeholder="状态" style="width: 160px"
          ><el-option
            v-for="item in ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED']"
            :key="item"
            :label="item"
            :value="item"
        /></el-select>
      </div>
    </div>
    <ApiErrorView
      v-if="query.isError.value"
      :error="query.error.value"
      title="知识文章加载失败"
      @retry="query.refetch()"
    />
    <div v-else class="content-grid">
      <article
        v-for="item in query.data.value ?? []"
        :key="item.id"
        class="panel"
        style="cursor: pointer"
        tabindex="0"
        @click="open(item)"
        @keyup.enter="open(item)"
      >
        <div class="panel-body">
          <div style="display: flex; justify-content: space-between; gap: 12px">
            <el-tag effect="plain">{{ item.category.name }}</el-tag
            ><StatusTag :value="item.status" />
          </div>
          <h3>{{ item.title }}</h3>
          <p class="muted" style="line-height: 1.6">
            {{ item.summary || item.content.slice(0, 120) }}
          </p>
          <small class="muted"
            >{{ item.author.displayName }} ·
            {{ new Date(item.updatedAt).toLocaleDateString('zh-CN') }}</small
          >
        </div>
      </article>
    </div>
    <el-empty
      v-if="!query.isError.value && !query.data.value?.length"
      description="暂无知识文章"
    /><el-dialog
      v-model="dialog"
      :title="editingId ? '编辑知识草稿' : '创建知识草稿'"
      width="min(720px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="分类" required
          ><el-select v-model="form.categoryId" style="width: 100%"
            ><el-option
              v-for="item in categories.data.value ?? []"
              :key="item.id"
              :label="item.name"
              :value="item.id" /></el-select></el-form-item
        ><el-form-item label="标题" required><el-input v-model.trim="form.title" /></el-form-item
        ><el-form-item label="摘要"
          ><el-input v-model="form.summary" type="textarea" :rows="2" /></el-form-item
        ><el-form-item label="正文" required
          ><el-input v-model="form.content" type="textarea" :rows="10" /></el-form-item
        ><el-form-item label="标签（逗号分隔）"
          ><el-input v-model="form.tags" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!form.categoryId || !form.title || !form.content"
          :loading="create.isPending.value"
          @click="create.mutate()"
          >保存草稿</el-button
        ></template
      ></el-dialog
    ><el-drawer v-model="drawer" :title="selected?.title" size="min(720px,95vw)"
      ><template v-if="selected"
        ><div class="toolbar-actions" style="margin-bottom: 16px">
          <StatusTag :value="selected.status" /><el-button
            v-if="
              ['DRAFT', 'REJECTED'].includes(selected.status) &&
              auth.has(PERMISSIONS.KNOWLEDGE_CREATE)
            "
            type="primary"
            @click="submit(selected.id)"
            >提交审核</el-button
          ><el-button
            v-if="
              ['DRAFT', 'REJECTED'].includes(selected.status) &&
              auth.has(PERMISSIONS.KNOWLEDGE_CREATE)
            "
            @click="edit(selected)"
            >编辑</el-button
          ><el-button
            v-if="auth.has(PERMISSIONS.KNOWLEDGE_CREATE)"
            type="danger"
            plain
            @click="remove(selected.id)"
            >删除</el-button
          ><el-upload
            v-if="
              ['DRAFT', 'REJECTED'].includes(selected.status) &&
              (selected.author.id === auth.user?.id || auth.user?.isAdministrator)
            "
            :auto-upload="false"
            :show-file-list="false"
            :on-change="uploadAttachment"
            ><el-button>上传附件</el-button></el-upload
          ><template
            v-if="selected.status === 'PENDING_REVIEW' && auth.has(PERMISSIONS.KNOWLEDGE_REVIEW)"
            ><el-button type="success" @click="review(selected.id, 'PUBLISHED')"
              >通过并发布</el-button
            ><el-button type="danger" plain @click="review(selected.id, 'REJECTED')"
              >驳回</el-button
            ></template
          >
        </div>
        <p class="muted">{{ selected.summary }}</p>
        <div style="white-space: pre-wrap; line-height: 1.8">{{ selected.content }}</div>
        <section v-if="selected.attachments.length" style="margin-top: 24px">
          <h4>附件</h4>
          <div
            v-for="attachment in selected.attachments"
            :key="attachment.id"
            style="padding: 8px 0; border-top: 1px solid var(--border)"
          >
            <a :href="knowledgeApi.attachmentUrl(attachment.id)">{{ attachment.fileName }}</a
            ><el-button
              v-if="auth.has(PERMISSIONS.KNOWLEDGE_CREATE)"
              text
              type="danger"
              @click="removeAttachment(attachment.id)"
              >删除</el-button
            >
          </div>
        </section></template
      ></el-drawer
    >
  </div>
</template>
