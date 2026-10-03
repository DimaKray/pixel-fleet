<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FLEET, canPlaceShip, shipCells } from '@pixelfleet/engine';
import type { Coord, Orientation, PlacedShip, ShipType } from '@pixelfleet/engine';
import BoardGrid from '@/components/BoardGrid.vue';
import { shipSprites } from '@/lib/assets';
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
  <section class="placement">
    <h2>{{ t('placement.title') }}</h2>
    <p class="hint">{{ t('placement.hint') }}</p>

    <div class="dock">
      <button
        v-for="entry in FLEET"
        :key="entry.type"
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
        <span>{{ t(`ships.${entry.type}`) }} · {{ entry.size }}</span>
      </button>
    </div>

    <BoardGrid
      :label="t('board.own')"
      :ships="draft"
      :preview="preview"
      interactive
      @cell="onCell"
      @hover="hover = $event"
    />

    <div class="actions">
      <button type="button" class="btn btn--ghost" @click="rotate">
        {{ t('placement.rotate') }}
      </button>
      <button type="button" class="btn btn--ghost" @click="random">
        {{ t('placement.random') }}
      </button>
      <button type="button" class="btn btn--ghost" @click="reset">
        {{ t('placement.reset') }}
      </button>
      <button type="button" class="btn" :disabled="!complete || busy" @click="emit('ready', draft)">
        {{ busy ? t('placement.sending') : t('placement.ready') }}
      </button>
    </div>

    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
  </section>
</template>
