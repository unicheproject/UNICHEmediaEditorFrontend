<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import AudioMixAction from "@/components/AudioMixAction.vue";
import ImageCropAction from "@/components/ImageCropAction.vue";
import VideoSubtitleEmbedAction from "@/components/VideoSubtitleEmbedAction.vue";
import VideoTimelineAction from "@/components/VideoTimelineAction.vue";
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
import { TRANSCRIPT_EXPORT_FORMATS, transcriptExportFile, type TranscriptExportFormat } from "@/lib/transcriptExport";
import { useWorkspaceStore, type TranscribeResult } from "@/stores/workspace";
import type { Asset, Capability, JsonSchemaProperty } from "@/types/api";

const props = defineProps<{
  action: Capability | null;
  open: boolean;
  transcribing?: boolean;
  transcriptResult?: TranscribeResult | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [params: Record<string, unknown>];
}>();

const store = useWorkspaceStore();
const values = reactive<Record<string, string>>({});
const transcriptDraft = ref("");
const transcriptFormat = ref<TranscriptExportFormat>("txt");
const savingTranscriptAsset = ref(false);

watch(
  () => props.transcriptResult,
  (result) => {
    transcriptDraft.value = result?.text ?? "";
  },
  { immediate: true },
);

const transcriptSourceAsset = computed(() => {
  const assetId = props.transcriptResult?.assetId;
  return assetId ? store.assets.find((asset) => asset.id === assetId) ?? null : null;
});

async function saveTranscriptAsset() {
  if (!props.transcriptResult) {
    return;
  }
  savingTranscriptAsset.value = true;
  try {
    const base = transcriptSourceAsset.value?.original_filename.replace(/\.[^./]+$/, "") ?? "transcript";
    const file = transcriptExportFile(
      `${base}.transcript`,
      transcriptFormat.value,
      transcriptDraft.value,
      props.transcriptResult.segments,
    );
    await store.uploadAsset(file);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to save transcript");
  } finally {
    savingTranscriptAsset.value = false;
  }
}

const fields = computed(() => (props.action ? visibleInputProperties(props.action) : []));
const required = computed(() => (props.action ? requiredFields(props.action) : new Set<string>()));
const timelineAsset = computed(() => {
  if (!props.action || !["video.trim", "video.split"].includes(props.action.id)) {
    return null;
  }
  const [asset] = store.selectedAssets;
  return asset?.media_type === "video" ? asset : null;
});
const cropAsset = computed(() => {
  if (!props.action || props.action.id !== "image.crop") {
    return null;
  }
  const [asset] = store.selectedAssets;
  return asset?.media_type === "image" ? asset : null;
});

watch(
  () => props.action?.id,
  () => {
    Object.keys(values).forEach((key) => delete values[key]);
    fields.value.forEach(([name, property]) => {
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
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function fieldHintText(name: string, property: JsonSchemaProperty) {
  if (property.type === "array") {
    return "Enter comma-separated values.";
  }
  return props.action ? fieldHint(props.action.id, name) : undefined;
}

function inputMin(name: string) {
  return props.action ? fieldMin(props.action.id, name) : undefined;
}

function inputMax(name: string) {
  return props.action ? fieldMax(props.action.id, name) : undefined;
}

function assetOptions(name: string): Asset[] {
  const mediaType = assetFieldMediaType(name);
  if (!mediaType) {
    return store.assets;
  }
  return store.assets.filter((asset) => asset.media_type === mediaType);
}

function submit() {
  const params: Record<string, unknown> = {};
  for (const [name, property] of fields.value) {
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
  <VideoTimelineAction
    v-if="action && timelineAsset"
    :open="open"
    :action="action"
    :asset="timelineAsset"
    @close="emit('close')"
    @submit="emit('submit', $event)"
  />

  <ImageCropAction
    v-else-if="action && cropAsset"
    :open="open"
    :action="action"
    :asset="cropAsset"
    @close="emit('close')"
    @submit="emit('submit', $event)"
  />

  <VideoSubtitleEmbedAction
    v-else-if="action && action.id === 'video.subtitle.embed'"
    :open="open"
    :action="action"
    @close="emit('close')"
    @submit="emit('submit', $event)"
  />

  <AudioMixAction
    v-else-if="action && action.id === 'audio.mix'"
    :open="open"
    :action="action"
    @close="emit('close')"
    @submit="emit('submit', $event)"
  />

  <Dialog
    v-else
    :open="open && !!action"
    :title="action?.title ?? 'Action'"
    :description="action?.description"
    class="max-h-[90vh] overflow-auto"
    @close="emit('close')"
  >
    <div
      v-if="action?.id === 'audio.transcribe' && transcriptResult != null"
      class="space-y-4"
    >
      <Textarea v-model="transcriptDraft" :rows="12" class="min-h-[260px]" />
      <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div class="flex items-center gap-2">
          <Select v-model="transcriptFormat" class="w-auto">
            <option v-for="option in TRANSCRIPT_EXPORT_FORMATS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
          <Button
            variant="muted"
            :disabled="savingTranscriptAsset"
            @click="saveTranscriptAsset"
          >
            {{ savingTranscriptAsset ? "Saving…" : "Save as" }}
          </Button>
        </div>
        <Button @click="emit('close')">Close</Button>
      </div>
    </div>

    <div
      v-else-if="action?.id === 'audio.transcribe' && transcribing"
      class="space-y-4"
    >
      <p class="rounded-md bg-muted p-3 text-muted-foreground">Transcribing audio…</p>
      <div class="flex justify-end gap-2 border-t pt-4">
        <Button variant="muted" @click="emit('close')">Close</Button>
      </div>
    </div>

    <form v-else-if="action" class="space-y-4" @submit.prevent="submit">
      <div v-if="fields.length" class="space-y-4">
        <label v-for="[name, property] in fields" :key="name" class="block space-y-2">
          <span class="field-label">
            {{ fieldLabel(name) }}
            <span v-if="required.has(name)" class="text-destructive">*</span>
          </span>

          <Select
            v-if="isAssetReference(name, property)"
            v-model="values[name]"
            :required="required.has(name)"
          >
            <option value="">Select asset</option>
            <option v-for="asset in assetOptions(name)" :key="asset.id" :value="asset.id">
              {{ asset.original_filename }}
            </option>
          </Select>

          <Select v-else-if="property.enum?.length" v-model="values[name]">
            <option v-for="option in property.enum" :key="option" :value="option">
              {{ option }}
            </option>
          </Select>

          <Textarea
            v-else-if="name.includes('text') || name.includes('prompt')"
            v-model="values[name]"
            :placeholder="property.description"
          />

          <Input
            v-else
            v-model="values[name]"
            :type="fieldInputType(property)"
            :step="fieldStep(property)"
            :min="inputMin(name)"
            :max="inputMax(name)"
            :required="required.has(name)"
            :placeholder="property.type === 'array' ? 'Comma-separated values' : property.description"
          />

          <span v-if="fieldHintText(name, property)" class="field-hint">
            {{ fieldHintText(name, property) }}
          </span>
        </label>
      </div>

      <p v-else class="rounded-md bg-muted p-3 text-muted-foreground">
        This action does not require extra parameters.
      </p>

      <div class="flex justify-end gap-2 border-t pt-4">
        <Button variant="muted" @click="emit('close')">Cancel</Button>
        <Button type="submit">Create job</Button>
      </div>
    </form>
  </Dialog>
</template>
