import { config } from "@/config";
import { getToken, login } from "@/platform/auth";
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

const API_BASE_URL = config.mediaEditorApiUrl;
const API_PREFIX = "/api/v1";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
  detail?: unknown;
}

/** Attach the bearer token; bounce to the IdP on 401 (expired/invalid token). */
async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, { ...options, headers });
  if (response.status === 401) {
    login(window.location.pathname + window.location.search);
    throw new Error("Not authenticated");
  }
  return response;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authedFetch(path, options);

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

/** Fetch asset bytes with auth and return an object URL. Caller must revoke it. */
export async function fetchAssetObjectUrl(assetId: string): Promise<string> {
  const response = await authedFetch(`/assets/${assetId}/download`);
  if (!response.ok) {
    throw new Error(`Failed to load asset (${response.status})`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Download asset bytes with auth and save them with the original filename. */
export async function downloadAsset(asset: Asset): Promise<void> {
  const url = await fetchAssetObjectUrl(asset.id);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = asset.original_filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),
  createProject: (payload: {
    name: string;
    slug: string;
    org_id: string;
    description?: string | null;
  }) => request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
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
