<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  cancelLabel: string;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);

function sync(): void {
  const el = dialog.value;
  if (!el) return;
  if (props.open && !el.open) el.showModal();
  if (!props.open && el.open) el.close();
}

onMounted(sync);
watch(() => props.open, sync, { flush: 'post' });

/** Клік повз вікно (по затемненню) скасовує. Натискання кнопок з клавіатури не рахуємо. */
function onClick(event: MouseEvent): void {
  const el = dialog.value;
  if (!el || event.target !== el) return;
  const box = el.getBoundingClientRect();
  const outside =
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom;
  if (outside) emit('cancel');
}
</script>

<template>
  <!-- Нативний <dialog>: фокус лишається всередині, Esc закриває. -->
  <dialog
    ref="dialog"
    class="frame confirm"
    aria-labelledby="confirm-title"
    @cancel.prevent="emit('cancel')"
    @click="onClick"
  >
    <div class="stack">
      <h2 id="confirm-title" class="confirm__title">{{ title }}</h2>
      <p v-if="text">{{ text }}</p>
      <div class="row confirm__actions">
        <button type="button" class="btn" autofocus @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button type="button" class="btn btn--primary" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.confirm {
  width: min(92vw, 480px);
  margin: auto;
  color: $color-text;
  background: transparent;

  &::backdrop {
    background: rgb(6 10 32 / 78%);
    backdrop-filter: blur(3px);
  }

  &[open] {
    animation: pop-in 0.25s ease-out;
  }

  &__title {
    font-size: 15px;
    color: $color-orange-light;
    text-shadow: 2px 2px 0 $color-ink;
  }

  &__actions {
    justify-content: flex-end;
  }
}

@keyframes pop-in {
  0% {
    opacity: 0;
    scale: 0.85;
  }

  100% {
    opacity: 1;
    scale: 1;
  }
}
</style>
