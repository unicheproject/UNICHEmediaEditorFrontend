import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { api } from "@/lib/api";
import type { Asset, Capability, Job, Project } from "@/types/api";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export const useWorkspaceStore = defineStore("workspace", () => {
  const projects = ref<Project[]>([]);
  const selectedProjectId = ref<string | null>(null);
  const assets = ref<Asset[]>([]);
  const capabilities = ref<Capability[]>([]);
  const jobs = ref<Job[]>([]);
  const selectedAssetIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  const uploading = ref(false);
  const error = ref<string | null>(null);
  const activePolls = new Map<string, number>();

  const selectedProject = computed(
    () => projects.value.find((project) => project.id === selectedProjectId.value) ?? null,
  );

  const selectedAssets = computed(() =>
    assets.value.filter((asset) => selectedAssetIds.value.has(asset.id)),
  );

  const latestJobs = computed(() =>
    [...jobs.value].sort(
      (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
    ),
  );

  const hasRunningJob = computed(() =>
    jobs.value.some((job) => !TERMINAL_STATUSES.has(job.status)),
  );

  function setError(message: string | null) {
    error.value = message;
  }

  async function loadInitial() {
    loading.value = true;
    error.value = null;
    try {
      const [projectList, capabilityList] = await Promise.all([
        api.listProjects(),
        api.listCapabilities(),
      ]);
      projects.value = projectList;
      capabilities.value = capabilityList;

      if (selectedProjectId.value) {
        await loadProjectData(selectedProjectId.value);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unable to load workspace";
    } finally {
      loading.value = false;
    }
  }

  async function loadProjectData(projectId = selectedProjectId.value) {
    if (!projectId) {
      assets.value = [];
      jobs.value = [];
      selectedAssetIds.value = new Set();
      return;
    }

    const [assetList, jobPage] = await Promise.all([
      api.listAssets(projectId),
      api.listProjectJobs(projectId),
    ]);
    assets.value = assetList;
    jobs.value = jobPage.items;
    selectedAssetIds.value = new Set(
      [...selectedAssetIds.value].filter((id) => assetList.some((asset) => asset.id === id)),
    );
  }

  async function selectProject(projectId: string) {
    selectedProjectId.value = projectId;
    selectedAssetIds.value = new Set();
    await loadProjectData(projectId);
  }

  async function createProject(payload: {
    name: string;
    slug: string;
    org_id: string;
    description?: string | null;
  }) {
    const project = await api.createProject(payload);
    projects.value = [project, ...projects.value];
    await selectProject(project.id);
  }

  async function updateProject(
    projectId: string,
    payload: { name?: string; description?: string | null },
  ) {
    const project = await api.updateProject(projectId, payload);
    const index = projects.value.findIndex((candidate) => candidate.id === projectId);
    if (index >= 0) {
      projects.value.splice(index, 1, project);
    } else {
      projects.value.unshift(project);
    }
    return project;
  }

  async function deleteProject(projectId: string) {
    await api.deleteProject(projectId);
    projects.value = projects.value.filter((project) => project.id !== projectId);
    if (selectedProjectId.value === projectId) {
      selectedProjectId.value = null;
      assets.value = [];
      jobs.value = [];
      selectedAssetIds.value = new Set();
    }
  }

  async function uploadAsset(file: File) {
    if (!selectedProjectId.value) {
      throw new Error("Select a project before uploading assets.");
    }
    uploading.value = true;
    try {
      const asset = await api.uploadAsset(selectedProjectId.value, file);
      assets.value = [asset, ...assets.value];
    } finally {
      uploading.value = false;
    }
  }

  async function deleteAsset(assetId: string) {
    await api.deleteAsset(assetId);
    assets.value = assets.value.filter((asset) => asset.id !== assetId);
    const selected = new Set(selectedAssetIds.value);
    selected.delete(assetId);
    selectedAssetIds.value = selected;
  }

  function toggleAsset(assetId: string) {
    const next = new Set(selectedAssetIds.value);
    if (next.has(assetId)) {
      next.delete(assetId);
    } else {
      next.add(assetId);
    }
    selectedAssetIds.value = next;
  }

  function clearSelection() {
    selectedAssetIds.value = new Set();
  }

  async function createJob(payload: {
    capability_id: string;
    asset_id?: string;
    input: Record<string, unknown>;
  }) {
    if (!selectedProjectId.value) {
      throw new Error("Select a project before creating a job.");
    }
    const job = await api.createJob({
      project_id: selectedProjectId.value,
      ...payload,
    });
    upsertJob(job);
    pollJob(job.id);
    return job;
  }

  function upsertJob(job: Job) {
    const existing = jobs.value.findIndex((candidate) => candidate.id === job.id);
    if (existing >= 0) {
      jobs.value.splice(existing, 1, job);
    } else {
      jobs.value.unshift(job);
    }
  }

  function pollJob(jobId: string) {
    if (activePolls.has(jobId)) {
      return;
    }

    const poll = async () => {
      try {
        const job = await api.getJob(jobId);
        upsertJob(job);

        if (TERMINAL_STATUSES.has(job.status)) {
          const intervalId = activePolls.get(jobId);
          if (intervalId) {
            window.clearInterval(intervalId);
            activePolls.delete(jobId);
          }
          if (job.status === "succeeded" && selectedProjectId.value) {
            await loadProjectData(selectedProjectId.value);
          }
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : "Unable to refresh job status";
      }
    };

    void poll();
    activePolls.set(jobId, window.setInterval(poll, 1500));
  }

  return {
    projects,
    selectedProjectId,
    selectedProject,
    assets,
    capabilities,
    jobs,
    latestJobs,
    hasRunningJob,
    selectedAssetIds,
    selectedAssets,
    loading,
    uploading,
    error,
    setError,
    loadInitial,
    loadProjectData,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
    uploadAsset,
    deleteAsset,
    toggleAsset,
    clearSelection,
    createJob,
  };
});
