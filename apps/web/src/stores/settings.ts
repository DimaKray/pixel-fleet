import { defineStore } from 'pinia';
import { ref } from 'vue';

const KEY = 'pf:muted';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    // приватний режим: налаштування просто не збережеться
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const muted = ref(read());

  function toggleMute(): void {
    muted.value = !muted.value;
    write(muted.value);
  }

  return { muted, toggleMute };
});
