<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { BOT_DIFFICULTIES } from '@pixelfleet/engine';
import type { BotDifficulty } from '@pixelfleet/engine';
import { portraits, portraitSrc } from '@/lib/assets';
import { useGameStore } from '@/stores/game';
import type { ClientError, SessionResult } from '@/stores/game';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const game = useGameStore();
const session = useSessionStore();

/** Випадковий капітан зустрічає гравця на головній. */
const captain = portraitSrc(portraits[Math.floor(Math.random() * portraits.length)] ?? 'captain');

/** Запрошення виглядає як /?join=ABCDE і підставляє код у поле. */
const joinCode = ref(
  typeof route.query.join === 'string' ? route.query.join.toUpperCase().slice(0, 5) : '',
);
const busy = ref(true);
const error = ref<ClientError | null>(null);

async function finish(result: SessionResult): Promise<void> {
  if (result.ok) {
    await router.push({ name: 'lobby', params: { code: result.code } });
    return;
  }
  error.value = result.error;
  busy.value = false;
}

async function create(): Promise<void> {
  busy.value = true;
  error.value = null;
  await finish(await game.createRoom());
}

async function join(): Promise<void> {
  busy.value = true;
  error.value = null;
  await finish(await game.joinRoom(joinCode.value));
}

async function startBot(difficulty: BotDifficulty): Promise<void> {
  busy.value = true;
  error.value = null;
  await finish(await game.createBotRoom(difficulty));
}

onMounted(async () => {
  // Перезавантажили сторінку посеред гри: повертаємось у свою кімнату.
  if (session.playerToken) {
    const result = await game.resume();
    if (result.ok) {
      await router.replace({ name: 'lobby', params: { code: result.code } });
      return;
    }
  }
  busy.value = false;
});
</script>

<template>
  <section class="hero">
    <div class="frame hero__panel">
      <img class="hero__captain" :src="captain" alt="" />

      <div class="stack">
        <h1 class="hero__title">{{ t('home.title') }}</h1>
        <p>{{ t('home.subtitle') }}</p>

        <p v-if="busy && !error">{{ t('home.loading') }}</p>

        <template v-else>
          <button type="button" class="btn btn--primary btn--big" :disabled="busy" @click="create">
            {{ t('home.create') }}
          </button>

          <label class="divider" for="room-code">{{ t('home.codeLabel') }}</label>
          <div class="row">
            <input
              id="room-code"
              v-model="joinCode"
              class="input"
              maxlength="5"
              autocomplete="off"
              autocapitalize="characters"
              :placeholder="t('home.codePlaceholder')"
              @keyup.enter="join"
            />
            <button type="button" class="btn" :disabled="busy || joinCode.length < 5" @click="join">
              {{ t('home.join') }}
            </button>
          </div>

          <p class="divider">{{ t('home.botLabel') }}</p>
          <div class="row">
            <button
              v-for="level in BOT_DIFFICULTIES"
              :key="level"
              type="button"
              class="btn"
              :disabled="busy"
              @click="startBot(level)"
            >
              {{ t(`bot.${level}`) }}
            </button>
          </div>
        </template>

        <p v-if="error" class="error" role="alert">{{ t(`errors.${error.code}`) }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.hero {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 16px;

  &__panel {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 32px;
    align-items: center;
    width: min(100%, 820px);
    background-color: rgb(6 10 32 / 40%);

    @media (width <= 720px) {
      grid-template-columns: 1fr;
      justify-items: center;
      gap: 16px;
      text-align: center;
    }
  }

  &__captain {
    width: 198px;
    height: 198px;
    image-rendering: pixelated;
    border: 4px solid $color-teal-dark;
    box-shadow:
      0 0 0 4px $color-ink,
      0 10px 24px rgb(0 0 0 / 50%);

    @media (width <= 720px) {
      width: 132px;
      height: 132px;
    }
  }

  &__title {
    font-size: 28px;
    line-height: 1.3;

    @media (width <= 720px) {
      font-size: 20px;
    }
  }
}
</style>
