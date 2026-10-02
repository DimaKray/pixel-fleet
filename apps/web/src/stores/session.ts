import { defineStore } from 'pinia';
import { ref } from 'vue';

/** Тут житиме токен гравця для реконнекту (етап 5). */
export const useSessionStore = defineStore('session', () => {
  const playerToken = ref<string | null>(sessionStorage.getItem('playerToken'));

  function setToken(token: string) {
    playerToken.value = token;
    sessionStorage.setItem('playerToken', token);
  }

  return { playerToken, setToken };
});
