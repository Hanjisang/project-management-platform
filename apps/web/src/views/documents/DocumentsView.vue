<script setup lang="ts">
import { ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { projectsApi } from '../../api/projects.api';
import PageHeader from '../../components/PageHeader.vue';
import ProjectDocumentsPanel from '../projects/ProjectDocumentsPanel.vue';
const projectId = ref('');
const projects = useQuery({
  queryKey: ['projects', 'document-selector'],
  queryFn: () => projectsApi.list({ pageSize: 100 }),
});
</script>
<template>
  <div>
    <PageHeader title="交付文档" description="一个逻辑文档可包含多个不可覆盖的文件版本与审核记录" />
    <div class="filters">
      <el-select
        v-model="projectId"
        filterable
        placeholder="选择项目"
        style="width: min(420px, 100%)"
        ><el-option
          v-for="project in projects.data.value?.items ?? []"
          :key="project.id"
          :label="`${project.code} · ${project.name}`"
          :value="project.id"
      /></el-select>
    </div>
    <el-empty v-if="!projectId" description="请选择项目查看交付文档" />
    <div v-else class="panel panel-body"><ProjectDocumentsPanel :project-id="projectId" /></div>
  </div>
</template>
