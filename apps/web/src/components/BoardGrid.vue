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
    /** Підсвітити поле (наприклад, зараз твій хід по цьому полю). */
    active?: boolean;
  }>(),
  { ships: () => [], shots: () => [], preview: null, interactive: false, active: false },
);

const emit = defineEmits<{
  cell: [cell: Coord];
  hover: [cell: Coord | null];
}>();

const cells: Coord[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
  x: i % BOARD_SIZE,
  y: Math.floor(i / BOARD_SIZE),
}));

const LETTERS = 'ABCDEFGHIJ'.split('');
const NUMBERS = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
const cellName = (cell: Coord): string => `${LETTERS[cell.x] ?? ''}${cell.y + 1}`;

/** Кадри води передаємо в CSS змінними, щоб анімувати їх у keyframes. */
const seaVars = {
  '--sea-0': `url(${sea.frames[0]})`,
  '--sea-1': `url(${sea.frames[1]})`,
  '--sea-2': `url(${sea.frames[2]})`,
  '--sea-3': `url(${sea.frames[3]})`,
};

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
  <div class="boardwrap" :class="{ 'boardwrap--active': active }">
    <div class="boardwrap__cols" aria-hidden="true">
      <span v-for="letter in LETTERS" :key="letter">{{ letter }}</span>
    </div>
    <div class="boardwrap__rows" aria-hidden="true">
      <span v-for="n in NUMBERS" :key="n">{{ n }}</span>
    </div>

    <div
      class="board"
      role="group"
      :aria-label="label"
      :style="seaVars"
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
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.boardwrap {
  display: inline-grid;
  grid-template-columns: 1.6em auto;
  grid-template-rows: 1.5em auto;
  gap: 2px;

  &__cols,
  &__rows {
    display: grid;
    font-family: $font-pixel;
    font-size: 9px;
    color: $color-teal-light;
    place-items: center;
  }

  &__cols {
    grid-column: 2;
    grid-row: 1;
    grid-template-columns: repeat(10, var(--cell));
  }

  &__rows {
    grid-column: 1;
    grid-row: 2;
    grid-auto-rows: var(--cell);
  }

  .board {
    grid-column: 2;
    grid-row: 2;
  }

  &--active .board {
    box-shadow:
      0 0 0 3px $color-orange-light,
      0 0 30px rgb(249 188 77 / 55%);
  }
}

.board {
  position: relative;
  box-sizing: content-box;
  width: calc(10 * var(--cell));
  height: calc(10 * var(--cell));
  background-color: #14446a;
  background-image: var(--sea-0);
  background-size: calc(var(--cell) * 5);
  border: 3px solid $color-teal-dark;
  box-shadow:
    0 0 0 3px $color-ink,
    0 10px 28px rgb(0 0 0 / 55%);
  image-rendering: pixelated;
  animation: sea 1.6s step-end infinite;
}

@keyframes sea {
  0% {
    background-image: var(--sea-0);
  }

  25% {
    background-image: var(--sea-1);
  }

  50% {
    background-image: var(--sea-2);
  }

  75% {
    background-image: var(--sea-3);
  }
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
  border: 1px solid rgb(218 228 232 / 12%);
  cursor: crosshair;

  &:hover:not(:disabled) {
    background: rgb(249 188 77 / 22%);
  }

  &:focus-visible {
    outline: 2px solid $color-orange-light;
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
  filter: drop-shadow(0 3px 0 rgb(0 0 0 / 40%));
}

.board__marker {
  width: var(--cell);
  height: var(--cell);
  object-fit: contain;
  image-rendering: pixelated;
  animation: pop 0.3s ease-out;
}

@keyframes pop {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }

  60% {
    opacity: 1;
    transform: scale(1.3);
  }

  100% {
    transform: scale(1);
  }
}

.board__preview {
  width: var(--cell);
  height: var(--cell);

  &--ok {
    background: rgb(63 182 139 / 50%);
  }

  &--bad {
    background: rgb(229 72 77 / 50%);
  }
}
</style>
