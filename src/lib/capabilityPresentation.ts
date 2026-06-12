import {
  AudioLines,
  Bot,
  Captions,
  Combine,
  Crop,
  Eraser,
  FileAudio,
  FileVideo,
  Gauge,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Mic,
  Music,
  PanelTop,
  ScanFace,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Split,
  Subtitles,
  Tags,
  Type,
  Volume2,
  VolumeX,
  WandSparkles,
  type LucideIcon,
} from "lucide-vue-next";

import type { Capability, CostClass } from "@/types/api";

export type ActionGroup = "Compose" | "Video" | "Image" | "Audio" | "AI" | "Agent" | "Other";

interface Presentation {
  group: ActionGroup;
  icon: LucideIcon;
  order: number;
}

const byId: Record<string, Presentation> = {
  "media.titlecard": { group: "Compose", icon: Type, order: 10 },
  "image.slideshow": { group: "Compose", icon: Layers, order: 20 },
  "video.compose": { group: "Compose", icon: ListVideo, order: 30 },
  "video.subtitle.embed": { group: "Compose", icon: Subtitles, order: 40 },
  "audio.mix": { group: "Compose", icon: Volume2, order: 50 },

  "video.trim": { group: "Video", icon: Scissors, order: 110 },
  "video.split": { group: "Video", icon: Split, order: 120 },
  "video.concat": { group: "Video", icon: Combine, order: 130 },
  "video.transcode": { group: "Video", icon: FileVideo, order: 140 },
  "video.mute": { group: "Video", icon: VolumeX, order: 150 },
  "video.crop": { group: "Video", icon: Crop, order: 160 },
  "video.resize": { group: "Video", icon: PanelTop, order: 170 },
  "video.thumbnail": { group: "Video", icon: ImageIcon, order: 180 },
  "video.shot.detect": { group: "Video", icon: ListVideo, order: 190 },
  "video.upscale": { group: "Video", icon: Sparkles, order: 200 },

  "image.caption": { group: "Image", icon: Captions, order: 310 },
  "image.tag": { group: "Image", icon: Tags, order: 320 },
  "image.resize": { group: "Image", icon: PanelTop, order: 330 },
  "image.crop": { group: "Image", icon: Crop, order: 340 },
  "image.format": { group: "Image", icon: ImageIcon, order: 350 },
  "image.colour.adjust": { group: "Image", icon: SlidersHorizontal, order: 360 },
  "image.background.remove": { group: "Image", icon: Eraser, order: 370 },
  "image.inpaint": { group: "Image", icon: WandSparkles, order: 380 },
  "image.upscale": { group: "Image", icon: Sparkles, order: 390 },
  "image.restore.face": { group: "Image", icon: ScanFace, order: 400 },

  "audio.transcribe": { group: "Audio", icon: Mic, order: 510 },
  "subtitle.autogenerate": { group: "Audio", icon: Subtitles, order: 520 },
  "audio.tts": { group: "Audio", icon: AudioLines, order: 530 },
  "audio.music.generate": { group: "Audio", icon: Music, order: 540 },
  "audio.denoise": { group: "Audio", icon: SlidersHorizontal, order: 550 },
  "audio.separate.stems": { group: "Audio", icon: Split, order: 560 },
  "audio.trim": { group: "Audio", icon: Scissors, order: 570 },
  "audio.concat": { group: "Audio", icon: Combine, order: 580 },
  "audio.gain": { group: "Audio", icon: Gauge, order: 590 },
  "audio.normalize": { group: "Audio", icon: SlidersHorizontal, order: 600 },
  "audio.fade": { group: "Audio", icon: AudioLines, order: 610 },
  "audio.transcode": { group: "Audio", icon: FileAudio, order: 620 },
};

const groupOrder: Record<ActionGroup, number> = {
  Compose: 0,
  Video: 1,
  Image: 2,
  Audio: 3,
  AI: 4,
  Agent: 5,
  Other: 6,
};

function fallbackGroup(capability: Capability): ActionGroup {
  if (capability.cost_class === "hosted_ai" || capability.cost_class === "future_gpu") {
    return "AI";
  }
  const [family] = capability.id.split(".");
  if (family === "video" || family === "image" || family === "audio") {
    return (family.charAt(0).toUpperCase() + family.slice(1)) as ActionGroup;
  }
  return "Other";
}

function fallbackIcon(costClass: CostClass): LucideIcon {
  if (costClass === "deterministic") {
    return SlidersHorizontal;
  }
  return WandSparkles;
}

export function presentationFor(capability: Capability): Presentation {
  return (
    byId[capability.id] ?? {
      group: fallbackGroup(capability),
      icon: fallbackIcon(capability.cost_class),
      order: 900,
    }
  );
}

export function actionGroupOrder(group: ActionGroup) {
  return groupOrder[group];
}

export const agentPresentation: Presentation = {
  group: "Agent",
  icon: Bot,
  order: 1000,
};
