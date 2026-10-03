<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FLEET, canPlaceShip, shipCells } from '@pixelfleet/engine';
import type { Coord, Orientation, PlacedShip, ShipType } from '@pixelfleet/engine';
import BoardGrid from '@/components/BoardGrid.vue';
import { icons, shipSprites } from '@/lib/assets';
import { isComplete, nextUnplaced, placeShip, randomFleet, without } from '@/lib/draft';

defineProps<{ busy?: boolean; errorText?: string }>();
const emit = defineEmits<{ ready: [ships: PlacedShip[]] }>();

const { t } = useI18n();

const draft = ref<PlacedShip[]>([]);
const selected = ref<ShipType | null>(nextUnplaced([]));
const orientation = ref<Orientation>('horizontal');
const hover = ref<Coord | null>(null);

const preview = computed(() => {
  if (!selected.value || !hover.value) return null;
  const ship: PlacedShip = {
    type: selected.value,
    origin: hover.value,
    orientation: orientation.value,
  };
  return { ship, valid: canPlaceShip(without(draft.value, selected.value), ship) };
});

const complete = computed(() => isComplete(draft.value));
const isPlaced = (type: ShipType): boolean => draft.value.some((ship) => ship.type === type);

/** Обрати корабель зі списку. Якщо він уже стоїть на полі, піднімаємо його. */
function select(type: ShipType): void {
  const existing = draft.value.find((ship) => ship.type === type);
  if (existing) {
    orientation.value = existing.orientation;
    draft.value = without(draft.value, type);
  }
  selected.value = type;
}

function onCell(cell: Coord): void {
  if (selected.value) {
    const next = placeShip(draft.value, {
      type: selected.value,
      origin: cell,
      orientation: orientation.value,
    });
    if (!next) return;
    draft.value = next;
    selected.value = nextUnplaced(next);
    return;
  }

  const hit = draft.value.find((ship) =>
    shipCells(ship).some((c) => c.x === cell.x && c.y === cell.y),
  );
  if (hit) select(hit.type);
}

function rotate(): void {
  orientation.value = orientation.value === 'horizontal' ? 'vertical' : 'horizontal';
}

function random(): void {
  draft.value = randomFleet();
  selected.value = null;
}

function reset(): void {
  draft.value = [];
  selected.value = nextUnplaced([]);
}

/** `code`, а не `key`, щоб клавіша працювала і в українській розкладці. */
function onKey(event: KeyboardEvent): void {
  if (event.code === 'KeyR' && !(event.target instanceof HTMLInputElement)) rotate();
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <section class="split">
    <div class="stack">
      <h2>{{ t('placement.title') }}</h2>
      <BoardGrid
        :label="t('board.own')"
        :ships="draft"
        :preview="preview"
        interactive
        @cell="onCell"
        @hover="hover = $event"
      />
    </div>

    <aside class="stack">
      <p class="hint">{{ t('placement.hint') }}</p>

      <ul class="dock">
        <li v-for="entry in FLEET" :key="entry.type">
          <button
            type="button"
            class="dock__item"
            :class="{
              'dock__item--active': selected === entry.type,
              'dock__item--placed': isPlaced(entry.type),
            }"
            :aria-pressed="selected === entry.type"
            @click="select(entry.type)"
          >
            <img :src="shipSprites[entry.type].src" alt="" />
            <span class="dock__name">{{ t(`ships.${entry.type}`) }}</span>
            <span class="dock__size">{{ isPlaced(entry.type) ? '✓' : entry.size }}</span>
          </button>
        </li>
      </ul>

      <div class="row">
        <button type="button" class="btn btn--small" @click="rotate">
          <img :src="icons.rotate" alt="" />{{ t('placement.rotate') }}
        </button>
        <button type="button" class="btn btn--small" @click="random">
          {{ t('placement.random') }}
        </button>
        <button type="button" class="btn btn--small" @click="reset">
          {{ t('placement.reset') }}
        </button>
      </div>

      <button
        type="button"
        class="btn btn--primary btn--big"
        :disabled="!complete || busy"
        @click="emit('ready', draft)"
      >
        {{ busy ? t('placement.sending') : t('placement.ready') }}
      </button>

      <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
    </aside>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.dock {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: grid;
    grid-template-columns: 112px 1fr auto;
    gap: 12px;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 13px;
    color: $color-text;
    text-align: left;
    background: rgb(6 10 32 / 65%);
    border: 3px solid $color-teal-dark;
    cursor: pointer;

    img {
      width: 112px;
      height: 30px;
      object-fit: contain;
    }

    &:hover {
      border-color: $color-teal-light;
    }

    &:focus-visible {
      outline: 3px solid $color-orange-light;
      outline-offset: 2px;
    }

    &--active {
      border-color: $color-orange-light;
      box-shadow: 0 0 16px rgb(249 188 77 / 35%);
    }

    &--placed:not(&--active) {
      opacity: 0.5;
    }
  }

  &__name {
    min-width: 0;
  }

  &__size {
    font-family: $font-pixel;
    font-size: 12px;
    color: $color-orange-light;
  }
}
</style>
