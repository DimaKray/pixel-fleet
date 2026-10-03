<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { PlacedShip } from '@pixelfleet/engine';
import BoardGrid from '@/components/BoardGrid.vue';
import PlacementBoard from '@/components/PlacementBoard.vue';
import { useGameStore } from '@/stores/game';
import type { ClientError } from '@/stores/game';

const props = defineProps<{ code: string }>();

const { t } = useI18n();
const router = useRouter();
const game = useGameStore();

const loading = ref(true);
const busy = ref(false);
const error = ref<ClientError | null>(null);
const copied = ref(false);

onMounted(async () => {
  if (game.code === null) {
    const result = await game.resume();
    if (!result.ok) {
      await router.replace({ name: 'home' });
      return;
    }
    if (result.code !== props.code) {
      await router.replace({ name: 'lobby', params: { code: result.code } });
    }
  }
  loading.value = false;
});

// Сесію втрачено (наприклад, сервер перезапустили): назад на головну.
watch(
  () => game.code,
  (code) => {
    if (code === null && !loading.value) void router.replace({ name: 'home' });
  },
);

// Обидва готові: переходимо до бою (екран бою зробимо в наступному кроці).
watch(
  () => game.view?.phase,
  (phase) => {
    if (phase === 'battle' || phase === 'finished') {
      void router.push({ name: 'game', params: { code: props.code } });
    }
  },
  { immediate: true },
);

const errorText = computed(() => (error.value ? t(`errors.${error.value.code}`) : ''));

const waitText = computed(() => {
  if (game.opponentPresence === 'empty') return t('lobby.waitEmpty');
  if (game.opponentPresence === 'offline') return t('lobby.waitOffline');
  return t('lobby.waitPlacing');
});

async function submit(ships: PlacedShip[]): Promise<void> {
  busy.value = true;
  error.value = null;
  const reply = await game.placeFleet(ships);
  busy.value = false;
  if (!reply.ok) error.value = reply.error;
}

async function copyInvite(): Promise<void> {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/?join=${props.code}`);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // clipboard недоступний (наприклад, http не на localhost): код видно на екрані
  }
}

function leave(): void {
  game.leave();
  void router.replace({ name: 'home' });
}
</script>

<template>
  <section v-if="loading" class="panel">{{ t('lobby.loading') }}</section>

  <section v-else class="panel stack">
    <header class="row row--between">
      <h1>{{ t('lobby.title') }} {{ code }}</h1>
      <span class="row">
        <button type="button" class="btn btn--ghost" @click="copyInvite">
          {{ copied ? t('lobby.copied') : t('lobby.copyLink') }}
        </button>
        <button type="button" class="btn btn--ghost" @click="leave">{{ t('lobby.leave') }}</button>
      </span>
    </header>

    <p aria-live="polite">{{ t(`presence.${game.opponentPresence}`) }}</p>

    <PlacementBoard
      v-if="game.view && !game.view.ownBoard"
      :busy="busy"
      :error-text="errorText"
      @ready="submit"
    />

    <template v-else-if="game.view?.ownBoard">
      <BoardGrid :label="t('board.own')" :ships="game.view.ownBoard.ships" />
      <p aria-live="polite">{{ waitText }}</p>
    </template>
  </section>
</template>
