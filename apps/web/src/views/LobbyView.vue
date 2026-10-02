<script setup lang="ts">
defineProps<{ code: string }>();
</script>

<template>
  <section class="panel">
    <h1>Lobby: {{ code }}</h1>
    <!-- TODO (етап 4): очікування другого гравця, розстановка кораблів -->
  </section>
</template>
