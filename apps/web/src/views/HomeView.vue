<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game';
import type { ClientError, SessionResult } from '@/stores/game';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const game = useGameStore();
const session = useSessionStore();

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
  <section class="panel stack">
    <h1>{{ t('home.title') }}</h1>
    <p>{{ t('home.subtitle') }}</p>

    <p v-if="busy && !error">{{ t('home.loading') }}</p>

    <template v-else>
      <button type="button" class="btn" :disabled="busy" @click="create">
        {{ t('home.create') }}
      </button>

      <label class="stack">
        <span>{{ t('home.codeLabel') }}</span>
        <span class="row">
          <input
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
        </span>
      </label>
    </template>

    <p v-if="error" class="error" role="alert">{{ t(`errors.${error.code}`) }}</p>
  </section>
</template>
