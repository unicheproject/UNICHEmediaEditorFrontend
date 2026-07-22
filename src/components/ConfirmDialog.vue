<script setup lang="ts">
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    loading?: boolean;
  }>(),
  {
    confirmLabel: "Delete",
    loading: false,
  },
);

defineEmits<{
  close: [];
  confirm: [];
}>();
</script>

<template>
  <Dialog :open="open" :title="title" :description="description" @close="$emit('close')">
    <div class="flex justify-end gap-2">
      <Button variant="muted" :disabled="loading" @click="$emit('close')">Cancel</Button>
      <Button variant="destructive" :disabled="loading" @click="$emit('confirm')">
        {{ confirmLabel }}
      </Button>
    </div>
  </Dialog>
</template>
