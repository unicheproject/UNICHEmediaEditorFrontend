<script setup lang="ts">
import { FolderPlus, RefreshCw } from "lucide-vue-next";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { useWorkspaceStore } from "@/stores/workspace";

const store = useWorkspaceStore();

const createOpen = ref(false);
const name = ref("");
const description = ref("");
const saving = ref(false);

async function submitProject() {
  if (!name.value.trim()) {
    return;
  }

  saving.value = true;
  try {
    await store.createProject({
      name: name.value.trim(),
      description: description.value.trim() || null,
    });
    name.value = "";
    description.value = "";
    createOpen.value = false;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to create project");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <aside class="flex min-h-0 flex-col gap-4">
    <Card class="p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold">UNICHE</h1>
          <p class="text-sm text-muted-foreground">Media Editor PoC</p>
        </div>
        <Button size="icon" variant="outline" title="Refresh workspace" @click="store.loadInitial">
          <RefreshCw class="h-4 w-4" />
        </Button>
      </div>
    </Card>

    <Card class="p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Projects
        </h2>
        <Button size="sm" @click="createOpen = true">
          <FolderPlus class="h-4 w-4" />
          New
        </Button>
      </div>

      <Select
        v-if="store.projects.length"
        :model-value="store.selectedProjectId ?? undefined"
        @update:model-value="store.selectProject"
      >
        <option v-for="project in store.projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </Select>
      <p v-else class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Create a project to start uploading assets.
      </p>

      <div v-if="store.selectedProject" class="mt-4 border-t pt-4">
        <h3 class="font-medium">{{ store.selectedProject.name }}</h3>
        <p class="mt-1 min-h-5 text-sm text-muted-foreground">
          {{ store.selectedProject.description || "No description" }}
        </p>
      </div>
    </Card>

    <Dialog :open="createOpen" title="Create project" @close="createOpen = false">
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
          <Button variant="outline" @click="createOpen = false">Cancel</Button>
          <Button type="submit" :disabled="saving || !name.trim()">Create</Button>
        </div>
      </form>
    </Dialog>
  </aside>
</template>
