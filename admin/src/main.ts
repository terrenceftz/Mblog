import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { startThemeSystem } from './lib/theme';
// 自定义 token 先行，Tabler（Bootstrap 5.3）皮肤后加载——
// 让 Tabler 接管 .card/.btn/.table/.badge 等组件样式，全局换肤
import './styles/admin.css';
import '@tabler/core/dist/css/tabler.min.css';

// 首屏同步应用主题（防闪白），并启动系统主题变化监听
startThemeSystem();

createApp(App).use(router).mount('#app');
