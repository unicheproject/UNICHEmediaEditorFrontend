<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Download,
  FileAudio,
  FileText,
  Film,
  Image,
  LayoutGrid,
  List,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-vue-next";

import AssetPlayerDialog from "@/components/AssetPlayerDialog.vue";
import AuthedMedia from "@/components/AuthedMedia.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import VideoThumbnail from "@/components/VideoThumbnail.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { downloadAsset } from "@/lib/api";
import { mediaLabel } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, JobStatus, MediaType } from "@/types/api";

type SortField = "date" | "name" | "size" | "type";
type SortDirection = "asc" | "desc";

const store = useWorkspaceStore();
const fileInput = ref<HTMLInputElement | null>(null);
const playerAsset = ref<Asset | null>(null);
const assetToDelete = ref<Asset | null>(null);
const deleting = ref(false);

const searchQuery = ref("");
const typeFilter = ref<MediaType | "all">("all");
const sortField = ref<SortField>("date");
const sortDirection = ref<SortDirection>("desc");
const viewMode = ref<"grid" | "list">("grid");

const presentMediaTypes = computed(() => {
  const types = new Set(store.assets.map((asset) => asset.media_type));
  return (["image", "audio", "video", "subtitle"] as MediaType[]).filter((type) => types.has(type));
});

const nameSuggestions = computed(() => [...new Set(store.assets.map((asset) => asset.original_filename))]);

const ACTIVE_JOB_STATUSES = new Set<JobStatus>(["queued", "running"]);
const pendingJobs = computed(() => store.jobs.filter((job) => ACTIVE_JOB_STATUSES.has(job.status)));
const hasPendingItems = computed(() => store.uploads.length > 0 || pendingJobs.value.length > 0);

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

function toggleViewMode() {
  viewMode.value = viewMode.value === "grid" ? "list" : "grid";
}

const sortedAssets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const filtered = store.assets.filter((asset) => {
    const matchesType = typeFilter.value === "all" || asset.media_type === typeFilter.value;
    const matchesQuery = !query || asset.original_filename.toLowerCase().includes(query);
    return matchesType && matchesQuery;
  });

  const direction = sortDirection.value === "asc" ? 1 : -1;
  return filtered.sort((left, right) => {
    let comparison = 0;
    if (sortField.value === "name") {
      comparison = left.original_filename.localeCompare(right.original_filename);
    } else if (sortField.value === "size") {
      comparison = left.size_bytes - right.size_bytes;
    } else if (sortField.value === "type") {
      comparison = left.media_type.localeCompare(right.media_type);
    } else {
      comparison = Date.parse(left.created_at) - Date.parse(right.created_at);
    }
    return comparison * direction;
  });
});

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
      <div class="flex flex-wrap items-center gap-2">
        <h3>Assets</h3>
        <Badge v-if="store.selectedProject" variant="outline">
          {{ store.assets.length }} assets
        </Badge>
        <Badge v-if="store.selectedAssetIds.size" variant="outline">
          {{ store.selectedAssetIds.size }} selected
        </Badge>
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

    <div v-if="store.assets.length || hasPendingItems" class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-[200px] flex-1">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          list="asset-name-suggestions"
          placeholder="Search assets by name…"
          class="pl-8 pr-8"
        />
        <datalist id="asset-name-suggestions">
          <option v-for="name in nameSuggestions" :key="name" :value="name" />
        </datalist>
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          @click="searchQuery = ''"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <Select v-model="typeFilter" class="w-auto">
        <option value="all">All types</option>
        <option v-for="type in presentMediaTypes" :key="type" :value="type">
          {{ mediaLabel(type) }}
        </option>
      </Select>

      <Select v-model="sortField" class="w-auto">
        <option value="date">Sort by date</option>
        <option value="name">Sort by name</option>
        <option value="size">Sort by size</option>
        <option value="type">Sort by type</option>
      </Select>

      <Button
        variant="muted"
        size="icon"
        :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
        :aria-label="sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'"
        @click="toggleSortDirection"
      >
        <ArrowUpNarrowWide v-if="sortDirection === 'asc'" class="h-4 w-4" />
        <ArrowDownWideNarrow v-else class="h-4 w-4" />
      </Button>

      <Button
        variant="muted"
        size="icon"
        :title="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'"
        :aria-label="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'"
        @click="toggleViewMode"
      >
        <List v-if="viewMode === 'grid'" class="h-4 w-4" />
        <LayoutGrid v-else class="h-4 w-4" />
      </Button>
    </div>

    <div
      v-if="(sortedAssets.length || hasPendingItems) && viewMode === 'grid'"
      class="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-3 overflow-auto pr-1"
    >
      <Card
        v-for="upload in store.uploads"
        :key="`upload-${upload.id}`"
        class="flex h-[350px] flex-col overflow-hidden"
      >
        <div class="relative flex aspect-[4/3] items-center justify-center bg-muted">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <Badge class="absolute left-2 top-2 text-[#7b3fc4] bg-[#f5ecfa]" variant="secondary">
            Uploading
          </Badge>
        </div>
        <div class="flex min-h-32 flex-1 flex-col p-3">
          <p class="truncate font-bold" :title="upload.name">{{ upload.name }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ upload.progress }}%</p>
          <div class="mt-auto h-1.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${upload.progress}%` }" />
          </div>
        </div>
      </Card>

      <Card
        v-for="job in pendingJobs"
        :key="`job-${job.id}`"
        class="flex h-[350px] flex-col overflow-hidden"
      >
        <div class="relative flex aspect-[4/3] items-center justify-center bg-muted">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <Badge class="absolute left-2 top-2 text-[#7b3fc4] bg-[#f5ecfa]" variant="secondary">
            Generating
          </Badge>
        </div>
        <div class="flex min-h-32 flex-1 flex-col p-3">
          <p class="truncate font-bold" :title="store.capabilityTitle(job.capability_id)">
            {{ store.capabilityTitle(job.capability_id) }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ job.status === "queued" ? "Queued" : `${job.progress}%` }}
          </p>
          <div class="mt-auto h-1.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${job.progress}%` }" />
          </div>
        </div>
      </Card>

      <Card
        v-for="asset in sortedAssets"
        :key="asset.id"
        :class="
          cn(
            'group flex h-[350px] cursor-pointer flex-col overflow-hidden transition-colors hover:border-primary/60',
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
          <VideoThumbnail
            v-else-if="asset.media_type === 'video'"
            :asset-id="asset.id"
            :alt="asset.original_filename"
          />
          <component
            :is="iconFor(asset.media_type)"
            v-else
            class="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Badge class="absolute left-2 top-2 text-[#7b3fc4] bg-[#f5ecfa]" variant="secondary">
            {{ mediaLabel(asset.media_type) }}
          </Badge>
          <Badge
            class="absolute bottom-2 left-2 bg-[#e7f1f0]"
            :variant="asset.source_asset_id ? 'success' : 'outline'"
            :class="
              asset.source_asset_id
                ? 'bg-[#e7f1f0]'
                : 'bg-[#f3f4f6]'
            "
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
          <p class="font-bold line-clamp-2 truncate" :title="asset.original_filename">
            {{ asset.original_filename }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ asset.extension.toUpperCase() }} · {{ formatSize(asset.size_bytes) }}
          </p>
          <div class="mt-auto flex items-center justify-between gap-2">
            <span class="truncate text-[10px] text-muted-foreground">{{ asset.id.slice(0, 8) }}</span>
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

    <div
      v-else-if="sortedAssets.length || hasPendingItems"
      class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-1"
    >
      <div
        v-for="upload in store.uploads"
        :key="`upload-${upload.id}`"
        class="flex items-center gap-3 rounded-md border px-3 py-2"
      >
        <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold" :title="upload.name">{{ upload.name }}</p>
          <div class="mt-1 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${upload.progress}%` }" />
          </div>
        </div>
        <Badge class="shrink-0 text-[#7b3fc4] bg-[#f5ecfa]" variant="secondary">
          Uploading {{ upload.progress }}%
        </Badge>
      </div>

      <div
        v-for="job in pendingJobs"
        :key="`job-${job.id}`"
        class="flex items-center gap-3 rounded-md border px-3 py-2"
      >
        <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold" :title="store.capabilityTitle(job.capability_id)">
            {{ store.capabilityTitle(job.capability_id) }}
          </p>
          <div class="mt-1 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${job.progress}%` }" />
          </div>
        </div>
        <Badge class="shrink-0 text-[#7b3fc4] bg-[#f5ecfa]" variant="secondary">
          {{ job.status === "queued" ? "Queued" : `${job.progress}%` }}
        </Badge>
      </div>

      <div
        v-for="asset in sortedAssets"
        :key="asset.id"
        class="group flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:border-primary/60"
        :class="isSelected(asset) && 'border-primary ring-2 ring-primary/20'"
        :draggable="canUseOnTimeline(asset)"
        @click="store.toggleAsset(asset.id)"
        @dragstart="dragAsset(asset, $event)"
      >
        <input
          type="checkbox"
          class="h-4 w-4 shrink-0 accent-primary"
          :checked="isSelected(asset)"
          aria-label="Select asset"
          @click.stop
          @change="store.toggleAsset(asset.id)"
        />
        <component
          :is="iconFor(asset.media_type)"
          class="h-5 w-5 shrink-0 text-muted-foreground"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold" :title="asset.original_filename">{{ asset.original_filename }}</p>
          <p class="text-xs text-muted-foreground">
            {{ asset.extension.toUpperCase() }} · {{ formatSize(asset.size_bytes) }}
          </p>
        </div>
        <Badge class="shrink-0 text-[#7b3fc4] bg-[#f5ecfa]" variant="secondary">
          {{ mediaLabel(asset.media_type) }}
        </Badge>
        <Badge
          class="shrink-0"
          :variant="asset.source_asset_id ? 'success' : 'outline'"
          :class="asset.source_asset_id ? 'bg-[#e7f1f0]' : 'bg-[#f3f4f6]'"
        >
          {{ asset.source_asset_id ? "Derived" : "Original" }}
        </Badge>
        <div class="flex shrink-0 items-center gap-1">
          <Button
            v-if="canPlay(asset)"
            variant="outline"
            size="icon"
            title="Play asset"
            aria-label="Play asset"
            @click.stop="openPlayer(asset)"
          >
            <Play class="h-4 w-4" />
            <span class="sr-only">Play asset</span>
          </Button>
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

    <Card v-else-if="store.assets.length" class="flex min-h-0 flex-1 items-center justify-center border-dashed p-8 text-center">
      <div class="max-w-sm">
        <Search class="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 class="mt-3">No matching assets</h3>
        <p class="mt-1 text-muted-foreground">
          Try a different search term or clear the type filter.
        </p>
      </div>
    </Card>

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
