<script setup lang="ts">
import { computed, ref } from "vue";
import { FileAudio, Film, Upload } from "lucide-vue-next";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, MediaType } from "@/types/api";

const store = useWorkspaceStore();
const fileInput = ref<HTMLInputElement | null>(null);

const sortedAssets = computed(() =>
  store.assets
    .filter((a) => a.media_type === "video" || a.media_type === "audio")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
);

function iconFor(mediaType: MediaType) {
  return { audio: FileAudio, video: Film }[mediaType as "audio" | "video"];
}

function canDrag(asset: Asset) {
  return asset.media_type === "audio" || asset.media_type === "video";
}

function dragAsset(asset: Asset, event: DragEvent) {
  if (!event.dataTransfer || !canDrag(asset)) return;
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(
    "application/x-uniche-asset",
    JSON.stringify({ id: asset.id, media_type: asset.media_type }),
  );
  event.dataTransfer.setData("text/plain", asset.id);
}

async function uploadFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []);
  for (const file of files) {
    try {
      await store.uploadAsset(file);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : `Unable to upload ${file.name}`);
    }
  }
  if (fileInput.value) {
    fileInput.value.value = "";
  }
}
</script>

<template>
  <Card class="flex min-h-0 flex-col p-4 border-accent-top">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="max-w-[70%]">
        <h4>Assets</h4>
        <p class="text-muted-foreground text-xs">
          {{ sortedAssets.length }} video/audio assets — drag onto the timeline
        </p>
      </div>
      <input ref="fileInput" class="hidden" type="file" multiple @change="uploadFiles" />
      <Button
        size="icon"
        variant="secondary"
        title="Upload asset"
        aria-label="Upload asset"
        :disabled="!store.selectedProjectId || store.uploading"
        @click="fileInput?.click()"
      >
        <Upload class="h-4 w-4" />
        <span class="sr-only">Upload asset</span>
      </Button>
    </div>

    <div v-if="sortedAssets.length" class="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1">
      <div
        v-for="asset in sortedAssets"
        :key="asset.id"
        class="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors"
        :class="
          canDrag(asset)
            ? 'cursor-grab hover:border-primary/60 active:cursor-grabbing'
            : 'opacity-50'
        "
        :draggable="canDrag(asset)"
        @dragstart="dragAsset(asset, $event)"
      >
        <component
          :is="iconFor(asset.media_type)"
          class="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <span class="min-w-0 flex-1 truncate">{{ asset.original_filename }}</span>
        <Badge variant="secondary" class="shrink-0">{{ asset.media_type }}</Badge>
      </div>
    </div>

    <div v-else class="rounded-md border border-dashed p-4">
      <p class="text-muted-foreground">No assets yet.</p>
    </div>
  </Card>
</template>
