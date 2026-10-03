<script setup lang="ts">
import { FLEET } from '@pixelfleet/engine';
import type { ShipType } from '@pixelfleet/engine';
import { shipSprites } from '@/lib/assets';

defineProps<{ label: string; sunk: readonly ShipType[] }>();
</script>

<template>
  <ul class="fleet" :aria-label="label">
    <li
      v-for="entry in FLEET"
      :key="entry.type"
      class="fleet__ship"
      :class="{ 'fleet__ship--sunk': sunk.includes(entry.type) }"
    >
      <img
        :src="shipSprites[entry.type].side"
        alt=""
        :style="{ width: `calc(var(--cell) * ${entry.size * 0.45})` }"
      />
    </li>
  </ul>
</template>

<style scoped lang="scss">
.fleet {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;

  &__ship img {
    display: block;
    height: auto;
    filter: drop-shadow(0 2px 0 rgb(0 0 0 / 40%));
  }

  &__ship--sunk img {
    opacity: 0.35;
    filter: grayscale(1) brightness(0.6);
  }
}
</style>
