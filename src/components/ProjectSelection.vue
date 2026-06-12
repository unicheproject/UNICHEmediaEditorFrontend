<script setup lang="ts">
import { Edit, FolderOpen, FolderPlus, RefreshCw, Trash2 } from "lucide-vue-next";
import { ref } from "vue";

import ConfirmDialog from "@/components/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Project } from "@/types/api";

const emit = defineEmits<{
  openProject: [projectId: string];
}>();

const store = useWorkspaceStore();
const createOpen = ref(false);
const editingProject = ref<Project | null>(null);
const projectToDelete = ref<Project | null>(null);
const name = ref("");
const description = ref("");
const saving = ref(false);
const deleting = ref(false);

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

async function submitProject() {
  if (!name.value.trim()) {
    return;
  }

  saving.value = true;
  try {
    const wasEditing = editingProject.value !== null;
    if (editingProject.value) {
      await store.updateProject(editingProject.value.id, {
        name: name.value.trim(),
        description: description.value.trim() || null,
      });
    } else {
      await store.createProject({
        name: name.value.trim(),
        description: description.value.trim() || null,
      });
    }

    const projectId = editingProject.value ? editingProject.value.id : store.selectedProjectId;
    editingProject.value = null;
    name.value = "";
    description.value = "";
    createOpen.value = false;
    if (projectId && !wasEditing) {
      emit("openProject", projectId);
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to save project");
  } finally {
    saving.value = false;
  }
}

function openCreate() {
  editingProject.value = null;
  name.value = "";
  description.value = "";
  createOpen.value = true;
}

function openEdit(project: Project) {
  editingProject.value = project;
  name.value = project.name;
  description.value = project.description ?? "";
  createOpen.value = true;
}

function closeDialog() {
  createOpen.value = false;
  editingProject.value = null;
}

async function confirmDeleteProject() {
  if (!projectToDelete.value) {
    return;
  }

  deleting.value = true;
  try {
    await store.deleteProject(projectToDelete.value.id);
    projectToDelete.value = null;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to delete project");
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <section class="min-h-screen">
    <header class="border-b bg-card">
      <div class="container flex min-h-20 items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold">UNICHE Media Editor</h1>
          <p class="text-sm text-muted-foreground">Select a project to manage its assets.</p>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" @click="store.loadInitial">
            <RefreshCw class="h-4 w-4" />
            Refresh
          </Button>
          <Button @click="openCreate">
            <FolderPlus class="h-4 w-4" />
            New project
          </Button>
        </div>
      </div>
    </header>

    <main class="container py-6">
      <div
        v-if="store.projects.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
      >
        <Card
          v-for="project in store.projects"
          :key="project.id"
          class="flex min-h-56 cursor-pointer flex-col p-5 transition-colors hover:border-primary/60"
          @click="emit('openProject', project.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="line-clamp-2 text-lg font-semibold">{{ project.name }}</h2>
              <p class="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {{ project.description || "No description" }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Edit project"
                @click.stop="openEdit(project)"
              >
                <Edit class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete project"
                @click.stop="projectToDelete = project"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
              <FolderOpen class="h-5 w-5 text-primary" />
            </div>
          </div>
          <div class="mt-auto border-t pt-4 text-xs text-muted-foreground">
            Updated {{ formatDate(project.updated_at) }}
          </div>
        </Card>
      </div>

      <Card v-else class="flex min-h-96 items-center justify-center border-dashed p-8 text-center">
        <div class="max-w-sm">
          <FolderPlus class="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 class="mt-3 font-medium">No projects yet</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Create a project before uploading and processing media assets.
          </p>
          <Button class="mt-4" @click="openCreate">
            <FolderPlus class="h-4 w-4" />
            New project
          </Button>
        </div>
      </Card>
    </main>

    <Dialog
      :open="createOpen"
      :title="editingProject ? 'Edit project' : 'Create project'"
      @close="closeDialog"
    >
      <form class="space-y-4" @submit.prevent="submitProject">
        <label class="block space-y-2">
          <span class="field-label">Name</span>
          <Input v-model="name" required placeholder="Archive restoration" />
        </label>
        <label class="block space-y-2">
          <span class="field-label">Description</span>
          <Textarea v-model="description" placeholder="Optional project context" />
        </label>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="closeDialog">Cancel</Button>
          <Button type="submit" :disabled="saving || !name.trim()">
            {{ editingProject ? "Save" : "Create" }}
          </Button>
        </div>
      </form>
    </Dialog>

    <ConfirmDialog
      :open="!!projectToDelete"
      title="Delete project"
      :description="`Delete '${projectToDelete?.name ?? 'this project'}'? Its assets and jobs will no longer be available from this workspace.`"
      :loading="deleting"
      confirm-label="Delete project"
      @close="projectToDelete = null"
      @confirm="confirmDeleteProject"
    />
  </section>
</template>
