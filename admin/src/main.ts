import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { startThemeSystem } from './lib/theme';
import './styles/admin.css';

// 首屏同步应用主题（防闪白），并启动系统主题变化监听
startThemeSystem();

createApp(App).use(router).mount('#app');
