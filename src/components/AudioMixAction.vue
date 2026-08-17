<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import {
  assetFieldMediaType,
  fieldHint,
  fieldInputType,
  fieldMax,
  fieldMin,
  fieldStep,
  isAssetReference,
  normalizeValue,
  requiredFields,
  visibleInputProperties,
} from "@/lib/capabilities";
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
const values = reactive<Record<string, string>>({});

const selectedVideo = computed(
  () => store.selectedAssets.find((asset) => asset.media_type === "video") ?? null,
);
const selectedAudio = computed(
  () => store.selectedAssets.find((asset) => asset.media_type === "audio") ?? null,
);

const videoOptions = computed(() => store.assets.filter((asset) => asset.media_type === "video"));
const audioOptions = computed(() => store.assets.filter((asset) => asset.media_type === "audio"));

// Fields other than the video/audio asset slots (e.g. music_volume, mode),
// rendered generically like the default action dialog does.
const extraFields = computed(() =>
  visibleInputProperties(props.action).filter(
    ([name, property]) => !(isAssetReference(name, property) && assetFieldMediaType(name) === "audio"),
  ),
);
const required = computed(() => requiredFields(props.action));

const pickedVideoId = ref("");
const pickedAudioId = ref("");
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }
    pickedVideoId.value = selectedVideo.value?.id ?? "";
    pickedAudioId.value = selectedAudio.value?.id ?? "";
    error.value = null;
    Object.keys(values).forEach((key) => delete values[key]);
    extraFields.value.forEach(([name, property]) => {
      if (typeof property.default === "string" || typeof property.default === "number") {
        values[name] = String(property.default);
      } else if (property.enum?.length) {
        values[name] = property.enum[0];
      } else {
        values[name] = "";
      }
    });
  },
  { immediate: true },
);

function fieldLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function submit() {
  const videoAssetId = selectedVideo.value?.id ?? pickedVideoId.value;
  const audioAssetId = selectedAudio.value?.id ?? pickedAudioId.value;
  if (!videoAssetId || !audioAssetId) {
    error.value = "Select both a video and an audio asset before continuing.";
    return;
  }

  const params: Record<string, unknown> = {
    video_asset_id: videoAssetId,
    music_asset_id: audioAssetId,
  };
  for (const [name, property] of extraFields.value) {
    const raw = values[name]?.trim() ?? "";
    if (!raw && !required.value.has(name)) {
      continue;
    }
    params[name] = normalizeValue(property, raw);
  }
  emit("submit", params);
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
        <span class="field-label">Audio</span>
        <p v-if="selectedAudio" class="rounded-md border bg-muted px-3 py-2 text-sm">
          {{ selectedAudio.original_filename }}
        </p>
        <Select v-else v-model="pickedAudioId">
          <option value="">Select audio asset</option>
          <option v-for="asset in audioOptions" :key="asset.id" :value="asset.id">
            {{ asset.original_filename }}
          </option>
        </Select>
      </label>

      <label v-for="[name, property] in extraFields" :key="name" class="block space-y-2">
        <span class="field-label">
          {{ fieldLabel(name) }}
          <span v-if="required.has(name)" class="text-destructive">*</span>
        </span>

        <Select v-if="property.enum?.length" v-model="values[name]">
          <option v-for="option in property.enum" :key="option" :value="option">
            {{ option }}
          </option>
        </Select>

        <Input
          v-else
          v-model="values[name]"
          :type="fieldInputType(property)"
          :step="fieldStep(property)"
          :min="fieldMin(action.id, name)"
          :max="fieldMax(action.id, name)"
          :required="required.has(name)"
          :placeholder="property.description"
        />

        <span v-if="fieldHint(action.id, name)" class="field-hint">
          {{ fieldHint(action.id, name) }}
        </span>
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
