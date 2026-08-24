<script setup lang="ts">
import { ref } from 'vue';
import PageHeader from '../../components/PageHeader.vue';
import RemoteProjectSelect from '../../components/RemoteProjectSelect.vue';
import ProjectDocumentsPanel from '../projects/ProjectDocumentsPanel.vue';
const projectId = ref('');
</script>
<template>
  <div>
    <PageHeader title="交付文档" description="一个逻辑文档可包含多个不可覆盖的文件版本与审核记录" />
    <div class="filters">
      <RemoteProjectSelect
        v-model="projectId"
        placeholder="选择项目"
        style="width: min(420px, 100%)"
      />
    </div>
    <el-empty v-if="!projectId" description="请选择项目查看交付文档" />
    <div v-else class="panel panel-body"><ProjectDocumentsPanel :project-id="projectId" /></div>
  </div>
</template>
