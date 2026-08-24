import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import 'element-plus/theme-chalk/el-message.css';
import 'element-plus/theme-chalk/el-message-box.css';
import './styles/main.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(VueQueryPlugin, {
  queryClient: new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  }),
});
app.use(router);
app.mount('#app');
