<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  class?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}>();

defineEmits<{
  "update:modelValue": [value: string | number];
}>();
</script>

<template>
  <input
    :value="modelValue"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :required="required"
    :min="min"
    :max="max"
    :step="step"
    :class="
      cn(
        'flex form-input file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        $props.class,
      )
    "
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
