import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { api } from "@/lib/api";
import type { TranscriptSegment } from "@/lib/transcriptExport";
import type { Asset, Capability, Job, Project, ShotDetectShot } from "@/types/api";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export interface JobNotice {
  status: "succeeded" | "failed" | "cancelled";
  message: string;
}

export interface ShotDetectResult {
  assetId: string;
  shots: ShotDetectShot[];
}

export interface TranscribeResult {
  jobId: string;
  assetId: string | null;
  text: string;
  segments: TranscriptSegment[] | null;
}

export interface UploadProgress {
  id: string;
  name: string;
  progress: number;
}

function extractTranscriptText(output: Record<string, unknown> | null): string {
  if (!output) {
    return "";
  }
  if (typeof output.text === "string") {
    return output.text;
  }
  if (typeof output.transcript === "string") {
    return output.transcript;
  }
  if (typeof output.transcription === "string") {
    return output.transcription;
  }
  const stringValue = Object.values(output).find((value) => typeof value === "string");
  return typeof stringValue === "string" ? stringValue : "";
}

function extractTranscriptSegments(output: Record<string, unknown> | null): TranscriptSegment[] | null {
  const segments = output?.segments;
  if (!Array.isArray(segments)) {
    return null;
  }
  const parsed = segments
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return null;
      }
      const { start, end, text } = segment as Record<string, unknown>;
      if (typeof start !== "number" || typeof end !== "number" || typeof text !== "string") {
        return null;
      }
      return { start, end, text };
    })
    .filter((segment): segment is TranscriptSegment => segment !== null);
  return parsed.length ? parsed : null;
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const projects = ref<Project[]>([]);
  const selectedProjectId = ref<string | null>(null);
  const assets = ref<Asset[]>([]);
  const capabilities = ref<Capability[]>([]);
  const jobs = ref<Job[]>([]);
  const selectedAssetIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  const uploads = ref<UploadProgress[]>([]);
  const uploading = computed(() => uploads.value.length > 0);
  const error = ref<string | null>(null);
  const jobNotice = ref<JobNotice | null>(null);
  const shotDetectResult = ref<ShotDetectResult | null>(null);
  const transcribeResult = ref<TranscribeResult | null>(null);
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

  const activeJob = computed(
    () => latestJobs.value.find((job) => !TERMINAL_STATUSES.has(job.status)) ?? null,
  );

  function setError(message: string | null) {
    error.value = message;
  }

  function setJobNotice(notice: JobNotice | null) {
    jobNotice.value = notice;
  }

  function clearShotDetectResult() {
    shotDetectResult.value = null;
  }

  function clearTranscribeResult() {
    transcribeResult.value = null;
  }

  function capabilityTitle(capabilityId: string) {
    return capabilities.value.find((capability) => capability.id === capabilityId)?.title ?? capabilityId;
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
    const uploadId = crypto.randomUUID();
    uploads.value = [...uploads.value, { id: uploadId, name: file.name, progress: 0 }];
    try {
      const asset = await api.uploadAsset(selectedProjectId.value, file, (fraction) => {
        const entry = uploads.value.find((candidate) => candidate.id === uploadId);
        if (entry) {
          entry.progress = Math.round(fraction * 100);
        }
      });
      assets.value = [asset, ...assets.value];
    } finally {
      uploads.value = uploads.value.filter((candidate) => candidate.id !== uploadId);
    }
  }

  async function updateAsset(assetId: string, payload: { original_filename?: string }) {
    const asset = await api.updateAsset(assetId, payload);
    const index = assets.value.findIndex((candidate) => candidate.id === assetId);
    if (index >= 0) {
      assets.value.splice(index, 1, asset);
    }
    return asset;
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
          const title = capabilityTitle(job.capability_id);
          if (job.status === "succeeded") {
            jobNotice.value = { status: "succeeded", message: `${title} completed successfully.` };
            if (selectedProjectId.value) {
              await loadProjectData(selectedProjectId.value);
            }
            if (job.capability_id === "video.shot.detect" && job.asset_id) {
              const output = job.output as { shots?: ShotDetectShot[] } | null;
              if (Array.isArray(output?.shots) && output.shots.length) {
                shotDetectResult.value = { assetId: job.asset_id, shots: output.shots };
              }
            }
            if (job.capability_id === "audio.transcribe") {
              const output = job.output as Record<string, unknown> | null;
              const text = extractTranscriptText(output);
              if (text) {
                transcribeResult.value = {
                  jobId: job.id,
                  assetId: job.asset_id,
                  text,
                  segments: extractTranscriptSegments(output),
                };
              }
            }
          } else if (job.status === "failed") {
            jobNotice.value = {
              status: "failed",
              message: job.error ? `${title} failed: ${job.error}` : `${title} failed.`,
            };
          } else if (job.status === "cancelled") {
            jobNotice.value = { status: "cancelled", message: `${title} was cancelled.` };
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
    activeJob,
    selectedAssetIds,
    selectedAssets,
    loading,
    uploads,
    uploading,
    error,
    jobNotice,
    shotDetectResult,
    transcribeResult,
    setError,
    setJobNotice,
    clearShotDetectResult,
    clearTranscribeResult,
    capabilityTitle,
    loadInitial,
    loadProjectData,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
    uploadAsset,
    updateAsset,
    deleteAsset,
    toggleAsset,
    clearSelection,
    createJob,
  };
});
