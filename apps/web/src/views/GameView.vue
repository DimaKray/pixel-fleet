<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { isSunk } from '@pixelfleet/engine';
import type { Coord } from '@pixelfleet/engine';
import BoardGrid from '@/components/BoardGrid.vue';
import { ui } from '@/lib/assets';
import { gameStatus } from '@/lib/status';
import { useGameStore } from '@/stores/game';
import type { ClientError } from '@/stores/game';

const props = defineProps<{ code: string }>();

const { t } = useI18n();
const router = useRouter();
const game = useGameStore();

const loading = ref(true);
const busy = ref(false);
const error = ref<ClientError | null>(null);

onMounted(async () => {
  if (game.code === null) {
    const result = await game.resume();
    if (!result.ok) {
      await router.replace({ name: 'home' });
      return;
    }
    if (result.code !== props.code) {
      await router.replace({ name: 'game', params: { code: result.code } });
    }
  }
  loading.value = false;
});

// Сесію втрачено: назад на головну.
watch(
  () => game.code,
  (code) => {
    if (code === null && !loading.value) void router.replace({ name: 'home' });
  },
);

// Відкрили екран бою, поки розстановка ще триває: повертаємось у лобі.
watch(
  () => game.view?.phase,
  (phase) => {
    if (phase === 'placement') void router.replace({ name: 'lobby', params: { code: props.code } });
  },
  { immediate: true },
);

const view = computed(() => game.view);
const status = computed(() => (view.value ? gameStatus(view.value) : 'waiting'));
const finished = computed(() => status.value === 'won' || status.value === 'lost');
const canFire = computed(() => status.value === 'your_turn' && !busy.value);

const statusText = computed(() => {
  const current = view.value;
  if (!current) return '';
  if (current.endReason === 'resigned' && (status.value === 'won' || status.value === 'lost')) {
    return t(`game.${status.value}_resigned`);
  }
  return t(`game.${status.value}`);
});

/** Корабель суперника видно лише потопленим, а після кінця гри весь флот. */
const enemyShips = computed(
  () => view.value?.opponentFleet ?? view.value?.opponentBoard?.sunkShips ?? [],
);

const ownShips = computed(() => view.value?.ownBoard?.ships ?? []);
const ownShots = computed(() => view.value?.ownBoard?.shots ?? []);
const enemyShots = computed(() => view.value?.opponentBoard?.shots ?? []);

const ownRemaining = computed(
  () => ownShips.value.filter((ship) => !isSunk(ship, ownShots.value)).length,
);
const enemyRemaining = computed(() => view.value?.opponentBoard?.shipsRemaining ?? 0);

const errorText = computed(() => (error.value ? t(`errors.${error.value.code}`) : ''));

async function onFire(cell: Coord): Promise<void> {
  if (!canFire.value) return;
  if (enemyShots.value.some((shot) => shot.at.x === cell.x && shot.at.y === cell.y)) return;

  busy.value = true;
  error.value = null;
  const reply = await game.fire(cell.x, cell.y);
  busy.value = false;
  if (!reply.ok) error.value = reply.error;
}

async function resign(): Promise<void> {
  if (!window.confirm(t('game.resignConfirm'))) return;
  error.value = null;
  const reply = await game.resign();
  if (!reply.ok) error.value = reply.error;
}

function backToMenu(): void {
  game.leave();
  void router.replace({ name: 'home' });
}
</script>

<template>
  <section v-if="loading || !view" class="panel panel--wide">{{ t('lobby.loading') }}</section>

  <section v-else class="panel panel--wide stack">
    <header class="row row--between">
      <h1>{{ t('game.title') }} {{ code }}</h1>
      <span>{{ t(`presence.${game.opponentPresence}`) }}</span>
    </header>

    <figure v-if="finished" class="banner">
      <img :src="status === 'won' ? ui.bannerWin : ui.bannerLose" alt="" />
      <figcaption class="banner__text">{{ statusText }}</figcaption>
    </figure>

    <p
      v-else
      class="status"
      :class="{ 'status--active': status === 'your_turn' }"
      aria-live="polite"
    >
      {{ statusText }}
    </p>

    <div class="boards">
      <section class="boards__item">
        <h2>{{ t('board.own') }}</h2>
        <BoardGrid :label="t('board.own')" :ships="ownShips" :shots="ownShots" />
        <p>{{ t('game.yourFleet') }}: {{ ownRemaining }} {{ t('game.remaining') }}</p>
      </section>

      <section class="boards__item">
        <h2>{{ t('game.opponentBoard') }}</h2>
        <BoardGrid
          :label="t('game.opponentBoard')"
          :ships="enemyShips"
          :shots="enemyShots"
          :interactive="canFire"
          @cell="onFire"
        />
        <p>{{ t('game.enemyFleet') }}: {{ enemyRemaining }} {{ t('game.remaining') }}</p>
      </section>
    </div>

    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>

    <div class="actions">
      <button v-if="!finished" type="button" class="btn btn--ghost" @click="resign">
        {{ t('game.resign') }}
      </button>
      <button v-else type="button" class="btn" @click="backToMenu">
        {{ t('game.backToMenu') }}
      </button>
    </div>
  </section>
</template>
