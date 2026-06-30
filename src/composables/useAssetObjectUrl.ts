import { onBeforeUnmount, ref, watch, type MaybeRefOrGetter, toValue } from "vue";

import { fetchAssetObjectUrl } from "@/lib/api";

/**
 * Resolve an authenticated object URL for an asset's bytes (the download route now
 * requires a bearer token, so plain <img src> can't reach it). The URL is fetched
 * with auth, exposed reactively, and revoked when the asset changes or on unmount.
 */
export function useAssetObjectUrl(assetId: MaybeRefOrGetter<string | null | undefined>) {
  const url = ref<string | undefined>(undefined);
  const error = ref<string | null>(null);
  let current: string | undefined;

  function revoke() {
    if (current) {
      URL.revokeObjectURL(current);
      current = undefined;
    }
  }

  watch(
    () => toValue(assetId),
    async (id) => {
      revoke();
      url.value = undefined;
      error.value = null;
      if (!id) {
        return;
      }
      try {
        const objectUrl = await fetchAssetObjectUrl(id);
        // The asset may have changed again while awaiting — keep only the latest.
        if (toValue(assetId) !== id) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        current = objectUrl;
        url.value = objectUrl;
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to load asset";
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(revoke);

  return { url, error };
}
