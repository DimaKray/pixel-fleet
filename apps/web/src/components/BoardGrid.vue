<script setup lang="ts">
import { computed } from 'vue';
import { BOARD_SIZE, inBounds, shipCells } from '@pixelfleet/engine';
import type { Coord, PlacedShip, Shot } from '@pixelfleet/engine';
import { markers, sea, shipSprites } from '@/lib/assets';

const props = withDefaults(
  defineProps<{
    label: string;
    ships?: readonly PlacedShip[];
    shots?: readonly Shot[];
    preview?: { ship: PlacedShip; valid: boolean } | null;
    interactive?: boolean;
  }>(),
  { ships: () => [], shots: () => [], preview: null, interactive: false },
);

const emit = defineEmits<{
  cell: [cell: Coord];
  hover: [cell: Coord | null];
}>();

const cells: Coord[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
  x: i % BOARD_SIZE,
  y: Math.floor(i / BOARD_SIZE),
}));

const LETTERS = 'ABCDEFGHIJ';
const cellName = (cell: Coord): string => `${LETTERS.charAt(cell.x)}${cell.y + 1}`;

const position = (cell: Coord) => ({
  left: `calc(${cell.x} * var(--cell))`,
  top: `calc(${cell.y} * var(--cell))`,
});

/** Спрайти намальовані збоку, носом праворуч. Вертикальний корабель повертаємо на 90°. */
function shipStyle(ship: PlacedShip) {
  const base = {
    ...position(ship.origin),
    width: `calc(${shipSprites[ship.type].cells} * var(--cell))`,
    height: 'var(--cell)',
  };
  return ship.orientation === 'vertical'
    ? { ...base, transformOrigin: 'top left', transform: 'translateX(var(--cell)) rotate(90deg)' }
    : base;
}

const previewCells = computed(() =>
  props.preview ? shipCells(props.preview.ship).filter(inBounds) : [],
);
</script>

<template>
  <div
    class="board"
    role="group"
    :aria-label="label"
    :style="{ backgroundImage: `url(${sea.frames[0]})` }"
    @mouseleave="emit('hover', null)"
  >
    <div class="board__cells">
      <button
        v-for="cell in cells"
        :key="`${cell.x}-${cell.y}`"
        type="button"
        class="board__cell"
        :disabled="!interactive"
        :aria-label="cellName(cell)"
        @click="emit('cell', cell)"
        @mouseenter="emit('hover', cell)"
        @focus="emit('hover', cell)"
      />
    </div>

    <img
      v-for="ship in ships"
      :key="ship.type"
      class="board__ship"
      :src="shipSprites[ship.type].src"
      :style="shipStyle(ship)"
      alt=""
    />

    <img
      v-for="shot in shots"
      :key="`shot-${shot.at.x}-${shot.at.y}`"
      class="board__marker"
      :src="markers[shot.outcome]"
      :style="position(shot.at)"
      alt=""
    />

    <div
      v-for="cell in previewCells"
      :key="`preview-${cell.x}-${cell.y}`"
      class="board__preview"
      :class="preview?.valid ? 'board__preview--ok' : 'board__preview--bad'"
      :style="position(cell)"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.board {
  position: relative;
  box-sizing: content-box;
  width: calc(10 * var(--cell));
  height: calc(10 * var(--cell));
  border: 2px solid $color-border;
  background-size: calc(var(--cell) * 5);
  image-rendering: pixelated;
}

.board__cells {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(10, var(--cell));
  grid-auto-rows: var(--cell);
}

.board__cell {
  box-sizing: border-box;
  padding: 0;
  background: transparent;
  border: 1px solid rgb(232 241 255 / 12%);
  cursor: crosshair;

  &:hover:not(:disabled) {
    background: rgb(255 255 255 / 15%);
  }

  &:focus-visible {
    outline: 2px solid $color-accent;
    outline-offset: -2px;
  }

  &:disabled {
    cursor: default;
  }
}

.board__ship,
.board__marker,
.board__preview {
  position: absolute;
  pointer-events: none;
}

.board__ship {
  object-fit: contain;
  image-rendering: pixelated;
}

.board__marker {
  width: var(--cell);
  height: var(--cell);
  object-fit: contain;
  image-rendering: pixelated;
}

.board__preview {
  width: var(--cell);
  height: var(--cell);

  &--ok {
    background: rgb(63 182 139 / 45%);
  }

  &--bad {
    background: rgb(229 72 77 / 45%);
  }
}
</style>
