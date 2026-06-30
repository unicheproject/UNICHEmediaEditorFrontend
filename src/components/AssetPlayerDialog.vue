<script setup lang="ts">
import AuthedMedia from "@/components/AuthedMedia.vue";
import Dialog from "@/components/ui/Dialog.vue";
import type { Asset } from "@/types/api";

defineProps<{
  asset: Asset | null;
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <Dialog
    :open="open && !!asset"
    :title="asset?.original_filename ?? 'Preview asset'"
    :description="asset ? `${asset.media_type} · ${asset.mime_type}` : undefined"
    class="max-w-4xl"
    @close="$emit('close')"
  >
    <div v-if="asset" class="space-y-4">
      <AuthedMedia
        v-if="asset.media_type === 'video'"
        :asset-id="asset.id"
        kind="video"
        class="max-h-[70vh] w-full rounded-md bg-black"
        controls
        autoplay
      />

      <div v-else-if="asset.media_type === 'audio'" class="rounded-md border bg-muted p-6">
        <AuthedMedia :asset-id="asset.id" kind="audio" class="w-full" controls autoplay />
      </div>
    </div>
  </Dialog>
</template>
