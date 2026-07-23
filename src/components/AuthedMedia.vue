<script setup lang="ts">
import { computed } from "vue";

import { useAssetObjectUrl } from "@/composables/useAssetObjectUrl";

/**
 * Renders an asset's bytes (image/video/audio) via an authenticated object URL.
 * Use instead of <img src="…/download"> now that the bytes route requires a token.
 */
const props = defineProps<{
  assetId: string;
  kind: "img" | "video" | "audio";
  alt?: string;
  controls?: boolean;
  autoplay?: boolean;
}>();

const { url } = useAssetObjectUrl(() => props.assetId);
const loaded = computed(() => !!url.value);
</script>

<template>
  <template v-if="kind === 'img'">
    <img v-if="loaded" :src="url" :alt="alt" v-bind="$attrs" />
    <div v-else class="flex items-center justify-center" v-bind="$attrs">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-white" />
      <span class="sr-only">Loading…</span>
    </div>
  </template>
  <template v-else-if="kind === 'video'">
    <video v-if="loaded" :src="url" :controls="controls" :autoplay="autoplay" v-bind="$attrs" />
    <div v-else class="flex min-h-[200px] items-center justify-center" v-bind="$attrs">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-white" />
      <span class="sr-only">Loading…</span>
    </div>
  </template>
  <template v-else>
    <audio v-if="loaded" :src="url" :controls="controls" :autoplay="autoplay" v-bind="$attrs" />
    <div v-else class="flex h-10 items-center justify-center" v-bind="$attrs">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-white" />
      <span class="sr-only">Loading…</span>
    </div>
  </template>
</template>
