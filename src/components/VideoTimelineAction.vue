<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { useAssetObjectUrl } from "@/composables/useAssetObjectUrl";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, Capability } from "@/types/api";

const props = defineProps<{
  action: Capability;
  asset: Asset;
  open: boolean;
}>();

const store = useWorkspaceStore();
const { url: videoUrl } = useAssetObjectUrl(() => props.asset.id);

const emit = defineEmits<{
  close: [];
  submit: [params: Record<string, unknown>];
}>();

const video = ref<HTMLVideoElement | null>(null);
const duration = ref(0);
const currentTime = ref(0);
const start = ref(0);
const end = ref(0);
const markers = ref<number[]>([]);
const error = ref<string | null>(null);
const singleShotDetected = ref(false);

const isTrim = computed(() => props.action.id === "video.trim");
const isSplit = computed(() => props.action.id === "video.split");
const sortedMarkers = computed(() => [...markers.value].sort((left, right) => left - right));

watch(
  () => [props.open, props.action.id, props.asset.id],
  () => {
    currentTime.value = 0;
    start.value = 0;
    end.value = duration.value;
    markers.value = [];
    error.value = null;
    singleShotDetected.value = false;
  },
);

watch(
  () => store.shotDetectResult,
  (result) => {
    if (isSplit.value && result && result.assetId === props.asset.id) {
      markers.value = result.shots
        .filter((shot) => shot.start > 0)
        .map((shot) => Number(shot.start.toFixed(3)));
      singleShotDetected.value = result.shots.length <= 1;
    }
  },
  { immediate: true },
);

function formatTime(value: number) {
  if (!Number.isFinite(value)) {
    return "00:00.000";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.round((value % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds,
  ).padStart(3, "0")}`;
}

function clampTime(value: number) {
  return Math.min(Math.max(value, 0), duration.value || value);
}

function rounded(value: number) {
  return Number(value.toFixed(3));
}

function onLoadedMetadata() {
  duration.value = video.value?.duration ?? 0;
  end.value = duration.value;
}

function onTimeUpdate() {
  currentTime.value = video.value?.currentTime ?? 0;
}

function seek(value: string | number) {
  const next = clampTime(Number(value));
  currentTime.value = next;
  if (video.value) {
    video.value.currentTime = next;
  }
}

function setStartToCurrent() {
  start.value = Math.min(currentTime.value, Math.max(0, end.value - 0.001));
}

function setEndToCurrent() {
  end.value = Math.max(currentTime.value, start.value + 0.001);
}

function addMarkerAtCurrent() {
  const next = rounded(clampTime(currentTime.value));
  if (next <= 0 || (duration.value && next >= duration.value)) {
    error.value = "Markers must be inside the video, not at the very start or end.";
    return;
  }
  if (markers.value.some((marker) => Math.abs(marker - next) < 0.05)) {
    error.value = "A marker already exists at this point.";
    return;
  }
  markers.value = [...markers.value, next].sort((left, right) => left - right);
  error.value = null;
  console.log(markers.value);
}

function removeMarker(marker: number) {
  markers.value = markers.value.filter((candidate) => candidate !== marker);
}

function markerLeft(marker: number) {
  if (!duration.value) {
    return "0%";
  }
  return `${(marker / duration.value) * 100}%`;
}

function submit() {
  error.value = null;
  if (isTrim.value) {
    if (end.value <= start.value) {
      error.value = "The end marker must be after the start marker.";
      return;
    }
    emit("submit", { start: rounded(start.value), end: rounded(end.value) });
    return;
  }

  if (isSplit.value) {
    if (markers.value.length === 0) {
      error.value = "Add at least one split marker.";
      return;
    }
    emit("submit", { markers: sortedMarkers.value.map(rounded) });
  }
}
</script>

<template>
  <Dialog
    :open="open"
    :title="action.title"
    :description="action.description"
    class="max-h-[92vh] max-w-5xl overflow-auto"
    @close="emit('close')"
  >
    <form class="space-y-5" @submit.prevent="submit">
      <video
        ref="video"
        class="max-h-[52vh] w-full rounded-md bg-black"
        :src="videoUrl"
        controls
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
      />

      <div class="space-y-3 rounded-lg border bg-background p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span class="font-medium">{{ formatTime(currentTime) }}</span>
          <span class="text-muted-foreground">Duration {{ formatTime(duration) }}</span>
        </div>

        <input
          class="w-full accent-primary"
          type="range"
          min="0"
          :max="duration || 0"
          step="0.001"
          :value="currentTime"
          @input="seek(($event.target as HTMLInputElement).value)"
        />

        <div class="relative h-4 rounded-full bg-muted">
          <template v-if="isTrim">
            <div
              class="absolute top-0 h-4 rounded-full bg-primary/30"
              :style="{
                left: duration ? `${(start / duration) * 100}%` : '0%',
                width: duration ? `${((end - start) / duration) * 100}%` : '0%',
              }"
            />
          </template>
          <button
            v-for="marker in sortedMarkers"
            :key="marker"
            class="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
            type="button"
            :style="{ left: markerLeft(marker) }"
            :title="formatTime(marker)"
            @click="seek(marker)"
          />
        </div>
      </div>

      <div v-if="isTrim" class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border bg-background p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p>Start</p>
              <p class="text-muted-foreground">{{ formatTime(start) }}</p>
            </div>
            <Button variant="outline" size="sm" @click="setStartToCurrent">
              Use playhead
            </Button>
          </div>
          <input
            class="mt-3 w-full accent-primary"
            type="range"
            min="0"
            :max="duration || 0"
            step="0.001"
            v-model.number="start"
          />
        </div>

        <div class="rounded-lg border bg-background p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p>End</p>
              <p class="text-muted-foreground">{{ formatTime(end) }}</p>
            </div>
            <Button variant="outline" size="sm" @click="setEndToCurrent">
              Use playhead
            </Button>
          </div>
          <input
            class="mt-3 w-full accent-primary"
            type="range"
            min="0"
            :max="duration || 0"
            step="0.001"
            v-model.number="end"
          />
        </div>
      </div>

      <div v-if="isSplit" class="rounded-lg border bg-background p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p>Split markers</p>
            <p class="text-muted-foreground">
              Add markers at the current playhead position.
            </p>
          </div>
          <Button variant="outline" @click="addMarkerAtCurrent">
            <Plus class="h-4 w-4" />
            Add marker
          </Button>
        </div>

        <p
          v-if="singleShotDetected"
          class="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-muted-foreground"
        >
          Shot detection found only a single shot in this video, so no split markers were
          prefilled. Add markers manually at the points where you want to split.
        </p>

        <div v-if="sortedMarkers.length" class="mt-4 grid gap-2">
          <div
            v-for="marker in sortedMarkers"
            :key="marker"
            class="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2"
          >
            <button class="text-sm font-medium" type="button" @click="seek(marker)">
              {{ formatTime(marker) }}
            </button>
            <Button
              variant="ghost"
              size="icon"
              title="Remove marker"
              aria-label="Remove marker"
              @click="removeMarker(marker)"
            >
              <Trash2 class="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 p-3">
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" @click="emit('close')">Cancel</Button>
        <Button type="submit">Create job</Button>
      </div>
    </form>
  </Dialog>
</template>
