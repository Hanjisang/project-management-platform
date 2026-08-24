<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import PageHeader from '../../components/PageHeader.vue';
import { integrationsApi } from '../../api/integrations.api';
import { messagesApi } from '../../api/messages.api';

interface IntegrationStatus {
  status: string;
  configured: boolean;
}
const dingtalk = useQuery({
  queryKey: ['integration', 'dingtalk'],
  queryFn: () => integrationsApi.dingtalk() as Promise<IntegrationStatus>,
});
const zentao = useQuery({
  queryKey: ['integration', 'zentao'],
  queryFn: () => integrationsApi.zentao() as Promise<IntegrationStatus>,
});
const ai = useQuery({ queryKey: ['integration', 'ai'], queryFn: messagesApi.aiStatus });
</script>

<template>
  <div>
    <PageHeader
      title="集成接口"
      description="当前版本仅保留外部系统适配接口，核心项目管理流程不依赖任何外部集成"
    />
    <el-alert
      title="钉钉、禅道和 AI 当前均未启用真实连接"
      description="相关 Provider、数据字段和扩展点继续保留；后续启用时再配置实现与凭证。当前不会发送外部请求，也不会伪造成功结果。"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 14px"
    />
    <div class="integration-grid">
      <article class="panel integration-card">
        <header>
          <div class="integration-mark">钉</div>
          <div><h3>钉钉</h3><p>消息采集适配器预留</p></div>
        </header>
        <el-tag type="info" effect="light">预留接口 · 未启用</el-tag>
        <dl>
          <div><dt>当前状态</dt><dd>{{ dingtalk.data.value?.status ?? 'NOT_CONFIGURED' }}</dd></div>
          <div><dt>生产外呼</dt><dd>禁用</dd></div>
        </dl>
        <el-alert
          type="info"
          :closable="false"
          title="后续能力"
          description="可在后续版本接入群消息回调或其他正式授权的数据通道。"
        />
      </article>
      <article class="panel integration-card">
        <header>
          <div class="integration-mark">禅</div>
          <div><h3>禅道</h3><p>任务同步适配器预留</p></div>
        </header>
        <el-tag type="info" effect="light">预留接口 · 未启用</el-tag>
        <dl>
          <div><dt>当前状态</dt><dd>{{ zentao.data.value?.status ?? 'NOT_CONFIGURED' }}</dd></div>
          <div><dt>生产同步</dt><dd>禁用</dd></div>
        </dl>
        <el-alert
          type="info"
          :closable="false"
          title="后续能力"
          description="WorkItem 已保留外部同步扩展点，后续启用时无需恢复旧 Task 模型。"
        />
      </article>
      <article class="panel integration-card">
        <header>
          <div class="integration-mark">AI</div>
          <div><h3>AI</h3><p>消息、交付物和变更分析 Provider 预留</p></div>
        </header>
        <el-tag type="info" effect="light">预留接口 · 未启用</el-tag>
        <dl>
          <div><dt>当前状态</dt><dd>{{ ai.data.value?.configured ? 'CONFIGURED' : 'NOT_CONFIGURED' }}</dd></div>
          <div><dt>正式审核</dt><dd>人工审核</dd></div>
        </dl>
        <el-alert
          type="info"
          :closable="false"
          title="当前规则"
          description="交付物上传计 50%，人工审核通过计 100%；AI 不参与当前正式业务判定。"
        />
      </article>
    </div>
  </div>
</template>

<style scoped>
.integration-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.integration-card {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
}
.integration-card header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.integration-card h3 {
  margin: 0;
  font-size: 17px;
}
.integration-card p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}
.integration-mark {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  place-items: center;
  border-radius: 10px;
  color: white;
  background: var(--primary);
  font-weight: 800;
}
dl {
  display: grid;
  gap: 10px;
  margin: 0;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--border);
}
dt {
  color: var(--text-muted);
}
dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
.el-alert {
  margin-top: auto;
}
@media (max-width: 1100px) {
  .integration-grid {
    grid-template-columns: 1fr;
  }
  .integration-card {
    min-height: auto;
  }
}
</style>
