<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import Cropper, { type CropperImage, type CropperSelection } from "cropperjs";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { useAssetObjectUrl } from "@/composables/useAssetObjectUrl";
import type { Asset, Capability } from "@/types/api";

const props = defineProps<{
  action: Capability;
  asset: Asset;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [params: Record<string, unknown>];
}>();

const { url: imageUrl } = useAssetObjectUrl(() => props.asset.id);

const image = ref<HTMLImageElement | null>(null);
const cropBox = ref({ x: 0, y: 0, width: 0, height: 0 });
const error = ref<string | null>(null);

// Static (non-zoomable, non-rotatable) image with a single draggable/resizable
// selection box — a graphical stand-in for the x/y/width/height fields.
const CROPPER_TEMPLATE =
  '<cropper-canvas background style="width: 100%; height: 100%;">' +
  '<cropper-image alt="Image to crop"></cropper-image>' +
  '<cropper-shade hidden></cropper-shade>' +
  '<cropper-handle action="select" plain></cropper-handle>' +
  '<cropper-selection initial-coverage="0.8" movable resizable>' +
  '<cropper-grid role="grid" bordered covered></cropper-grid>' +
  '<cropper-crosshair centered></cropper-crosshair>' +
  '<cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>' +
  '<cropper-handle action="n-resize"></cropper-handle>' +
  '<cropper-handle action="e-resize"></cropper-handle>' +
  '<cropper-handle action="s-resize"></cropper-handle>' +
  '<cropper-handle action="w-resize"></cropper-handle>' +
  '<cropper-handle action="ne-resize"></cropper-handle>' +
  '<cropper-handle action="nw-resize"></cropper-handle>' +
  '<cropper-handle action="se-resize"></cropper-handle>' +
  '<cropper-handle action="sw-resize"></cropper-handle>' +
  "</cropper-selection>" +
  "</cropper-canvas>";

let cropper: Cropper | null = null;
let cropperImage: CropperImage | null = null;
let selection: CropperSelection | null = null;

function destroyCropper() {
  selection?.removeEventListener("change", onSelectionChange);
  cropper?.destroy();
  cropper = null;
  cropperImage = null;
  selection = null;
  cropBox.value = { x: 0, y: 0, width: 0, height: 0 };
}

// Maps the selection's on-screen rectangle back to pixel coordinates in the
// original image, using the image's affine transform (works regardless of
// how the image was scaled/centered to fit the canvas).
function naturalRectFromSelection() {
  if (!selection || !cropperImage || !image.value) {
    return null;
  }
  const [a, b, c, d, e, f] = cropperImage.$getTransform();
  const determinant = a * d - b * c;
  if (!determinant) {
    return null;
  }
  const centerX = image.value.naturalWidth / 2;
  const centerY = image.value.naturalHeight / 2;
  const toNatural = (x: number, y: number) => {
    const u = x - centerX - e;
    const v = y - centerY - f;
    return {
      x: centerX + (d * u - c * v) / determinant,
      y: centerY + (-b * u + a * v) / determinant,
    };
  };
  const topLeft = toNatural(selection.x, selection.y);
  const bottomRight = toNatural(selection.x + selection.width, selection.y + selection.height);
  return {
    x: Math.round(Math.min(topLeft.x, bottomRight.x)),
    y: Math.round(Math.min(topLeft.y, bottomRight.y)),
    width: Math.round(Math.abs(bottomRight.x - topLeft.x)),
    height: Math.round(Math.abs(bottomRight.y - topLeft.y)),
  };
}

function onSelectionChange() {
  const rect = naturalRectFromSelection();
  if (rect) {
    cropBox.value = rect;
  }
}

function initCropper() {
  destroyCropper();
  if (!image.value) {
    return;
  }
  cropper = new Cropper(image.value, { template: CROPPER_TEMPLATE });
  cropperImage = cropper.getCropperImage();
  selection = cropper.getCropperSelection();
  selection?.addEventListener("change", onSelectionChange);
}

watch(
  () => [props.open, props.asset.id],
  () => {
    error.value = null;
    destroyCropper();
  },
);

onBeforeUnmount(destroyCropper);

function submit() {
  const rect = naturalRectFromSelection();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    error.value = "Draw a crop area on the image before continuing.";
    return;
  }
  emit("submit", rect);
}
</script>

<template>
  <Dialog
    :open="open"
    :title="action.title"
    :description="action.description"
    class="max-h-[92vh] max-w-4xl overflow-auto"
    @close="emit('close')"
  >
    <form class="space-y-4" @submit.prevent="submit">
      <div class="relative h-[60vh] overflow-hidden rounded-lg border bg-black">
        <img ref="image" :src="imageUrl" alt="" class="hidden" @load="initCropper" />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm">
        <span class="text-muted-foreground">
          Selection: {{ cropBox.width }} × {{ cropBox.height }} px at ({{ cropBox.x }}, {{ cropBox.y }})
        </span>
        <Button type="button" variant="outline" size="sm" @click="selection?.$reset()">
          Reset selection
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" @click="emit('close')">Cancel</Button>
        <Button type="submit">Create job</Button>
      </div>
    </form>
  </Dialog>
</template>
