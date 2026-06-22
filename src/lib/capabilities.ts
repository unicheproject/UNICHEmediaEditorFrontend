import type { Asset, Capability, JsonSchemaProperty, MediaType } from "@/types/api";

export interface AgentAction {
  id: "agent";
  title: "Agent";
  description: string;
  disabled: true;
  stub: true;
}

export type ActionOption = Capability | AgentAction;

export function isAgentAction(action: ActionOption): action is AgentAction {
  return "stub" in action;
}

export const agentAction: AgentAction = {
  id: "agent",
  title: "Agent",
  description: "Describe a workflow in natural language; the agent proposes a plan you approve.",
  disabled: true,
  stub: true,
};

export function hasAssetIdsInput(capability: Capability) {
  return capability.input_schema.properties?.asset_ids?.type === "array";
}

export function inputProperties(capability: Capability) {
  return capability.input_schema.properties ?? {};
}

export function visibleInputProperties(capability: Capability) {
  return Object.entries(inputProperties(capability)).filter(
    ([name]) => name !== "asset_id" && name !== "asset_ids",
  );
}

export function supportsSelection(capability: Capability, assets: Asset[]) {
  if (!capability.enabled || assets.length === 0) {
    return false;
  }

  const selectedTypes = new Set(assets.map((asset) => asset.media_type));
  const supportsEveryType = [...selectedTypes].every((type) =>
    capability.supported_media_types.includes(type),
  );

  if (!supportsEveryType) {
    return false;
  }

  if (assets.length > 1) {
    return hasAssetIdsInput(capability);
  }

  return true;
}

export function requiredFields(capability: Capability) {
  return new Set(capability.input_schema.required ?? []);
}

export function mediaLabel(mediaType: MediaType) {
  const labels: Record<MediaType, string> = {
    image: "Image",
    audio: "Audio",
    video: "Video",
    subtitle: "Subtitle",
  };
  return labels[mediaType];
}

export function costLabel(costClass: Capability["cost_class"]) {
  const labels: Record<Capability["cost_class"], string> = {
    deterministic: "Tool",
    hosted_ai: "Hosted AI",
    future_gpu: "GPU",
  };
  return labels[costClass];
}

export function fieldInputType(property: JsonSchemaProperty) {
  if (property.type === "number" || property.type === "integer") {
    return "number";
  }
  return "text";
}

export function fieldStep(property: JsonSchemaProperty) {
  if (property.type === "integer") {
    return "1";
  }
  if (property.type === "number") {
    return "0.1";
  }
  return undefined;
}

export function assetFieldMediaType(fieldName: string): MediaType | null {
  if (fieldName.includes("subtitle")) {
    return "subtitle";
  }
  if (fieldName.includes("music") || fieldName.includes("audio")) {
    return "audio";
  }
  if (fieldName.includes("video")) {
    return "video";
  }
  if (fieldName.includes("image")) {
    return "image";
  }
  return null;
}
