<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "featured" | "default" | "secondary" | "outline" | "neutral" | "success" | "warning" | "error";
    class?: string;
  }>(),
  { variant: "default" },
);

const classes = computed(() =>
  cn(
    "inline-flex items-center rounded-full px-3 py-2 text-[10px] font-bold tracking-[0.07em] leading-none",
    {
      "bg-brand-gradient text-white": props.variant === "featured",
      "bg-primary text-white": props.variant === "default",
      "bg-secondary text-secondary-foreground": props.variant === "secondary",
      "border border-deep bg-[#4c1d8b0f] text-deep": props.variant === "outline",
      "border bg-surface-2 text-text-secondary": props.variant === "neutral",
      "bg-[#0f7a6e1a] text-success": props.variant === "success",
      "bg-[#9a62001a] text-warning": props.variant === "warning",
      "bg-[#c0185e1a] text-error": props.variant === "error",
    },
    props.class,
  ),
);
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
