<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{
  modelValue?: string;
  class?: string;
  // Unit shown inside the field, just left of the chevron (e.g. "px", "fps").
  suffix?: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

// The chevron occupies the right 38px; reserve extra room for the unit.
const selectStyle = computed(() =>
  props.suffix ? { paddingRight: `calc(${props.suffix.length}ch + 46px)` } : undefined,
);
</script>

<template>
  <div class="select-wrap">
    <select
      :value="modelValue"
      :style="selectStyle"
      :class="
        cn(
          'flex form-select disabled:cursor-not-allowed disabled:opacity-50',
          $props.class,
        )
      "
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <slot />
    </select>
    <span
      v-if="suffix"
      class="pointer-events-none absolute inset-y-0 right-[38px] flex items-center text-sm text-muted-foreground"
    >
      {{ suffix }}
    </span>
  </div>
</template>
