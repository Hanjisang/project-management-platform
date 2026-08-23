import { api } from './client';
export const integrationsApi = {
  dingtalk: async () => (await api.get('/integrations/dingtalk/status')).data,
  zentao: async () => (await api.get('/integrations/zentao/status')).data,
  syncTask: async (id: string) => (await api.post(`/integrations/zentao/tasks/${id}/sync`)).data,
};
