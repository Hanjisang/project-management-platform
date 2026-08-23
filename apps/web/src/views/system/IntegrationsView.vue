<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import PageHeader from '../../components/PageHeader.vue';
import { integrationsApi } from '../../api/integrations.api';
import { messagesApi } from '../../api/messages.api';

interface IntegrationStatus {
  status: string;
  configured: boolean;
  capabilities?: string[];
  streamConfigured?: boolean;
  fullChatMonitoring?: boolean;
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
const stateType = (configured?: boolean) => (configured ? 'success' : 'info');
</script>

<template>
  <div>
    <PageHeader title="集成配置" description="仅展示连接状态；密钥通过服务端环境变量安全配置" />
    <div class="integration-grid">
      <article class="panel integration-card">
        <header>
          <div class="integration-mark">钉</div>
          <div>
            <h3>钉钉</h3>
            <p>机器人 @ 消息回调与手动导入</p>
          </div>
        </header>
        <el-tag :type="stateType(dingtalk.data.value?.configured)" effect="light">{{
          dingtalk.data.value?.configured ? '已配置' : '未配置'
        }}</el-tag>
        <dl>
          <div>
            <dt>Stream 模式</dt>
            <dd>{{ dingtalk.data.value?.streamConfigured ? '已启用' : '未启用' }}</dd>
          </div>
          <div>
            <dt>全量聊天监听</dt>
            <dd>不支持</dd>
          </div>
        </dl>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="能力边界"
          description="平台只接收机器人被 @ 的回调或人工导入内容，不声称能够监听全部群聊。"
        />
      </article>
      <article class="panel integration-card">
        <header>
          <div class="integration-mark">禅</div>
          <div>
            <h3>禅道</h3>
            <p>任务单向同步与状态追踪</p>
          </div>
        </header>
        <el-tag :type="stateType(zentao.data.value?.configured)" effect="light">{{
          zentao.data.value?.configured ? '已配置' : '未配置'
        }}</el-tag>
        <dl>
          <div>
            <dt>同步方向</dt>
            <dd>平台 → 禅道</dd>
          </div>
          <div>
            <dt>幂等保护</dt>
            <dd>已启用</dd>
          </div>
        </dl>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="配置方式"
          description="在 API 服务环境变量中设置 ZENTAO_BASE_URL 与访问令牌后生效。"
        />
      </article>
      <article class="panel integration-card">
        <header>
          <div class="integration-mark">AI</div>
          <div>
            <h3>AI 消息分析</h3>
            <p>结构化提取任务、问题与行动建议</p>
          </div>
        </header>
        <el-tag :type="stateType(ai.data.value?.configured)" effect="light">{{
          ai.data.value?.configured ? '已配置' : '未配置'
        }}</el-tag>
        <dl>
          <div>
            <dt>提供方</dt>
            <dd>{{ ai.data.value?.provider ?? 'openai-compatible' }}</dd>
          </div>
          <div>
            <dt>模型</dt>
            <dd>{{ ai.data.value?.model ?? '未指定' }}</dd>
          </div>
        </dl>
        <el-alert
          v-if="!ai.data.value?.configured"
          type="warning"
          :closable="false"
          show-icon
          title="当前未配置"
          description="消息仍可录入和查看；AI 分析按钮将返回明确的未配置提示，不会伪造分析结果。"
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
  min-height: 340px;
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
