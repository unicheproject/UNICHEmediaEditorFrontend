<script setup lang="ts">
import { Edit, Home, MoreVertical, RefreshCw, Trash2 } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import ConfirmDialog from "@/components/ConfirmDialog.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Textarea from "@/components/ui/Textarea.vue";
import UserMenu from "@/components/UserMenu.vue";
import { useWorkspaceStore } from "@/stores/workspace";

const emit = defineEmits<{
  home: [];
  projectDeleted: [];
}>();

const store = useWorkspaceStore();
const editOpen = ref(false);
const name = ref("");
const description = ref("");
const saving = ref(false);
const confirmDeleteOpen = ref(false);
const deleting = ref(false);
const projectMenuOpen = ref(false);
const projectMenuRoot = ref<HTMLElement | null>(null);

function onDocumentClick(event: MouseEvent) {
  if (projectMenuRoot.value && !projectMenuRoot.value.contains(event.target as Node)) {
    projectMenuOpen.value = false;
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") projectMenuOpen.value = false;
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});

function handleRefresh() {
  projectMenuOpen.value = false;
  store.loadProjectData();
}

function handleEditClick() {
  projectMenuOpen.value = false;
  openEdit();
}

function handleDeleteClick() {
  projectMenuOpen.value = false;
  confirmDeleteOpen.value = true;
}

watch(
  () => store.selectedProject,
  (project) => {
    if (!editOpen.value && project) {
      name.value = project.name;
      description.value = project.description ?? "";
    }
  },
  { immediate: true },
);

function openEdit() {
  if (!store.selectedProject) {
    return;
  }
  name.value = store.selectedProject.name;
  description.value = store.selectedProject.description ?? "";
  editOpen.value = true;
}

async function submitEdit() {
  if (!store.selectedProject || !name.value.trim()) {
    return;
  }

  saving.value = true;
  try {
    await store.updateProject(store.selectedProject.id, {
      name: name.value.trim(),
      description: description.value.trim() || null,
    });
    editOpen.value = false;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to update project");
  } finally {
    saving.value = false;
  }
}

async function confirmDeleteProject() {
  if (!store.selectedProject) {
    return;
  }

  deleting.value = true;
  try {
    await store.deleteProject(store.selectedProject.id);
    confirmDeleteOpen.value = false;
    emit("projectDeleted");
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to delete project");
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <header class="border-b bg-card shadow-xs">
    <div class="flex min-h-16 flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
      <div class="flex min-w-0 items-center gap-4">
        <Button variant="secondary" size="icon" title="Project selection" aria-label="Project selection" @click="$emit('home')">
          <Home class="h-4 w-4" />
          <span class="sr-only">Project selection</span>
        </Button>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <div style="
              font-size: 16px;
              font-weight: 800;
              letter-spacing: 0.08em;
              margin-right: auto;
              color: var(--deep);
            ">
              <span style="
                background: var(--grad-brand);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
              ">U</span>NICHE Media Editor
            </div>
            <Badge variant="outline">Project workspace</Badge>
          </div>
          <p class="truncate text-muted-foreground font-bold">
            {{ store.selectedProject?.name ?? "No project selected" }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UserMenu />

        <div ref="projectMenuRoot" class="relative">
          <Button
            variant="outline"
            size="icon"
            aria-haspopup="menu"
            :aria-expanded="projectMenuOpen"
            title="Project actions"
            aria-label="Project actions"
            @click="projectMenuOpen = !projectMenuOpen"
          >
            <MoreVertical class="h-4 w-4" />
          </Button>

          <div
            v-if="projectMenuOpen"
            role="menu"
            class="absolute right-0 z-50 mt-2 w-56 space-y-1 rounded-md border bg-background p-2 shadow-sm"
          >
            <button
              role="menuitem"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!store.selectedProjectId"
              @click="handleRefresh"
            >
              <RefreshCw class="h-4 w-4" />
              Refresh
            </button>
            <button
              role="menuitem"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!store.selectedProject"
              @click="handleEditClick"
            >
              <Edit class="h-4 w-4" />
              Edit project
            </button>
            <button
              role="menuitem"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!store.selectedProject"
              @click="handleDeleteClick"
            >
              <Trash2 class="h-4 w-4" />
              Delete project
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <Dialog :open="editOpen" title="Edit project" @close="editOpen = false">
    <form class="space-y-4" @submit.prevent="submitEdit">
      <label class="block space-y-2">
        <span class="field-label">Name</span>
        <Input v-model="name" required placeholder="Project name" />
      </label>
      <label class="block space-y-2">
        <span class="field-label">Description</span>
        <Textarea v-model="description" placeholder="Optional project context" />
      </label>
      <div class="flex justify-end gap-2">
        <Button variant="muted" @click="editOpen = false">Cancel</Button>
        <Button type="submit" :disabled="saving || !name.trim()">Save</Button>
      </div>
    </form>
  </Dialog>

  <ConfirmDialog
    :open="confirmDeleteOpen"
    title="Delete project"
    :description="`Delete '${store.selectedProject?.name ?? 'this project'}'? Its assets and jobs will no longer be available from this workspace.`"
    :loading="deleting"
    confirm-label="Delete project"
    @close="confirmDeleteOpen = false"
    @confirm="confirmDeleteProject"
  />
</template>
