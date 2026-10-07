<script setup lang="ts">
import { ChevronDown, ChevronUp } from "lucide-vue-next";
import { computed, ref } from "vue";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  class?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  // Unit shown inside the field, right-aligned (e.g. "px", "seconds", "%").
  suffix?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const inputEl = ref<HTMLInputElement>();

// Native number spinners sit wherever the browser puts them and would
// overlap the unit, so number fields with a unit get our own stepper.
const showStepper = computed(() => Boolean(props.suffix) && props.type === "number");

const inputClass = computed(() =>
  cn(
    "flex form-input file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
    showStepper.value &&
      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    props.class,
  ),
);

// Reserve room on the right so typed values never run under the unit (and
// the stepper, when shown).
const inputStyle = computed(() =>
  props.suffix
    ? { paddingRight: `calc(${props.suffix.length}ch + ${showStepper.value ? 44 : 24}px)` }
    : undefined,
);

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}

// stepUp/stepDown honour the input's min, max and step like the native arrows.
function stepBy(direction: 1 | -1) {
  const input = inputEl.value;
  if (!input || input.disabled) {
    return;
  }
  if (direction === 1) {
    input.stepUp();
  } else {
    input.stepDown();
  }
  emit("update:modelValue", input.value);
}
</script>

<template>
  <!-- Only wrap when a unit is shown, so callers positioning siblings
       relative to the input (e.g. icons) are unaffected. -->
  <div v-if="suffix" class="relative">
    <input
      ref="inputEl"
      v-bind="$attrs"
      :value="modelValue"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :required="required"
      :min="min"
      :max="max"
      :step="step"
      :style="inputStyle"
      :class="inputClass"
      @input="onInput"
    />
    <div
      :class="
        cn(
          'pointer-events-none absolute inset-y-0 flex items-center gap-1.5 text-sm text-muted-foreground',
          showStepper ? 'right-1.5' : 'right-3.5',
        )
      "
    >
      <span>{{ suffix }}</span>
      <div v-if="showStepper" class="pointer-events-auto flex flex-col">
        <button
          type="button"
          tabindex="-1"
          aria-label="Increase"
          class="flex h-4 w-5 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground"
          @mousedown.prevent
          @click="stepBy(1)"
        >
          <ChevronUp class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          tabindex="-1"
          aria-label="Decrease"
          class="flex h-4 w-5 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground"
          @mousedown.prevent
          @click="stepBy(-1)"
        >
          <ChevronDown class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
  <input
    v-else
    v-bind="$attrs"
    :value="modelValue"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :required="required"
    :min="min"
    :max="max"
    :step="step"
    :class="inputClass"
    @input="onInput"
  />
</template>
