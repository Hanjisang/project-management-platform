<script setup lang="ts">
import { computed, ref } from 'vue';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import PageHeader from '../../components/PageHeader.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import { systemApi } from '../../api/system.api';

const page = ref(1);
const pageSize = ref(20);
const query = useQuery({
  queryKey: computed(() => ['audit', page.value, pageSize.value]),
  queryFn: () => systemApi.audit({ page: page.value, pageSize: pageSize.value }),
  placeholderData: keepPreviousData,
});
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
</script>

<template>
  <div>
    <PageHeader title="审计日志" description="记录关键写操作、操作者、资源与请求标识，便于追溯" />
    <ApiErrorView
      v-if="query.isError.value"
      :error="query.error.value"
      title="审计日志加载失败"
      @retry="query.refetch()"
    />
    <div v-else class="panel table-wrap">
      <el-table v-loading="query.isLoading.value" :data="query.data.value?.items ?? []">
        <el-table-column label="时间" min-width="170"
          ><template #default="scope">{{
            formatTime(scope.row.createdAt)
          }}</template></el-table-column
        >
        <el-table-column prop="action" label="操作" min-width="180"
          ><template #default="scope"
            ><code>{{ scope.row.action }}</code></template
          ></el-table-column
        >
        <el-table-column prop="resourceType" label="资源类型" min-width="130" />
        <el-table-column prop="resourceId" label="资源 ID" min-width="210" show-overflow-tooltip />
        <el-table-column label="操作者" min-width="130"
          ><template #default="scope">{{
            scope.row.user?.displayName ?? '系统'
          }}</template></el-table-column
        >
        <el-table-column prop="ipAddress" label="来源 IP" min-width="140" />
        <el-table-column prop="requestId" label="请求 ID" min-width="220" show-overflow-tooltip />
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="query.data.value?.total ?? 0"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
code {
  color: #1e40af;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}
</style>
