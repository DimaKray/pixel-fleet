import '@fontsource/press-start-2p';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import { router } from './router';
import './styles/main.scss';

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app');
