<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, FileAudio, FileText, Film, Image, Play, Trash2, Upload } from "lucide-vue-next";

import AssetPlayerDialog from "@/components/AssetPlayerDialog.vue";
import AuthedMedia from "@/components/AuthedMedia.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import { downloadAsset } from "@/lib/api";
import { mediaLabel } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, MediaType } from "@/types/api";

const store = useWorkspaceStore();
const fileInput = ref<HTMLInputElement | null>(null);
const playerAsset = ref<Asset | null>(null);
const assetToDelete = ref<Asset | null>(null);
const deleting = ref(false);

const sortedAssets = computed(() =>
  [...store.assets].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
);

function iconFor(mediaType: MediaType) {
  return {
    image: Image,
    audio: FileAudio,
    video: Film,
    subtitle: FileText,
  }[mediaType];
}

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isSelected(asset: Asset) {
  return store.selectedAssetIds.has(asset.id);
}

function canPlay(asset: Asset) {
  return asset.media_type === "audio" || asset.media_type === "video";
}

function canUseOnTimeline(asset: Asset) {
  return asset.media_type === "audio" || asset.media_type === "video";
}

function dragAsset(asset: Asset, event: DragEvent) {
  if (!event.dataTransfer || !canUseOnTimeline(asset)) {
    return;
  }
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(
    "application/x-uniche-asset",
    JSON.stringify({ id: asset.id, media_type: asset.media_type }),
  );
  event.dataTransfer.setData("text/plain", asset.id);
}

function openPlayer(asset: Asset) {
  playerAsset.value = asset;
}

function closePlayer() {
  playerAsset.value = null;
}

async function confirmDeleteAsset() {
  if (!assetToDelete.value) {
    return;
  }
  deleting.value = true;
  try {
    await store.deleteAsset(assetToDelete.value.id);
    if (playerAsset.value?.id === assetToDelete.value.id) {
      closePlayer();
    }
    assetToDelete.value = null;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to delete asset");
  } finally {
    deleting.value = false;
  }
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
  <section class="flex min-h-0 flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3>Assets</h3>
        <p class="text-muted-foreground">
          {{ store.assets.length }} uploaded or derived assets
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="store.selectedAssetIds.size"
          variant="muted"
          size="sm"
          @click="store.clearSelection"
        >
          Clear selection
        </Button>
        <input ref="fileInput" class="hidden" type="file" multiple @change="uploadFiles" />
        <Button
          variant="secondary"
          size="sm"
          :disabled="!store.selectedProjectId || store.uploading"
          @click="fileInput?.click()"
        >
          <Upload class="h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>

    <div
      v-if="sortedAssets.length"
      class="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-3 overflow-auto pr-1"
    >
      <Card
        v-for="asset in sortedAssets"
        :key="asset.id"
        :class="
          cn(
            'group flex h-[300px] cursor-pointer flex-col overflow-hidden transition-colors hover:border-primary/60',
            isSelected(asset) && 'border-primary ring-2 ring-primary/20',
          )
        "
        :draggable="canUseOnTimeline(asset)"
        @click="store.toggleAsset(asset.id)"
        @dragstart="dragAsset(asset, $event)"
      >
        <div class="relative aspect-[4/3] bg-muted">
          <AuthedMedia
            v-if="asset.media_type === 'image'"
            :asset-id="asset.id"
            kind="img"
            :alt="asset.original_filename"
            class="aspect-[4/3] h-full w-full object-cover"
          />
          <component
            :is="iconFor(asset.media_type)"
            v-else
            class="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Badge class="absolute left-2 top-2" variant="secondary">
            {{ mediaLabel(asset.media_type) }}
          </Badge>
          <Badge
            class="absolute bottom-2 left-2"
            :variant="asset.source_asset_id ? 'success' : 'outline'"
          >
            {{ asset.source_asset_id ? "Derived" : "Original" }}
          </Badge>
          <Button
            v-if="canPlay(asset)"
            class="absolute bottom-2 right-2 bg-background/90 shadow-sm backdrop-blur hover:bg-primary hover:text-primary-foreground"
            variant="outline"
            size="icon"
            title="Play asset"
            aria-label="Play asset"
            @click.stop="openPlayer(asset)"
          >
            <Play class="h-4 w-4" />
            <span class="sr-only">Play asset</span>
          </Button>
        </div>
        <div class="flex min-h-32 flex-1 flex-col p-3">
          <h4 class="line-clamp-2" :title="asset.original_filename">
            {{ asset.original_filename }}
          </h4>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ asset.extension.toUpperCase() }} · {{ formatSize(asset.size_bytes) }}
          </p>
          <div class="mt-auto flex items-center justify-between gap-2">
            <span class="truncate text-xs text-muted-foreground">{{ asset.id.slice(0, 8) }}</span>
            <div class="flex items-center gap-1 pb-3">
              <Button
                variant="muted"
                size="icon"
                title="Delete asset"
                aria-label="Delete asset"
                @click.stop="assetToDelete = asset"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
                <span class="sr-only">Delete asset</span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                title="Download asset"
                aria-label="Download asset"
                @click.stop="downloadAsset(asset)"
              >
                <Download class="h-4 w-4" />
                <span class="sr-only">Download asset</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <Card v-else class="flex min-h-0 flex-1 items-center justify-center border-dashed p-8 text-center">
      <div class="max-w-sm">
        <Upload class="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 class="mt-3">No assets yet</h3>
        <p class="mt-1 text-muted-foreground">
          Upload images, audio, video, or subtitle files to make actions available.
        </p>
      </div>
    </Card>

    <AssetPlayerDialog :open="!!playerAsset" :asset="playerAsset" @close="closePlayer" />
    <ConfirmDialog
      :open="!!assetToDelete"
      title="Delete asset"
      :description="`Delete '${assetToDelete?.original_filename ?? 'this asset'}'? This removes it from the project asset list.`"
      :loading="deleting"
      confirm-label="Delete asset"
      @close="assetToDelete = null"
      @confirm="confirmDeleteAsset"
    />
  </section>
</template>
