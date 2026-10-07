<script setup lang="ts">
import type { Component } from "vue";
import { Film } from "lucide-vue-next";

import { useAssetThumbnail } from "@/composables/useAssetThumbnail";

const props = defineProps<{
  assetId: string;
  alt?: string;
  fallbackIcon?: Component;
}>();

const { thumbnailUrl, loading } = useAssetThumbnail(() => props.assetId);
</script>

<template>
  <div class="relative h-full w-full">
    <img v-if="thumbnailUrl" :src="thumbnailUrl" :alt="alt" class="h-full w-full object-cover" />
    <div v-else class="absolute inset-0 flex items-center justify-center">
      <div
        v-if="loading"
        class="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-white"
      />
      <component :is="fallbackIcon ?? Film" v-else class="h-12 w-12 text-muted-foreground" />
    </div>
  </div>
</template>
