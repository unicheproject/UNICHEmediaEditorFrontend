<script setup lang="ts">
import { AlertCircle, LogIn } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

import ActionPanel from "@/components/ActionPanel.vue";
import AssetGrid from "@/components/AssetGrid.vue";
import JobsPanel from "@/components/JobsPanel.vue";
import ProjectSelection from "@/components/ProjectSelection.vue";
import TimelineComposer from "@/components/TimelineComposer.vue";
import WorkspaceHeader from "@/components/WorkspaceHeader.vue";
import Button from "@/components/ui/Button.vue";
import { useAuthStore } from "@/stores/auth";
import { useAuthzStore } from "@/stores/authz";
import { useWorkspaceStore } from "@/stores/workspace";

const store = useWorkspaceStore();
const auth = useAuthStore();
const authz = useAuthzStore();
const showingProjects = ref(true);

onMounted(async () => {
  if (!auth.authenticated) {
    return;
  }
  // Load the authorization context (org picker) and the workspace in parallel.
  void authz.load();
  await store.loadInitial();
  await openProjectFromUrl();
  window.addEventListener("popstate", handlePopState);
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", handlePopState);
});

function signIn() {
  auth.login(window.location.pathname + window.location.search);
}

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
    <!-- Sign-in gate: the app boots only once silent SSO has resolved (see main.ts). -->
    <div
      v-if="auth.ready && !auth.authenticated"
      class="flex min-h-screen items-center justify-center p-6"
    >
      <div class="max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 class="text-2xl font-semibold">UNICHE Media Editor</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Sign in with your UNICHE account to continue.
        </p>
        <Button class="mt-6" @click="signIn">
          <LogIn class="h-4 w-4" />
          Sign in
        </Button>
      </div>
    </div>

    <template v-else>
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
          <section class="grid min-h-0 gap-4 lg:grid-rows-2">
            <div class="min-h-0 overflow-hidden">
              <AssetGrid />
            </div>

            <TimelineComposer />
          </section>

          <aside class="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1fr)_minmax(220px,0.7fr)]">
            <ActionPanel />
            <JobsPanel />
          </aside>
        </main>
      </div>
    </template>
  </div>
</template>
