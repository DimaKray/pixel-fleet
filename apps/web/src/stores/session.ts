import { defineStore } from 'pinia';
import { ref } from 'vue';

const KEY = 'pf:token';

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Токен гравця для реконнекту. sessionStorage окремий для кожної вкладки. */
export const useSessionStore = defineStore('session', () => {
  const playerToken = ref<string | null>(read());

  function setToken(token: string): void {
    playerToken.value = token;
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      // приватний режим: тоді реконнект після перезавантаження не працюватиме
    }
  }

  function clearToken(): void {
    playerToken.value = null;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ігноруємо
    }
  }

  return { playerToken, setToken, clearToken };
});
