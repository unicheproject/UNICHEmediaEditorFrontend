<script setup lang="ts">
import { Edit, Home, RefreshCw, Trash2 } from "lucide-vue-next";
import { ref, watch } from "vue";

import ConfirmDialog from "@/components/ConfirmDialog.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Textarea from "@/components/ui/Textarea.vue";
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
        <Button :disabled="!store.selectedProject" @click="openEdit">
          <Edit class="h-4 w-4" />
          Edit project
        </Button>
        <Button
          variant="destructive"
          :disabled="!store.selectedProject"
          @click="confirmDeleteOpen = true"
        >
          <Trash2 class="h-4 w-4" />
          Delete
        </Button>
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
        <Button variant="outline" @click="editOpen = false">Cancel</Button>
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
