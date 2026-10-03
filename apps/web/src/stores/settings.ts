import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SoundName } from '@/lib/cues';
import { playCues } from '@/lib/sound';

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

  /** Один короткий звук інтерфейсу (клік, постановка корабля тощо). */
  function play(name: SoundName): void {
    playCues([{ name, delayMs: 0 }], muted.value);
  }

  return { muted, toggleMute, play };
});
