<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ChevronDown, ChevronUp, FileAudio, Film, GripVertical, Image as ImageIcon, X } from "lucide-vue-next";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import {
  fieldHint,
  fieldInputType,
  fieldMax,
  fieldMin,
  fieldStep,
  normalizeValue,
  requiredFields,
  visibleInputProperties,
} from "@/lib/capabilities";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Asset, Capability, MediaType } from "@/types/api";

const props = withDefaults(
  defineProps<{
    action: Capability;
    open: boolean;
    mediaType: MediaType;
    // Plural, lowercase noun for this media type, e.g. "videos", "audio clips", "images".
    itemsLabel: string;
    orderHint?: string;
    minItems?: number;
  }>(),
  {
    orderHint: "Drag to reorder, or use the arrows to change the order they're combined in.",
    minItems: 2,
  },
);

const emit = defineEmits<{
  close: [];
  submit: [params: Record<string, unknown>];
}>();

const store = useWorkspaceStore();
const values = reactive<Record<string, string>>({});
const orderedAssets = ref<Asset[]>([]);
const error = ref<string | null>(null);
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

const rowIcons: Partial<Record<MediaType, typeof Film>> = {
  video: Film,
  audio: FileAudio,
  image: ImageIcon,
};
const rowIcon = computed(() => rowIcons[props.mediaType] ?? Film);

const itemsLabelTitle = computed(
  () => props.itemsLabel.charAt(0).toUpperCase() + props.itemsLabel.slice(1),
);

// Fields other than asset_ids (already excluded by visibleInputProperties),
// rendered generically like the default action dialog does.
const extraFields = computed(() => visibleInputProperties(props.action));
const required = computed(() => requiredFields(props.action));

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }
    error.value = null;
    dragIndex.value = null;
    dragOverIndex.value = null;

    // Seed the list in selection order (the Set preserves insertion order),
    // falling back to any selected asset not captured there.
    const seen = new Set<string>();
    const fromSelectionOrder = [...store.selectedAssetIds]
      .map((id) => store.assets.find((asset) => asset.id === id))
      .filter((asset): asset is Asset => !!asset && asset.media_type === props.mediaType);
    fromSelectionOrder.forEach((asset) => seen.add(asset.id));
    const remaining = store.selectedAssets.filter(
      (asset) => asset.media_type === props.mediaType && !seen.has(asset.id),
    );
    orderedAssets.value = [...fromSelectionOrder, ...remaining];

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

function moveUp(index: number) {
  if (index <= 0) {
    return;
  }
  const items = [...orderedAssets.value];
  [items[index - 1], items[index]] = [items[index], items[index - 1]];
  orderedAssets.value = items;
}

function moveDown(index: number) {
  if (index >= orderedAssets.value.length - 1) {
    return;
  }
  const items = [...orderedAssets.value];
  [items[index + 1], items[index]] = [items[index], items[index + 1]];
  orderedAssets.value = items;
}

function removeAsset(index: number) {
  orderedAssets.value = orderedAssets.value.filter((_, candidateIndex) => candidateIndex !== index);
}

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function onDrop(index: number) {
  const fromIndex = dragIndex.value;
  dragIndex.value = null;
  dragOverIndex.value = null;
  if (fromIndex === null || fromIndex === index) {
    return;
  }
  const items = [...orderedAssets.value];
  const [moved] = items.splice(fromIndex, 1);
  items.splice(index, 0, moved);
  orderedAssets.value = items;
}

function submit() {
  if (orderedAssets.value.length < props.minItems) {
    error.value = `Select at least ${props.minItems} ${props.itemsLabel}.`;
    return;
  }

  const params: Record<string, unknown> = {
    asset_ids: orderedAssets.value.map((asset) => asset.id),
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
      <div class="space-y-2">
        <span class="field-label">{{ itemsLabelTitle }} ({{ orderedAssets.length }})</span>
        <p class="field-hint">{{ orderHint }}</p>

        <ul v-if="orderedAssets.length" class="space-y-1.5">
          <li
            v-for="(asset, index) in orderedAssets"
            :key="asset.id"
            class="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm transition-colors"
            :class="dragOverIndex === index && dragIndex !== index && 'border-primary ring-2 ring-primary/20'"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragenter.prevent="dragOverIndex = index"
            @dragover.prevent
            @dragleave="dragOverIndex === index && (dragOverIndex = null)"
            @drop.prevent="onDrop(index)"
            @dragend="dragIndex = null; dragOverIndex = null"
          >
            <GripVertical class="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
            <span class="w-4 shrink-0 text-center text-xs text-muted-foreground">{{ index + 1 }}</span>
            <component :is="rowIcon" class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 truncate" :title="asset.original_filename">
              {{ asset.original_filename }}
            </span>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Move up"
                aria-label="Move up"
                :disabled="index === 0"
                @click="moveUp(index)"
              >
                <ChevronUp class="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Move down"
                aria-label="Move down"
                :disabled="index === orderedAssets.length - 1"
                @click="moveDown(index)"
              >
                <ChevronDown class="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Remove"
                aria-label="Remove"
                @click="removeAsset(index)"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
          </li>
        </ul>
        <p v-else class="rounded-md border border-dashed p-3 text-muted-foreground">
          No {{ itemsLabel }} selected.
        </p>
      </div>

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
