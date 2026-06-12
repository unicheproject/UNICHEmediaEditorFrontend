export type MediaType = "image" | "audio" | "video" | "subtitle";

export type CostClass = "hosted_ai" | "future_gpu" | "deterministic";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Asset {
  id: string;
  project_id: string;
  filename: string;
  original_filename: string;
  media_type: MediaType;
  mime_type: string;
  extension: string;
  size_bytes: number;
  storage_path: string;
  checksum_sha256: string;
  source_asset_id: string | null;
  is_intermediate: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface JsonSchemaProperty {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
  enum?: string[];
  format?: string;
  description?: string;
  title?: string;
  default?: unknown;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
}

export interface JsonSchema {
  type?: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface Capability {
  id: string;
  title: string;
  description: string;
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  supported_media_types: MediaType[];
  cost_class: CostClass;
  enabled: boolean;
}

export interface Job {
  id: string;
  project_id: string | null;
  asset_id: string | null;
  capability_id: string;
  status: JobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
