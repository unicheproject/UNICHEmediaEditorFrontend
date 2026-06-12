<script setup lang="ts">
import { computed, reactive, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import VideoTimelineAction from "@/components/VideoTimelineAction.vue";
import {
  assetFieldMediaType,
  fieldInputType,
  fieldStep,
  requiredFields,
  visibleInputProperties,
} from "@/lib/capabilities";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, Capability, JsonSchemaProperty } from "@/types/api";

const props = defineProps<{
  action: Capability | null;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [params: Record<string, unknown>];
}>();

const store = useWorkspaceStore();
const values = reactive<Record<string, string>>({});

const fields = computed(() => (props.action ? visibleInputProperties(props.action) : []));
const required = computed(() => (props.action ? requiredFields(props.action) : new Set<string>()));
const timelineAsset = computed(() => {
  if (!props.action || !["video.trim", "video.split"].includes(props.action.id)) {
    return null;
  }
  const [asset] = store.selectedAssets;
  return asset?.media_type === "video" ? asset : null;
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

function assetOptions(name: string): Asset[] {
  const mediaType = assetFieldMediaType(name);
  if (!mediaType) {
    return store.assets;
  }
  return store.assets.filter((asset) => asset.media_type === mediaType);
}

function isAssetReference(name: string, property: JsonSchemaProperty) {
  return name.endsWith("_asset_id") && property.format === "uuid";
}

function normalizeValue(property: JsonSchemaProperty, raw: string) {
  if (property.type === "integer") {
    return Number.parseInt(raw, 10);
  }
  if (property.type === "number") {
    return Number.parseFloat(raw);
  }
  if (property.type === "boolean") {
    return raw === "true";
  }
  if (property.type === "array") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) =>
        property.items?.type === "number" || property.items?.type === "integer"
          ? Number(item)
          : item,
      );
  }
  return raw;
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

  <Dialog
    v-else
    :open="open && !!action"
    :title="action?.title ?? 'Action'"
    :description="action?.description"
    class="max-h-[90vh] overflow-auto"
    @close="emit('close')"
  >
    <form v-if="action" class="space-y-4" @submit.prevent="submit">
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
            :required="required.has(name)"
            :placeholder="property.type === 'array' ? 'Comma-separated values' : property.description"
          />

          <span v-if="property.type === 'array'" class="field-hint">
            Enter comma-separated values.
          </span>
        </label>
      </div>

      <p v-else class="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        This action does not require extra parameters.
      </p>

      <div class="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" @click="emit('close')">Cancel</Button>
        <Button type="submit">Create job</Button>
      </div>
    </form>
  </Dialog>
</template>
