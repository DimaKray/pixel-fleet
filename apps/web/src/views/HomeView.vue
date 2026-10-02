<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="panel">
    <h1>{{ t('home.title') }}</h1>
    <p>{{ t('home.subtitle') }}</p>
    <!-- TODO (етап 4): кнопки «Створити кімнату» / «Приєднатися за кодом» -->
  </section>
</template>
