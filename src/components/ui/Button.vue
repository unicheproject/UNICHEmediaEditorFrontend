<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "muted" | "ghost" | "destructive";
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
    "btn",
    {
      "btn-primary": props.variant === "default",
      "btn-secondary": props.variant === "secondary",
      "btn-outline": props.variant === "outline",
      "btn-muted": props.variant === "muted",
      "btn-ghost": props.variant === "ghost",
      "bg-destructive text-destructive-foreground hover:bg-destructive/90":
        props.variant === "destructive",
      "px-[18px] py-2 text-[10px]": props.size === "sm",
      "btn-icon": props.size === "icon",
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
