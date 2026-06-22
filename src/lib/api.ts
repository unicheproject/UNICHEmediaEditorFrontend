import type {
  AgentMessageResponse,
  AgentPlan,
  AgentSession,
  Asset,
  Capability,
  Job,
  Page,
  Project,
} from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = "/api/v1";

export const assetDownloadUrl = (assetId: string) =>
  `${API_BASE_URL}${API_PREFIX}/assets/${assetId}/download`;

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
  detail?: unknown;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = payload.error?.message ?? JSON.stringify(payload.detail ?? payload);
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),
  createProject: (payload: { name: string; description?: string | null }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (
    projectId: string,
    payload: { name?: string; description?: string | null },
  ) =>
    request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: string) =>
    request<void>(`/projects/${projectId}`, { method: "DELETE" }),
  listAssets: (projectId: string) => request<Asset[]>(`/projects/${projectId}/assets`),
  uploadAsset: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Asset>(`/projects/${projectId}/assets`, {
      method: "POST",
      body: form,
    });
  },
  deleteAsset: (assetId: string) => request<void>(`/assets/${assetId}`, { method: "DELETE" }),
  listCapabilities: () => request<Capability[]>("/capabilities"),
  createJob: (payload: {
    capability_id: string;
    project_id: string;
    asset_id?: string;
    input?: Record<string, unknown>;
  }) => request<Job>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  listProjectJobs: (projectId: string) =>
    request<Page<Job>>(`/projects/${projectId}/jobs?limit=20&offset=0`),
  createAgentSession: (payload: { project_id: string; asset_ids: string[] }) =>
    request<AgentSession>("/agent/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sendAgentMessage: (sessionId: string, content: string) =>
    request<AgentMessageResponse>(`/agent/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  approveAgentPlan: (planId: string) =>
    request<AgentPlan>(`/agent/plans/${planId}/approve`, { method: "POST" }),
  getAgentPlan: (planId: string) => request<AgentPlan>(`/agent/plans/${planId}`),
};
