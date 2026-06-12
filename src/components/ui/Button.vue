<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
    size?: "default" | "sm" | "icon";
    class?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  {
    variant: "default",
    size: "default",
    type: "button",
    disabled: false,
  },
);

const classes = computed(() =>
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
      "bg-primary text-primary-foreground hover:bg-primary/90": props.variant === "default",
      "bg-secondary text-secondary-foreground hover:bg-secondary/80": props.variant === "secondary",
      "border border-input bg-background hover:bg-muted": props.variant === "outline",
      "hover:bg-muted": props.variant === "ghost",
      "bg-destructive text-destructive-foreground hover:bg-destructive/90":
        props.variant === "destructive",
      "h-10 px-4 py-2": props.size === "default",
      "h-9 px-3": props.size === "sm",
      "h-9 w-9": props.size === "icon",
    },
    props.class,
  ),
);
</script>

<template>
  <button :class="classes" :type="type" :disabled="disabled">
    <slot />
  </button>
</template>
