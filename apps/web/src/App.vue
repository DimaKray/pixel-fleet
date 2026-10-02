<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

function toggleLocale() {
  locale.value = locale.value === 'uk' ? 'en' : 'uk';
  document.documentElement.lang = locale.value;
}
</script>

<template>
  <header class="topbar">
    <span class="topbar__logo">Pixel Fleet</span>
    <button class="btn" type="button" @click="toggleLocale">{{ locale.toUpperCase() }}</button>
  </header>
  <main>
    <RouterView />
  </main>
</template>
