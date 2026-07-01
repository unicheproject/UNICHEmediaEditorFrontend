<script setup lang="ts">
import { computed } from "vue";
import { FileAudio, Film } from "lucide-vue-next";

import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, MediaType } from "@/types/api";

const store = useWorkspaceStore();

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
</script>

<template>
  <Card class="flex min-h-0 flex-col p-4">
    <div class="mb-3">
      <h2 class="font-semibold">Assets</h2>
      <p class="text-sm text-muted-foreground">
        {{ sortedAssets.length }} video/audio assets — drag onto the timeline
      </p>
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
      <p class="text-sm text-muted-foreground">No assets yet.</p>
    </div>
  </Card>
</template>
