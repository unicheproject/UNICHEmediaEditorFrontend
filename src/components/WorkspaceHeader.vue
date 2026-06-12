<script setup lang="ts">
import { Home, RefreshCw } from "lucide-vue-next";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import { useWorkspaceStore } from "@/stores/workspace";

defineEmits<{
  home: [];
}>();

const store = useWorkspaceStore();
</script>

<template>
  <header class="border-b bg-card">
    <div class="flex min-h-20 flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
      <div class="flex min-w-0 items-center gap-4">
        <Button variant="outline" size="icon" title="Project selection" @click="$emit('home')">
          <Home class="h-4 w-4" />
          <span class="sr-only">Project selection</span>
        </Button>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">UNICHE Media Editor</h1>
            <Badge variant="secondary">Project workspace</Badge>
          </div>
          <p class="mt-1 truncate text-sm text-muted-foreground">
            {{ store.selectedProject?.name ?? "No project selected" }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Badge v-if="store.selectedProject" variant="outline">
          {{ store.assets.length }} assets
        </Badge>
        <Badge v-if="store.selectedAssetIds.size" variant="outline">
          {{ store.selectedAssetIds.size }} selected
        </Badge>
        <Button
          variant="outline"
          :disabled="!store.selectedProjectId"
          @click="store.loadProjectData()"
        >
          <RefreshCw class="h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  </header>
</template>
