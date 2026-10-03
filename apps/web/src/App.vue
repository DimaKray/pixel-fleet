<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { backgrounds, icons } from '@/lib/assets';

const { locale } = useI18n();
const route = useRoute();

const isHome = computed(() => route.name === 'home');
const scene = computed(() => (isHome.value ? backgrounds.menu : backgrounds.battle));

function toggleLocale() {
  locale.value = locale.value === 'uk' ? 'en' : 'uk';
  document.documentElement.lang = locale.value;
}
</script>

<template>
  <div
    class="scene"
    :class="{ 'scene--menu': isHome }"
    :style="{ backgroundImage: `url(${scene})` }"
    aria-hidden="true"
  />
  <header class="topbar">
    <span class="topbar__logo"><img :src="icons.anchor" alt="" />Pixel Fleet</span>
    <button class="btn btn--small" type="button" @click="toggleLocale">
      {{ locale.toUpperCase() }}
    </button>
  </header>
  <main>
    <RouterView />
  </main>
</template>
