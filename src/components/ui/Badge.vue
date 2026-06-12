<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "success" | "warning";
    class?: string;
  }>(),
  { variant: "default" },
);

const classes = computed(() =>
  cn(
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
    {
      "bg-primary text-primary-foreground": props.variant === "default",
      "bg-secondary text-secondary-foreground": props.variant === "secondary",
      "border border-border bg-background": props.variant === "outline",
      "bg-emerald-100 text-emerald-800": props.variant === "success",
      "bg-amber-100 text-amber-900": props.variant === "warning",
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
