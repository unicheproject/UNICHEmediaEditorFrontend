<script setup lang="ts">
import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Select from "@/components/ui/Select.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Capability } from "@/types/api";

const props = defineProps<{
  action: Capability;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [params: Record<string, unknown>];
}>();

const store = useWorkspaceStore();

const selectedVideo = computed(
  () => store.selectedAssets.find((asset) => asset.media_type === "video") ?? null,
);
const selectedSubtitle = computed(
  () => store.selectedAssets.find((asset) => asset.media_type === "subtitle") ?? null,
);

const videoOptions = computed(() => store.assets.filter((asset) => asset.media_type === "video"));
const subtitleOptions = computed(() =>
  store.assets.filter((asset) => asset.media_type === "subtitle"),
);

const pickedVideoId = ref("");
const pickedSubtitleId = ref("");
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }
    pickedVideoId.value = selectedVideo.value?.id ?? "";
    pickedSubtitleId.value = selectedSubtitle.value?.id ?? "";
    error.value = null;
  },
  { immediate: true },
);

function submit() {
  const videoAssetId = selectedVideo.value?.id ?? pickedVideoId.value;
  const subtitleAssetId = selectedSubtitle.value?.id ?? pickedSubtitleId.value;
  if (!videoAssetId || !subtitleAssetId) {
    error.value = "Select both a video and a subtitle asset before continuing.";
    return;
  }
  emit("submit", { video_asset_id: videoAssetId, subtitle_asset_id: subtitleAssetId });
}
</script>

<template>
  <Dialog
    :open="open"
    :title="action.title"
    :description="action.description"
    @close="emit('close')"
  >
    <form class="space-y-4" @submit.prevent="submit">
      <label class="block space-y-2">
        <span class="field-label">Video</span>
        <p v-if="selectedVideo" class="rounded-md border bg-muted px-3 py-2 text-sm">
          {{ selectedVideo.original_filename }}
        </p>
        <Select v-else v-model="pickedVideoId">
          <option value="">Select video asset</option>
          <option v-for="asset in videoOptions" :key="asset.id" :value="asset.id">
            {{ asset.original_filename }}
          </option>
        </Select>
      </label>

      <label class="block space-y-2">
        <span class="field-label">Subtitle</span>
        <p v-if="selectedSubtitle" class="rounded-md border bg-muted px-3 py-2 text-sm">
          {{ selectedSubtitle.original_filename }}
        </p>
        <Select v-else v-model="pickedSubtitleId">
          <option value="">Select subtitle asset</option>
          <option v-for="asset in subtitleOptions" :key="asset.id" :value="asset.id">
            {{ asset.original_filename }}
          </option>
        </Select>
      </label>

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
