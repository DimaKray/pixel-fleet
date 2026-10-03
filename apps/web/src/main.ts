import '@fontsource/press-start-2p';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import { createPinia } from 'pinia';
import { createApp, watch } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import { setAudioActive, startAmbience, stopAmbience, unlockAudio } from './lib/sound';
import { router } from './router';
import { useSettingsStore } from './stores/settings';
import './styles/main.scss';

const pinia = createPinia();
createApp(App).use(pinia).use(router).use(i18n).mount('#app');

const settings = useSettingsStore(pinia);

/** Браузер вмикає звук лише після першої дії користувача. */
function onFirstGesture(): void {
  unlockAudio();
  if (!settings.muted) startAmbience();
}
window.addEventListener('pointerdown', onFirstGesture, { once: true });
window.addEventListener('keydown', onFirstGesture, { once: true });

watch(
  () => settings.muted,
  (muted) => (muted ? stopAmbience() : startAmbience()),
);

document.addEventListener('visibilitychange', () => setAudioActive(!document.hidden));

// Звук натискання для будь-якої кнопки, крім клітинок поля (у них свої звуки).
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || button.disabled || button.classList.contains('board__cell')) return;
  settings.play('click');
});
