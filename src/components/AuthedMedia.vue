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
  <img v-if="kind === 'img'" :src="url" :alt="alt" v-bind="$attrs" />
  <video
    v-else-if="kind === 'video'"
    :src="url"
    :controls="controls"
    :autoplay="autoplay"
    v-bind="$attrs"
  />
  <audio
    v-else
    :src="url"
    :controls="controls"
    :autoplay="autoplay"
    v-bind="$attrs"
  />
  <span v-if="!loaded" class="sr-only">Loading…</span>
</template>
