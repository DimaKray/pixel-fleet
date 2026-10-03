<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { isSunk } from '@pixelfleet/engine';
import type { Coord, ShipType } from '@pixelfleet/engine';
import BoardGrid from '@/components/BoardGrid.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FleetStatus from '@/components/FleetStatus.vue';
import PresenceBadge from '@/components/PresenceBadge.vue';
import { icons, ui } from '@/lib/assets';
import { gameStatus } from '@/lib/status';
import { useGameStore } from '@/stores/game';
import type { ClientError } from '@/stores/game';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps<{ code: string }>();

const { t } = useI18n();
const router = useRouter();
const game = useGameStore();
const settings = useSettingsStore();

const loading = ref(true);
const busy = ref(false);
const error = ref<ClientError | null>(null);

// Годинник для зворотного відліку: оновлюємо кілька разів на секунду.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 250);

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

onUnmounted(() => {
  clearInterval(ticker);
  clearTimeout(shakeTimer);
  clearTimeout(toastTimer);
});

// Сесію втрачено: назад на головну.
watch(
  () => game.code,
  (code) => {
    if (code === null && !loading.value) void router.replace({ name: 'home' });
  },
);

// Почався реванш: знову розстановка, тож повертаємось у лобі.
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
  if (finished.value && current.endReason && current.endReason !== 'all_sunk') {
    return t(`game.${status.value}_${current.endReason}`);
  }
  return t(`game.${status.value}`);
});

const secondsLeft = computed(() =>
  game.turnDeadline === null
    ? null
    : Math.max(0, Math.ceil((game.turnDeadline - now.value) / 1000)),
);

/** Корабель суперника видно лише потопленим, а після кінця гри весь флот. */
const enemyShips = computed(
  () => view.value?.opponentFleet ?? view.value?.opponentBoard?.sunkShips ?? [],
);

const ownShips = computed(() => view.value?.ownBoard?.ships ?? []);
const ownShots = computed(() => view.value?.ownBoard?.shots ?? []);
const enemyShots = computed(() => view.value?.opponentBoard?.shots ?? []);

// Поле трясеться, коли в нас влучили або потопили корабель.
const shaking = ref(false);
let shakeTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => ownShots.value.length,
  (length, previous) => {
    if (length <= previous || ownShots.value.at(-1)?.outcome === 'miss') return;
    shaking.value = true;
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => (shaking.value = false), 450);
  },
);

const ownSunk = computed(() =>
  ownShips.value.filter((ship) => isSunk(ship, ownShots.value)).map((ship) => ship.type),
);
const enemySunk = computed(
  () => view.value?.opponentBoard?.sunkShips.map((ship) => ship.type) ?? [],
);

// Велике оголошення, коли потоплено корабель (мій або суперника).
const toast = ref<{ side: 'enemy' | 'own'; ship: ShipType } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function announce(side: 'enemy' | 'own', next: ShipType[], previous: ShipType[]): void {
  const ship = next.find((type) => !previous.includes(type));
  if (!ship) return;
  toast.value = { side, ship };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2400);
}

watch(enemySunk, (next, previous) => announce('enemy', next, previous));
watch(ownSunk, (next, previous) => announce('own', next, previous));

const ownRemaining = computed(() => ownShips.value.length - ownSunk.value.length);
const enemyRemaining = computed(() => view.value?.opponentBoard?.shipsRemaining ?? 0);

const ownFleetLabel = computed(
  () => `${t('game.yourFleet')}: ${ownRemaining.value} ${t('game.remaining')}`,
);
const enemyFleetLabel = computed(
  () => `${t('game.enemyFleet')}: ${enemyRemaining.value} ${t('game.remaining')}`,
);

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

const confirmingResign = ref(false);

// Гра закінчилась, поки вікно відкрите (суперник здався чи програв): закриваємо його.
watch(finished, (isFinished) => {
  if (isFinished) confirmingResign.value = false;
});

/** Тихий «клац», коли приціл переходить на іншу клітинку. */
function onAim(cell: Coord | null): void {
  if (cell && canFire.value) settings.play('aim');
}

async function resign(): Promise<void> {
  confirmingResign.value = false;
  error.value = null;
  const reply = await game.resign();
  if (!reply.ok) error.value = reply.error;
}

async function rematch(): Promise<void> {
  error.value = null;
  const reply = await game.requestRematch();
  if (!reply.ok) error.value = reply.error;
}

function backToMenu(): void {
  game.leave();
  void router.replace({ name: 'home' });
}
</script>

<template>
  <section v-if="loading || !view" class="screen">
    <div class="frame">{{ t('lobby.loading') }}</div>
  </section>

  <section v-else class="screen screen--game">
    <div class="frame stack">
      <header class="topline">
        <div class="room">
          <small>{{ t('game.title') }}</small>
          <strong>{{ code }}</strong>
        </div>

        <PresenceBadge :code="code" :you="game.player ?? 'a'" :status="game.opponentPresence" />

        <button
          v-if="!finished"
          type="button"
          class="btn btn--small"
          @click="confirmingResign = true"
        >
          <img :src="icons.surrender" alt="" />{{ t('game.resign') }}
        </button>
      </header>

      <figure v-if="finished" class="banner">
        <img :src="status === 'won' ? ui.bannerWin : ui.bannerLose" alt="" />
        <figcaption class="banner__text">{{ statusText }}</figcaption>
      </figure>

      <div v-else class="statusbar" :class="`statusbar--${status}`" aria-live="polite">
        <span>{{ statusText }}</span>
        <span
          v-if="secondsLeft !== null"
          class="statusbar__timer"
          :class="{ 'statusbar__timer--low': secondsLeft <= 10 }"
        >
          <img :src="icons.timer" alt="" />{{ t('game.timer', { seconds: secondsLeft }) }}
        </span>
      </div>

      <div class="sides">
        <section class="side" :class="{ 'side--shake': shaking }">
          <h2>{{ t('board.own') }}</h2>
          <BoardGrid
            :label="t('board.own')"
            :ships="ownShips"
            :shots="ownShots"
            :active="status === 'opponent_turn'"
          />
          <FleetStatus :label="ownFleetLabel" :sunk="ownSunk" />
        </section>

        <section class="side">
          <h2>{{ t('game.opponentBoard') }}</h2>
          <BoardGrid
            :label="t('game.opponentBoard')"
            :ships="enemyShips"
            :shots="enemyShots"
            :interactive="canFire"
            :active="status === 'your_turn'"
            aim
            @cell="onFire"
            @hover="onAim"
          />
          <FleetStatus :label="enemyFleetLabel" :sunk="enemySunk" />
        </section>
      </div>

      <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>

      <div v-if="finished" class="stack">
        <p v-if="game.rematch.opponent && !game.rematch.you" aria-live="polite">
          {{ t('game.rematchOffered') }}
        </p>
        <p v-else-if="game.rematch.you" aria-live="polite">{{ t('game.rematchWaiting') }}</p>

        <div class="row">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="game.rematch.you"
            @click="rematch"
          >
            {{ t('game.rematch') }}
          </button>
          <button type="button" class="btn" @click="backToMenu">{{ t('game.backToMenu') }}</button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmingResign"
      :title="t('game.resignConfirm')"
      :text="t('game.resignText')"
      :confirm-label="t('game.resign')"
      :cancel-label="t('game.resignCancel')"
      @confirm="resign"
      @cancel="confirmingResign = false"
    />

    <Transition name="toast">
      <div v-if="toast" class="toast" :class="`toast--${toast.side}`" role="status">
        {{
          t(toast.side === 'enemy' ? 'game.sunkEnemy' : 'game.sunkOwn', {
            ship: t(`ships.${toast.ship}`),
          })
        }}
      </div>
    </Transition>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.statusbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-family: $font-pixel;
  font-size: 12px;
  line-height: 1.5;
  text-transform: uppercase;
  background: rgb(6 10 32 / 80%);
  border: 3px solid $color-teal-dark;

  &--your_turn {
    color: $color-orange-light;
    border-color: $color-orange-light;
    animation: glow 1.4s ease-in-out infinite alternate;
  }

  &--opponent_turn {
    color: $color-teal-light;
    border-color: $color-teal;
  }

  &__timer {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: $color-text;

    img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }

    &--low {
      color: $color-red-light;
    }
  }
}

@keyframes glow {
  from {
    box-shadow: 0 0 6px rgb(249 188 77 / 20%);
  }

  to {
    box-shadow: 0 0 22px rgb(249 188 77 / 50%);
  }
}

.sides {
  display: flex;
  flex-wrap: wrap;
  gap: 24px 40px;
  justify-content: center;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;

  &--shake {
    animation: shake 0.45s linear;
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translate(0);
  }

  20% {
    transform: translate(-6px, 2px);
  }

  40% {
    transform: translate(5px, -3px);
  }

  60% {
    transform: translate(-4px, 3px);
  }

  80% {
    transform: translate(3px, -2px);
  }
}

.toast {
  position: fixed;
  top: 26%;
  left: 50%;
  z-index: 20;
  max-width: 90vw;
  padding: 16px 24px;
  font-family: $font-pixel;
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
  text-transform: uppercase;
  background: rgb(6 10 32 / 92%);
  border: 4px solid;
  translate: -50% 0;

  &--enemy {
    color: $color-orange-light;
    border-color: $color-orange-light;
    box-shadow: 0 0 30px rgb(249 188 77 / 45%);
  }

  &--own {
    color: $color-red-light;
    border-color: $color-red;
    box-shadow: 0 0 30px rgb(218 48 39 / 45%);
  }
}

.toast-enter-active {
  animation: toast-in 0.35s ease-out;
}

.toast-leave-active {
  transition:
    opacity 0.4s,
    translate 0.4s;
}

.toast-leave-to {
  opacity: 0;
  translate: -50% -16px;
}

@keyframes toast-in {
  0% {
    opacity: 0;
    scale: 0.4;
  }

  60% {
    opacity: 1;
    scale: 1.12;
  }

  100% {
    scale: 1;
  }
}
</style>
