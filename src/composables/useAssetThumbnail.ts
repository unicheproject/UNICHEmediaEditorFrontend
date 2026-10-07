import { ref, watch, type MaybeRefOrGetter, toValue } from "vue";

import { fetchAssetThumbnailObjectUrl } from "@/lib/api";

// The backend renders (and caches on disk) a small JPEG preview for image and
// video assets. Object URLs are cached per asset for the lifetime of the tab so
// switching views/projects doesn't re-download the same preview; they are small
// and intentionally never revoked.
const cache = new Map<string, Promise<string>>();

function loadThumbnail(id: string): Promise<string> {
  let pending = cache.get(id);
  if (!pending) {
    pending = fetchAssetThumbnailObjectUrl(id);
    // Drop failures so a later mount can retry.
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }
  return pending;
}

/**
 * Resolves an object-URL thumbnail for an image or video asset. On failure
 * `thumbnailUrl` stays undefined so callers can fall back to a generic icon.
 */
export function useAssetThumbnail(assetId: MaybeRefOrGetter<string | null | undefined>) {
  const thumbnailUrl = ref<string | undefined>(undefined);
  const loading = ref(false);
  const failed = ref(false);

  watch(
    () => toValue(assetId),
    async (id) => {
      thumbnailUrl.value = undefined;
      failed.value = false;
      loading.value = !!id;
      if (!id) {
        return;
      }
      try {
        const url = await loadThumbnail(id);
        // The asset may have changed again while awaiting — keep only the latest.
        if (toValue(assetId) === id) {
          thumbnailUrl.value = url;
        }
      } catch {
        if (toValue(assetId) === id) {
          failed.value = true;
        }
      } finally {
        if (toValue(assetId) === id) {
          loading.value = false;
        }
      }
    },
    { immediate: true },
  );

  return { thumbnailUrl, loading, failed };
}
