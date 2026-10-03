<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { backgrounds, icons } from '@/lib/assets';
import { useSettingsStore } from '@/stores/settings';

const { locale, t } = useI18n();
const route = useRoute();
const settings = useSettingsStore();

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
    <span class="row">
      <button
        class="btn btn--small"
        type="button"
        :aria-label="settings.muted ? t('sound.off') : t('sound.on')"
        @click="settings.toggleMute()"
      >
        <img :src="settings.muted ? icons.soundOff : icons.soundOn" alt="" />
      </button>
      <button class="btn btn--small" type="button" @click="toggleLocale">
        {{ locale.toUpperCase() }}
      </button>
    </span>
  </header>
  <main>
    <RouterView />
  </main>
</template>
