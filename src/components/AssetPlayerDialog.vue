<script setup lang="ts">
import Dialog from "@/components/ui/Dialog.vue";
import { assetDownloadUrl } from "@/lib/api";
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
      <video
        v-if="asset.media_type === 'video'"
        class="max-h-[70vh] w-full rounded-md bg-black"
        :src="assetDownloadUrl(asset.id)"
        controls
        autoplay
      />

      <div v-else-if="asset.media_type === 'audio'" class="rounded-md border bg-muted p-6">
        <audio class="w-full" :src="assetDownloadUrl(asset.id)" controls autoplay />
      </div>
    </div>
  </Dialog>
</template>
