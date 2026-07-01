<script setup lang="ts">
import { Edit, FolderOpen, FolderPlus, RefreshCw, Trash2 } from "lucide-vue-next";
import { computed, onMounted, ref, watch } from "vue";

import ConfirmDialog from "@/components/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import UserMenu from "@/components/UserMenu.vue";
import { listOrganisations } from "@/lib/catalogue";
import { useAuthStore } from "@/stores/auth";
import { useAuthzStore } from "@/stores/authz";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Organisation, Project } from "@/types/api";

const emit = defineEmits<{
  openProject: [projectId: string];
}>();

const store = useWorkspaceStore();
const auth = useAuthStore();
const authz = useAuthzStore();

const createOpen = ref(false);
const editingProject = ref<Project | null>(null);
const projectToDelete = ref<Project | null>(null);
const name = ref("");
const slug = ref("");
const slugTouched = ref(false);
const description = ref("");
const orgId = ref("");
const orgs = ref<Organisation[]>([]);
const saving = ref(false);
const deleting = ref(false);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const slugValid = computed(() => SLUG_RE.test(slug.value));
/** Only managers-of-org can create projects (the catalogue enforces this). */
const canCreate = computed(() => authz.managedOrganisations.length > 0);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

// Keep slug in sync with name until the user edits it by hand (create mode only).
watch(name, (value) => {
  if (!editingProject.value && !slugTouched.value) {
    slug.value = slugify(value);
  }
});

async function loadOrgs() {
  const managed = new Set(authz.managedOrganisations);
  try {
    const all = await listOrganisations();
    orgs.value = all.filter((o) => managed.has(o.id)).map((o) => ({ id: o.id, name: o.name }));
  } catch {
    orgs.value = [];
  }
  // Ensure every managed org is selectable even if name resolution missed it.
  for (const id of authz.managedOrganisations) {
    if (!orgs.value.some((o) => o.id === id)) {
      orgs.value.push({ id, name: id });
    }
  }
}

onMounted(async () => {
  if (!auth.authenticated) {
    return;
  }
  await authz.load();
  await loadOrgs();
});

function formatDate(value?: string | null) {
  if (!value) return "—";
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
      if (!orgId.value || !slugValid.value) {
        return;
      }
      await store.createProject({
        name: name.value.trim(),
        slug: slug.value.trim(),
        org_id: orgId.value,
        description: description.value.trim() || null,
      });
    }

    const projectId = editingProject.value ? editingProject.value.id : store.selectedProjectId;
    closeDialog();
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
  slug.value = "";
  slugTouched.value = false;
  description.value = "";
  orgId.value = orgs.value[0]?.id ?? authz.managedOrganisations[0] ?? "";
  createOpen.value = true;
}

function openEdit(project: Project) {
  editingProject.value = project;
  name.value = project.name;
  slug.value = project.slug ?? "";
  description.value = project.description ?? "";
  createOpen.value = true;
}

function closeDialog() {
  createOpen.value = false;
  editingProject.value = null;
  name.value = "";
  slug.value = "";
  slugTouched.value = false;
  description.value = "";
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
          <Button v-if="canCreate" @click="openCreate">
            <FolderPlus class="h-4 w-4" />
            New project
          </Button>
          <UserMenu />
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
          <template v-if="canCreate">
            <p class="mt-1 text-sm text-muted-foreground">
              Create a project before uploading and processing media assets.
            </p>
            <Button class="mt-4" @click="openCreate">
              <FolderPlus class="h-4 w-4" />
              New project
            </Button>
          </template>
          <p v-else class="mt-1 text-sm text-muted-foreground">
            You don't manage any organisation yet. Ask an organisation manager to add you, or
            create the project in the UNICHE Portal.
          </p>
        </div>
      </Card>
    </main>

    <Dialog
      :open="createOpen"
      :title="editingProject ? 'Edit project' : 'Create project'"
      @close="closeDialog"
    >
      <form class="space-y-4" @submit.prevent="submitProject">
        <label v-if="!editingProject" class="block space-y-2">
          <span class="field-label">Organisation</span>
          <Select v-model="orgId">
            <option v-for="org in orgs" :key="org.id" :value="org.id">{{ org.name }}</option>
          </Select>
        </label>
        <label class="block space-y-2">
          <span class="field-label">Name</span>
          <Input v-model="name" required placeholder="Archive restoration" />
        </label>
        <label v-if="!editingProject" class="block space-y-2">
          <span class="field-label">Slug</span>
          <Input v-model="slug" placeholder="archive-restoration" @input="slugTouched = true" />
          <span v-if="slug && !slugValid" class="text-xs text-destructive">
            Use 2–63 lowercase letters, numbers or dashes.
          </span>
        </label>
        <label class="block space-y-2">
          <span class="field-label">Description</span>
          <Textarea v-model="description" placeholder="Optional project context" />
        </label>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="closeDialog">Cancel</Button>
          <Button
            type="submit"
            :disabled="saving || !name.trim() || (!editingProject && (!orgId || !slugValid))"
          >
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
