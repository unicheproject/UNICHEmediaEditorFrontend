import { onBeforeUnmount, ref, watch, type MaybeRefOrGetter, toValue } from "vue";

import { fetchAssetObjectUrl } from "@/lib/api";

const THUMBNAIL_MAX_WIDTH = 480;

// There is no backend thumbnail endpoint, so a poster frame is generated
// client-side by seeking an offscreen <video> element and capturing it to a
// canvas. Results are cached per asset for the lifetime of the tab so
// switching views/projects doesn't re-download and re-decode the same video.
const cache = new Map<string, string>();

/**
 * Resolves a data-URL thumbnail for a video asset. Set `thumbnailUrl` on
 * failure (e.g. unsupported codec) stays undefined so callers can fall back
 * to a generic icon.
 */
export function useVideoThumbnail(assetId: MaybeRefOrGetter<string | null | undefined>) {
  const thumbnailUrl = ref<string | undefined>(undefined);
  const loading = ref(false);
  const failed = ref(false);
  let objectUrl: string | undefined;
  let video: HTMLVideoElement | undefined;
  let generation = 0;

  function cleanupVideo() {
    if (video) {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      video = undefined;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    }
  }

  async function generate(id: string) {
    const current = ++generation;
    loading.value = true;
    failed.value = false;
    try {
      objectUrl = await fetchAssetObjectUrl(id);
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        if (!video) {
          reject(new Error("Video element unavailable"));
          return;
        }
        video.onloadedmetadata = () => {
          if (video) {
            video.currentTime = Math.min(1, (video.duration || 0) / 2);
          }
        };
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Unable to load video"));
      });

      if (current !== generation || !video) {
        return;
      }
      const scale = video.videoWidth > THUMBNAIL_MAX_WIDTH ? THUMBNAIL_MAX_WIDTH / video.videoWidth : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round((video.videoWidth || 320) * scale);
      canvas.height = Math.round((video.videoHeight || 180) * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas unsupported");
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

      cache.set(id, dataUrl);
      if (current === generation) {
        thumbnailUrl.value = dataUrl;
      }
    } catch {
      if (current === generation) {
        failed.value = true;
      }
    } finally {
      cleanupVideo();
      if (current === generation) {
        loading.value = false;
      }
    }
  }

  watch(
    () => toValue(assetId),
    (id) => {
      generation++;
      cleanupVideo();
      failed.value = false;
      loading.value = false;
      thumbnailUrl.value = id ? cache.get(id) : undefined;
      if (id && !thumbnailUrl.value) {
        void generate(id);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(cleanupVideo);

  return { thumbnailUrl, loading, failed };
}
