<script setup lang="ts">
import { AlertCircle, CheckCircle2, LogIn } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

import ActionPanel from "@/components/ActionPanel.vue";
import AssetGrid from "@/components/AssetGrid.vue";
import AssetList from "@/components/AssetList.vue";
import JobsPanel from "@/components/JobsPanel.vue";
import ProjectSelection from "@/components/ProjectSelection.vue";
import TimelineComposer from "@/components/TimelineComposer.vue";
import WorkspaceHeader from "@/components/WorkspaceHeader.vue";
import Button from "@/components/ui/Button.vue";
import { useAuthStore } from "@/stores/auth";
import { useAuthzStore } from "@/stores/authz";
import { useWorkspaceStore } from "@/stores/workspace";
import { useAgentChatStore } from "@/stores/agentChat";

const store = useWorkspaceStore();
const auth = useAuthStore();
const authz = useAuthzStore();
const agentChat = useAgentChatStore();

const showingProjects = ref(true);
const activeTab = ref<"assets" | "timeline">("assets");

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
  <div class="min-h-screen" :class="{'pointer-events-none':store.hasRunningJob}">
    <!-- Sign-in gate: the app boots only once silent SSO has resolved (see main.ts). -->
    <div
      v-if="auth.ready && !auth.authenticated"
      class="flex min-h-screen items-center justify-center p-6"
    >
      <div class="max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <h3>UNICHE Media Editor</h3>
        <p class="mt-2 text-muted-foreground">
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
        class="fixed left-1/2 bottom-8 z-50 flex w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-rose-800 bg-rose-200 text-rose-800 px-4 py-3 text-sm shadow-xl"
      >
        <div class="flex min-w-0 items-center gap-2">
          <AlertCircle class="h-4 w-4 shrink-0 text-destructive text-rose-800"/>
          <span class="truncate ">{{ store.error }}</span>
        </div>
        <Button size="sm" variant="ghost" @click="store.setError(null)">Dismiss</Button>
      </div>

      <div
        v-if="store.jobNotice"
        class="fixed left-1/2 bottom-8 z-50 flex w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow"
        :class="
          store.jobNotice.status === 'succeeded'
            ? 'border-emerald-800 bg-emerald-200 text-emerald-800'
            : 'border-rose-800 bg-rose-200 text-rose-800'
        "
      >
        <div class="flex min-w-0 items-center gap-2">
          <CheckCircle2
            v-if="store.jobNotice.status === 'succeeded'"
            class="h-4 w-4 shrink-0 text-emerald-800"
          />
          <AlertCircle v-else class="h-4 w-4 shrink-0 text-destructive text-rose-800" />
          <span class="truncate">{{ store.jobNotice.message }}</span>
        </div>
        <Button size="sm" variant="ghost" @click="store.setJobNotice(null)">Dismiss</Button>
      </div>

      <Teleport to="body">
        <div
          v-if="store.hasRunningJob"
          class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/40 backdrop-blur-sm"
        >
          <div class="flex flex-col items-center gap-3">
            <div class="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p>Job is running…</p>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="agentChat.sending || agentChat.creatingSession"
          class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/40 backdrop-blur-sm"
        >
          <div class="flex flex-col items-center gap-3">
            <div class="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p>Agent is thinking…</p>
          </div>
        </div>
      </Teleport>

      <ProjectSelection v-if="showingProjects" @open-project="openProject" />

      <div v-else class="grid h-screen grid-rows-[auto_1fr]">
        <WorkspaceHeader @home="goHome" @project-deleted="goHome" />

        <main class="flex min-h-0 flex-col gap-4 overflow-hidden p-4">
          <div class="flex items-center gap-1 rounded-lg bg-muted p-1 self-start">
            <button
              class="rounded-md px-4 py-1.5 transition-colors"
              :class="
                activeTab === 'assets'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="activeTab = 'assets'"
            >
              Assets
            </button>
            <button
              class="rounded-md px-4 py-1.5 transition-colors"
              :class="
                activeTab === 'timeline'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="activeTab = 'timeline'"
            >
              Timeline
            </button>
          </div>

          <div
            v-if="activeTab === 'assets'"
            class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1"
          >
            <AssetGrid />
            <aside class="grid min-h-0 gap-4 lg:grid-rows-[1fr_1fr]">
              <ActionPanel />
              <JobsPanel />
            </aside>
          </div>

          <div
            v-if="activeTab === 'timeline'"
            class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1"
          >
            <TimelineComposer />
            <AssetList />
          </div>
        </main>
      </div>
    </template>
  </div>
</template>
