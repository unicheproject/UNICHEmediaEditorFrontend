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

// Capabilities that take one asset of each listed type (e.g. one video + one
// subtitle), rather than an arbitrary-length asset_ids array.
const PAIRED_ASSET_CAPABILITY_TYPES: Record<string, MediaType[]> = {
  "video.subtitle.embed": ["video", "subtitle"],
  "audio.mix": ["video", "audio"],
};

function supportsPairedSelection(capability: Capability, assets: Asset[]) {
  const pairTypes = PAIRED_ASSET_CAPABILITY_TYPES[capability.id];
  if (!pairTypes) {
    return false;
  }
  const selectedTypes = assets.map((asset) => asset.media_type);
  const hasNoDuplicateTypes = new Set(selectedTypes).size === selectedTypes.length;
  return hasNoDuplicateTypes && selectedTypes.every((type) => pairTypes.includes(type));
}

// Capabilities that generate new media from scratch (text, params) rather than
// operating on a selected asset. These stay visible with no assets selected.
const STANDALONE_CAPABILITY_IDS = new Set(["audio.tts", "media.titlecard"]);

export function isStandaloneCapability(capability: Capability) {
  return STANDALONE_CAPABILITY_IDS.has(capability.id);
}

export function inputProperties(capability: Capability) {
  return capability.input_schema.properties ?? {};
}

export function visibleInputProperties(capability: Capability) {
  return Object.entries(inputProperties(capability)).filter(
    ([name]) => name !== "asset_id" && name !== "asset_ids",
  );
}

// Returns null when the capability can run against the current selection, or
// a one-line, user-facing reason why it can't (used to keep inapplicable
// actions visible-but-disabled instead of hiding them).
function selectionReason(capability: Capability, assets: Asset[]): string | null {
  if (isStandaloneCapability(capability)) {
    return null;
  }

  if (assets.length === 0) {
    return "Select an asset";
  }

  const selectedTypes = new Set(assets.map((asset) => asset.media_type));
  const supportsEveryType = [...selectedTypes].every((type) =>
    capability.supported_media_types.includes(type),
  );

  if (!supportsEveryType) {
    return `Requires ${capability.supported_media_types.map(mediaLabel).join(" or ")}`;
  }

  if (assets.length > 1) {
    if (hasAssetIdsInput(capability)) {
      return null;
    }
    const pairTypes = PAIRED_ASSET_CAPABILITY_TYPES[capability.id];
    if (pairTypes) {
      if (supportsPairedSelection(capability, assets)) {
        return null;
      }
      return `Select 1 ${mediaLabel(pairTypes[0]).toLowerCase()} and 1 ${mediaLabel(pairTypes[1]).toLowerCase()}`;
    }
    return "Select a single asset";
  }

  return null;
}

export function supportsSelection(capability: Capability, assets: Asset[]) {
  return capability.enabled && selectionReason(capability, assets) === null;
}

// One-line reason an action can't run against the current selection, for
// display on a disabled action button. Null when the action is applicable.
export function unavailableReason(capability: Capability, assets: Asset[]): string | null {
  if (!capability.enabled) {
    return "Unavailable";
  }
  return selectionReason(capability, assets);
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

interface FieldMeta {
  hint: string;
  min?: number;
  max?: number;
}

// Per-field guidance for capabilities whose JSON schema doesn't carry enough
// detail on its own (no description/min/max from the backend). Keyed by
// "<capability id>.<field name>".
const FIELD_META: Record<string, FieldMeta> = {
  "video.transcode.format": {
    hint: "Output container format (file extension). Example: mp4, mov, webm",
  },
  "video.transcode.video_codec": {
    hint: "FFmpeg video codec name. Example: libx264, libx265, libvpx-vp9",
  },
  "video.transcode.audio_codec": {
    hint: "FFmpeg audio codec name. Example: aac, libmp3lame, opus",
  },
  "video.crop.x": {
    hint: "Left offset of the crop rectangle, in pixels. Example: 0",
    min: 0,
  },
  "video.crop.y": {
    hint: "Top offset of the crop rectangle, in pixels. Example: 0",
    min: 0,
  },
  "video.crop.width": {
    hint: "Width of the crop rectangle, in pixels. Example: 1280",
    min: 1,
  },
  "video.crop.height": {
    hint: "Height of the crop rectangle, in pixels. Example: 720",
    min: 1,
  },
  "video.resize.width": {
    hint: "Target width in pixels. Example: 1280",
    min: 1,
  },
  "video.resize.height": {
    hint: "Target height in pixels. Example: 720",
    min: 1,
  },
  "video.thumbnail.timestamp": {
    hint: "Timestamp to capture the frame at, in seconds. Example: 3.5",
    min: 0,
  },
  "audio.trim.start": {
    hint: "Start of the clip to keep, in seconds. Example: 0",
    min: 0,
  },
  "audio.trim.end": {
    hint: "End of the clip to keep, in seconds. Example: 30",
    min: 0,
  },
  "audio.transcode.format": {
    hint: "Output container format (file extension). Example: mp3, wav, aac",
  },
  "audio.transcode.codec": {
    hint: "FFmpeg audio codec name. Example: libmp3lame, aac, pcm_s16le",
  },
  "media.titlecard.text": {
    hint: "Caption text to render on the title card. Example: Chapter One",
  },
  "media.titlecard.duration": {
    hint: "Length of the title card clip, in seconds. Example: 5",
    min: 1,
  },
  "media.titlecard.width": {
    hint: "Width of the output video, in pixels. Example: 1920",
    min: 1,
  },
  "media.titlecard.height": {
    hint: "Height of the output video, in pixels. Example: 1080",
    min: 1,
  },
  "media.titlecard.background": {
    hint: "Background colour as a hex code. Example: #101418",
  },
  "media.titlecard.foreground": {
    hint: "Text colour as a hex code. Example: #ffffff",
  },
  "image.resize.width": {
    hint: "Target width in pixels. Example: 1920",
    min: 1,
  },
  "image.resize.height": {
    hint: "Target height in pixels. Example: 1080",
    min: 1,
  },
  "image.crop.x": {
    hint: "Left offset of the crop rectangle, in pixels. Example: 0",
    min: 0,
  },
  "image.crop.y": {
    hint: "Top offset of the crop rectangle, in pixels. Example: 0",
    min: 0,
  },
  "image.crop.width": {
    hint: "Width of the crop rectangle, in pixels. Example: 800",
    min: 1,
  },
  "image.crop.height": {
    hint: "Height of the crop rectangle, in pixels. Example: 600",
    min: 1,
  },
  "image.colour.adjust.brightness": {
    hint: "Percentage brightness: 100 = unchanged, 0 = black, 200 = double. Example: 120",
    min: 0,
    max: 200,
  },
  "image.colour.adjust.contrast": {
    hint: "Contrast shift: 0 = unchanged, range -100 to 100. Example: 15",
    min: -100,
    max: 100,
  },
  "image.colour.adjust.saturation": {
    hint: "Percentage saturation: 100 = unchanged, 0 = grayscale, 200 = double. Example: 80",
    min: 0,
    max: 200,
  },
  "image.upscale.scale": {
    hint: "Allowed range: 2–4 (default: 4)",
    min: 2,
    max: 4,
  },
  "audio.mix.music_asset_id": {
    hint: "Background music or narration track to mix under the selected asset.",
  },
  "audio.mix.music_volume": {
    hint: "Relative volume of the background track, from 0.0 (silent) to 1.0 (full). Example: 0.3",
    min: 0,
    max: 1,
  },
  "audio.mix.mode": {
    hint:
      "mix: layer the track at music_volume alongside the original audio. " +
      "duck: quieter layer (capped around 0.2) under the original. " +
      "replace: discard the original audio entirely.",
  },
  "audio.normalize.target_i": {
    hint:
      "Target integrated loudness in LUFS (EBU R128). Typical targets: -14 (streaming), " +
      "-16 (podcasts), -23 to -24 (broadcast). Example: -16",
    min: -70,
    max: -5,
  },
  "audio.gain.gain_db": {
    hint: "Volume change in decibels. Positive boosts, negative attenuates. Example: 6 or -3",
    min: -60,
    max: 60,
  },
  "audio.denoise.strength": {
    hint: "How aggressively background noise is removed, from 0.0 (off) to 1.0 (maximum). Example: 0.5",
    min: 0,
    max: 1,
  },
  "video.shot.detect.threshold": {
    hint: "Scene-change sensitivity, from 0 (very sensitive, detects more shots) to 255 (less sensitive, detects fewer shots). Default: 27. Example: 27",
    min: 0,
    max: 255,
  },
};

export function fieldHint(capabilityId: string, fieldName: string): string | undefined {
  return FIELD_META[`${capabilityId}.${fieldName}`]?.hint;
}

export function fieldMin(capabilityId: string, fieldName: string): number | undefined {
  return FIELD_META[`${capabilityId}.${fieldName}`]?.min;
}

export function fieldMax(capabilityId: string, fieldName: string): number | undefined {
  return FIELD_META[`${capabilityId}.${fieldName}`]?.max;
}

export function isAssetReference(name: string, property: JsonSchemaProperty) {
  return name.endsWith("_asset_id") && property.format === "uuid";
}

export function normalizeValue(property: JsonSchemaProperty, raw: string) {
  if (property.type === "integer") {
    return Number.parseInt(raw, 10);
  }
  if (property.type === "number") {
    return Number.parseFloat(raw);
  }
  if (property.type === "boolean") {
    return raw === "true";
  }
  if (property.type === "array") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) =>
        property.items?.type === "number" || property.items?.type === "integer"
          ? Number(item)
          : item,
      );
  }
  return raw;
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
