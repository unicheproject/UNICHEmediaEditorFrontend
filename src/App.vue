<script setup lang="ts">
import { AlertCircle } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

import ActionPanel from "@/components/ActionPanel.vue";
import AssetGrid from "@/components/AssetGrid.vue";
import JobsPanel from "@/components/JobsPanel.vue";
import ProjectSelection from "@/components/ProjectSelection.vue";
import WorkspaceHeader from "@/components/WorkspaceHeader.vue";
import Button from "@/components/ui/Button.vue";
import { useWorkspaceStore } from "@/stores/workspace";

const store = useWorkspaceStore();
const showingProjects = ref(true);

onMounted(async () => {
  await store.loadInitial();
  await openProjectFromUrl();
  window.addEventListener("popstate", handlePopState);
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", handlePopState);
});

function projectIdFromUrl() {
  return new URLSearchParams(window.location.search).get("project");
}

function writeProjectUrl(projectId: string | null, replace = false) {
  const url = new URL(window.location.href);
  if (projectId) {
    url.searchParams.set("project", projectId);
  } else {
    url.searchParams.delete("project");
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
}

async function openProject(projectId: string, updateUrl = true) {
  try {
    await store.selectProject(projectId);
    showingProjects.value = false;
    if (updateUrl) {
      writeProjectUrl(projectId);
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to open project");
    goHome(true);
  }
}

async function openProjectFromUrl() {
  const projectId = projectIdFromUrl();
  if (!projectId) {
    showingProjects.value = true;
    return;
  }

  if (!store.projects.some((project) => project.id === projectId)) {
    store.setError("The linked project could not be found.");
    goHome(true, true);
    return;
  }

  await openProject(projectId, false);
}

function goHome(updateUrl = true, replace = false) {
  store.clearSelection();
  showingProjects.value = true;
  if (updateUrl) {
    writeProjectUrl(null, replace);
  }
}

function handlePopState() {
  const projectId = projectIdFromUrl();
  if (projectId) {
    void openProject(projectId, false);
  } else {
    goHome(false);
  }
}
</script>

<template>
  <div class="min-h-screen">
    <div
      v-if="store.error"
      class="fixed left-1/2 top-4 z-40 flex w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm shadow"
    >
      <div class="flex min-w-0 items-center gap-2">
        <AlertCircle class="h-4 w-4 shrink-0 text-destructive" />
        <span class="truncate">{{ store.error }}</span>
      </div>
      <Button size="sm" variant="ghost" @click="store.setError(null)">Dismiss</Button>
    </div>

    <ProjectSelection v-if="showingProjects" @open-project="openProject" />

    <div v-else class="grid min-h-screen grid-rows-[auto_minmax(0,1fr)]">
      <WorkspaceHeader @home="goHome" @project-deleted="goHome" />

      <main class="grid min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="min-h-0">
          <AssetGrid />
        </div>

        <aside class="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <ActionPanel />
          <JobsPanel />
        </aside>
      </main>
    </div>
  </div>
</template>
