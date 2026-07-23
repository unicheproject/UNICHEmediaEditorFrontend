<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Download, Film, Music, Trash2 } from "lucide-vue-next";

import AuthedMedia from "@/components/AuthedMedia.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import { downloadAsset, fetchAssetObjectUrl } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset } from "@/types/api";

const store = useWorkspaceStore();
const videoTrack = ref<Asset[]>([]);
const audioBed = ref<Asset | null>(null);
const durations = reactive<Record<string, number>>({});
const exporting = ref(false);
const dragOverChannel = ref<"video" | "audio" | null>(null);

const exportedJobId = ref<string | null>(null);
const preExportAssetIds = ref<Set<string>>(new Set());
const exportedComposition = ref<Asset | null>(null);

const exportedJobStatus = computed(
  () => store.jobs.find((job) => job.id === exportedJobId.value)?.status ?? null,
);

function tryResolveExportedComposition() {
  if (!exportedJobId.value) {
    return;
  }
  if (exportedJobStatus.value === "succeeded") {
    // The job flips to "succeeded" before the store finishes re-fetching assets,
    // so the produced asset may not be in store.assets yet — keep "Rendering…" until it shows up.
    const produced = store.assets
      .filter((asset) => asset.media_type === "video" && !preExportAssetIds.value.has(asset.id))
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
    if (produced) {
      exportedComposition.value = produced;
      exportedJobId.value = null;
    }
  } else if (exportedJobStatus.value === "failed" || exportedJobStatus.value === "cancelled") {
    exportedJobId.value = null;
  }
}

watch(exportedJobStatus, tryResolveExportedComposition);

const secondsPerFallbackClip = 8;
const pixelsPerSecond = 42;

const videoDuration = computed(() =>
  videoTrack.value.reduce((total, asset) => total + durationFor(asset), 0),
);
const audioDuration = computed(() => (audioBed.value ? durationFor(audioBed.value) : 0));
const totalDuration = computed(() =>
  Math.max(videoDuration.value, audioDuration.value, secondsPerFallbackClip),
);

watch(
  () => store.selectedProjectId,
  () => {
    videoTrack.value = [];
    audioBed.value = null;
    Object.keys(durations).forEach((key) => delete durations[key]);
    exportedJobId.value = null;
    exportedComposition.value = null;
  },
);

watch(
  () => store.assets.map((asset) => asset.id).join("|"),
  () => {
    const assetIds = new Set(store.assets.map((asset) => asset.id));
    videoTrack.value = videoTrack.value.filter((asset) => assetIds.has(asset.id));
    if (audioBed.value && !assetIds.has(audioBed.value.id)) {
      audioBed.value = null;
    }
    tryResolveExportedComposition();
  },
);

function durationFor(asset: Asset) {
  return durations[asset.id] ?? secondsPerFallbackClip;
}

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function barWidth(asset: Asset) {
  return `${Math.max(88, durationFor(asset) * pixelsPerSecond)}px`;
}

async function loadDuration(asset: Asset) {
  if (durations[asset.id] || !["audio", "video"].includes(asset.media_type)) {
    return;
  }
  let objectUrl: string;
  try {
    objectUrl = await fetchAssetObjectUrl(asset.id);
  } catch {
    return;
  }
  const element =
    asset.media_type === "video"
      ? document.createElement("video")
      : document.createElement("audio");
  element.preload = "metadata";
  element.src = objectUrl;
  const cleanup = () => URL.revokeObjectURL(objectUrl);
  element.onloadedmetadata = () => {
    if (Number.isFinite(element.duration) && element.duration > 0) {
      durations[asset.id] = element.duration;
    }
    cleanup();
  };
  element.onerror = cleanup;
}

function parseDraggedAsset(event: DragEvent) {
  const raw =
    event.dataTransfer?.getData("application/x-uniche-asset") ||
    event.dataTransfer?.getData("text/plain");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return store.assets.find((asset) => asset.id === parsed.id) ?? null;
  } catch {
    return store.assets.find((asset) => asset.id === raw) ?? null;
  }
}

function dropOn(channel: "video" | "audio", event: DragEvent) {
  event.preventDefault();
  dragOverChannel.value = null;

  const asset = parseDraggedAsset(event);
  if (!asset) {
    return;
  }

  if (channel === "video" && asset.media_type === "video") {
    if (!videoTrack.value.some((candidate) => candidate.id === asset.id)) {
      videoTrack.value = [...videoTrack.value, asset];
      loadDuration(asset);
    }
  }

  if (channel === "audio" && asset.media_type === "audio") {
    audioBed.value = asset;
    loadDuration(asset);
  }
}

function removeVideo(assetId: string) {
  videoTrack.value = videoTrack.value.filter((asset) => asset.id !== assetId);
}

function clearTimeline() {
  videoTrack.value = [];
  audioBed.value = null;
}

async function exportTimeline() {
  if (!videoTrack.value.length) {
    return;
  }

  exporting.value = true;
  try {
    const input: Record<string, unknown> = {
      asset_ids: videoTrack.value.map((asset) => asset.id),
      width: 1920,
      height: 1080,
    };
    if (audioBed.value) {
      input.audio_asset_id = audioBed.value.id;
      input.audio_mode = "mix";
      input.music_volume = 0.3;
    }

    preExportAssetIds.value = new Set(store.assets.map((asset) => asset.id));
    exportedComposition.value = null;
    const job = await store.createJob({
      capability_id: "video.compose",
      input,
    });
    exportedJobId.value = job.id;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to export timeline");
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <Card class="flex min-h-0 flex-col overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b py-3 px-4">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <h3>Timeline</h3>
          <Badge variant="secondary">Compose / Export</Badge>
        </div>
        <p class="text-muted-foreground">
          {{ formatTime(totalDuration) }} sequence
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="muted" size="sm" :disabled="!videoTrack.length && !audioBed" @click="clearTimeline">
          Clear
        </Button>
        <Button  size="sm" :disabled="!videoTrack.length || exporting" @click="exportTimeline">
          <Download class="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>

    <div class="min-h-0 overflow-auto p-4">
      <div class="min-w-[760px]">
        <div class="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>00:00</span>
          <span>{{ formatTime(totalDuration) }}</span>
        </div>

        <div
          class="grid gap-3"
          :style="{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: `${pixelsPerSecond * 5}px 100%`,
          }"
        >
          <section
            class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-lg border bg-background p-3"
            :class="dragOverChannel === 'video' && 'border-primary ring-2 ring-primary/20'"
            @dragenter.prevent="dragOverChannel = 'video'"
            @dragover.prevent
            @dragleave="dragOverChannel = null"
            @drop="dropOn('video', $event)"
          >
            <div class="flex items-center gap-2 text-sm font-medium">
              <Film class="h-4 w-4 text-primary" />
              Video
            </div>
            <div class="flex min-h-16 items-center gap-2 overflow-hidden rounded-md bg-muted/60 p-2">
              <div
                v-for="asset in videoTrack"
                :key="asset.id"
                class="group flex h-12 shrink-0 items-center justify-between gap-3 rounded-md border bg-card px-3 text-sm shadow-sm"
                :style="{ width: barWidth(asset) }"
              >
                <span class="min-w-0 truncate">{{ asset.original_filename }}</span>
                <button
                  class="rounded-md p-1 opacity-70 hover:bg-muted hover:opacity-100"
                  type="button"
                  title="Remove clip"
                  @click="removeVideo(asset.id)"
                >
                  <Trash2 class="h-4 w-4 text-destructive" />
                </button>
              </div>
              <p v-if="!videoTrack.length" class="text-muted-foreground">
                Drop video assets here.
              </p>
            </div>
          </section>

          <section
            class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-lg border bg-background p-3"
            :class="dragOverChannel === 'audio' && 'border-primary ring-2 ring-primary/20'"
            @dragenter.prevent="dragOverChannel = 'audio'"
            @dragover.prevent
            @dragleave="dragOverChannel = null"
            @drop="dropOn('audio', $event)"
          >
            <div class="flex items-center gap-2 text-sm font-medium">
              <Music class="h-4 w-4 text-primary" />
              Audio
            </div>
            <div class="flex min-h-16 items-center gap-2 overflow-hidden rounded-md bg-muted/60 p-2">
              <div
                v-if="audioBed"
                class="flex h-12 shrink-0 items-center justify-between gap-3 rounded-md border border-primary/40 bg-card px-3 text-sm shadow-sm"
                :style="{ width: barWidth(audioBed) }"
              >
                <span class="min-w-0 truncate">{{ audioBed.original_filename }}</span>
                <button
                  class="rounded-md p-1 opacity-70 hover:bg-muted hover:opacity-100"
                  type="button"
                  title="Remove audio"
                  @click="audioBed = null"
                >
                  <Trash2 class="h-4 w-4 text-destructive" />
                </button>
              </div>
              <p v-else class="text-muted-foreground">
                Drop an audio asset here.
              </p>
            </div>
          </section>
        </div>
      </div>

      <div v-if="exportedJobId || exportedComposition" class="mt-2 border-t pt-4">
        <div class="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3>Exported composition</h3>
            <p class="text-muted-foreground">
              {{ exportedComposition ? exportedComposition.original_filename : "Rendering…" }}
            </p>
          </div>
          <Button
            v-if="exportedComposition"
            variant="ghost"
            size="icon"
            title="Download composition"
            aria-label="Download composition"
            @click="downloadAsset(exportedComposition)"
          >
            <Download class="h-4 w-4" />
            <span class="sr-only">Download composition</span>
          </Button>
        </div>

        <AuthedMedia
          v-if="exportedComposition"
          :asset-id="exportedComposition.id"
          kind="video"
          class="max-h-[360px] w-full rounded-md bg-black"
          controls
        />
        <div
          v-else
          class="flex h-24 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        >
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </div>
    </div>
  </Card>
</template>
