<script setup lang="ts">
import { computed } from "vue";

import Input from "@/components/ui/Input.vue";

const props = defineProps<{
  modelValue?: string | number;
  min?: number;
  max?: number;
  step?: string | number;
  required?: boolean;
  suffix?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const sliderMin = computed(() => props.min ?? 0);
const sliderMax = computed(() => props.max ?? 100);

// Size the numeric field to fit its widest value (sign, digits and the
// step's decimals) plus the unit, rather than a fixed width that clips.
const fieldWidth = computed(() => {
  const decimals = String(props.step ?? "").split(".")[1]?.length ?? 0;
  const valueChars = Math.max(
    ...[sliderMin.value, sliderMax.value].map(
      (bound) => String(Math.trunc(bound)).length + (decimals ? decimals + 1 : 0),
    ),
  );
  const suffixChars = props.suffix?.length ?? 0;
  // 14px left padding, ~6px between value and unit, 44px for the stepper and
  // right padding, 3px of borders, plus a little breathing room.
  return `calc(${valueChars + suffixChars}ch + 80px)`;
});

// Keep the slider thumb in range while the numeric field holds an empty or
// out-of-range draft value.
const sliderValue = computed(() => {
  const parsed = Number.parseFloat(String(props.modelValue ?? ""));
  if (Number.isNaN(parsed)) {
    return sliderMin.value;
  }
  return Math.min(Math.max(parsed, sliderMin.value), sliderMax.value);
});
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="min-w-0 flex-1">
      <input
        class="w-full accent-primary"
        type="range"
        :min="sliderMin"
        :max="sliderMax"
        :step="step"
        :value="sliderValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <div class="flex justify-between text-xs text-muted-foreground">
        <span>{{ sliderMin }}</span>
        <span>{{ sliderMax }}</span>
      </div>
    </div>
    <div class="shrink-0">
      <Input
        :style="{ width: fieldWidth }"
        type="number"
        :model-value="modelValue"
        :min="sliderMin"
        :max="sliderMax"
        :step="step"
        :required="required"
        :suffix="suffix"
        @update:model-value="emit('update:modelValue', String($event))"
      />
    </div>
  </div>
</template>
