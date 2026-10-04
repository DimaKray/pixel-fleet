<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PlayerId } from '@pixelfleet/engine';
import type { Presence } from '@pixelfleet/protocol';
import { portraitSrc } from '@/lib/assets';
import { opponentPortrait } from '@/lib/avatars';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps<{ code: string; you: PlayerId; status: Presence; bot?: boolean }>();

const { t } = useI18n();
const settings = useSettingsStore();

// Бот завжди з'являється як робот; живого суперника визначає код кімнати.
const portrait = computed(() =>
  portraitSrc(props.bot ? 'robot' : opponentPortrait(props.code, props.you)),
);
const label = computed(() => (props.bot ? t('presence.bot') : t(`presence.${props.status}`)));

// Суперник зайшов у кімнату: короткий дзвінок.
watch(
  () => props.status,
  (next, previous) => {
    if (!props.bot && next === 'online' && previous !== 'online') settings.play('join');
  },
);
</script>

<template>
  <div class="badge" :class="`badge--${status}`" aria-live="polite">
    <span :key="status" class="badge__avatar">
      <img :src="portrait" alt="" />
      <span v-if="status !== 'online'" class="badge__mark" aria-hidden="true">
        {{ status === 'empty' ? '?' : '!' }}
      </span>
    </span>
    <span class="badge__text" :class="{ 'badge__text--wait': status === 'empty' }">
      {{ label }}
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.badge {
  display: inline-flex;
  gap: 12px;
  align-items: center;
  margin-left: auto;
  padding: 4px 16px 4px 4px;
  font-size: 13px;
  background: rgb(6 10 32 / 70%);
  border: 3px solid $color-teal-dark;

  &__avatar {
    position: relative;
    display: block;
    width: 46px;
    height: 46px;
    border: 3px solid $color-teal-dark;
    animation: pop-in 0.35s ease-out;

    img {
      display: block;
      width: 100%;
      height: 100%;
      image-rendering: pixelated;
    }
  }

  &__mark {
    position: absolute;
    right: -9px;
    bottom: -9px;
    padding: 0 4px;
    font-family: $font-pixel;
    font-size: 10px;
    line-height: 1.6;
    color: $color-teal-light;
    background: $color-ink;
    border: 2px solid currentcolor;
  }

  /* Нікого немає: темний силует і крапки, що біжать. */
  &--empty {
    .badge__avatar img {
      filter: brightness(0) opacity(0.45);
    }

    .badge__mark {
      animation: bob 1.4s ease-in-out infinite;
    }
  }

  &__text--wait::after {
    content: '';
    animation: dots 1.4s steps(1) infinite;
  }

  /* Суперник тут: зелена рамка, що пульсує. */
  &--online {
    border-color: $color-ok;

    .badge__avatar {
      border-color: $color-ok;
      animation:
        pop-in 0.35s ease-out,
        ping 1.8s ease-out 0.35s infinite;
    }
  }

  /* Втратив зв'язок: сірий портрет і рамка, що блимає. */
  &--offline {
    border-color: $color-orange;
    animation: blink 1s steps(2) infinite;

    .badge__avatar {
      border-color: $color-orange;
    }

    .badge__avatar img {
      filter: grayscale(1) brightness(0.7);
    }

    .badge__mark {
      color: $color-orange-light;
    }
  }
}

@keyframes pop-in {
  0% {
    opacity: 0;
    scale: 0.4;
  }

  60% {
    opacity: 1;
    scale: 1.2;
  }

  100% {
    scale: 1;
  }
}

@keyframes ping {
  from {
    box-shadow: 0 0 0 0 rgb(63 182 139 / 70%);
  }

  to {
    box-shadow: 0 0 0 12px rgb(63 182 139 / 0%);
  }
}

@keyframes dots {
  0% {
    content: '';
  }

  25% {
    content: '.';
  }

  50% {
    content: '..';
  }

  75% {
    content: '...';
  }
}

@keyframes bob {
  50% {
    translate: 0 -3px;
  }
}

@keyframes blink {
  50% {
    border-color: rgb(232 132 45 / 35%);
  }
}
</style>
