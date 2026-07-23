<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{
  modelValue?: string;
  class?: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div class="select-wrap">
    <select
      :value="modelValue"
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
  </div>
</template>
