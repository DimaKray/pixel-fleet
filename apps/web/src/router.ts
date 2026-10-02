import { createRouter, createWebHistory } from 'vue-router';
import GameView from './views/GameView.vue';
import HomeView from './views/HomeView.vue';
import LobbyView from './views/LobbyView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/room/:code', name: 'lobby', component: LobbyView, props: true },
    { path: '/game/:code', name: 'game', component: GameView, props: true },
  ],
});
