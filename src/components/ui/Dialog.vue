<script setup lang="ts">
import { X } from "lucide-vue-next";

import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button.vue";

defineProps<{
  open: boolean;
  title: string;
  description?: string;
  class?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50">
      <button
        class="absolute inset-0 cursor-default bg-foreground/30"
        type="button"
        aria-label="Close dialog"
        @click="emit('close')"
      />
      <div
        :class="
          cn(
            'fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-6 text-popover-foreground shadow-lg',
            $props.class,
          )
        "
        role="dialog"
        aria-modal="true"
      >
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="description" class="mt-1 text-sm text-muted-foreground">
              {{ description }}
            </p>
          </div>
          <Button variant="ghost" size="icon" @click="emit('close')">
            <X class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </Button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
