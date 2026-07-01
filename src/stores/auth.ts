import { defineStore } from "pinia";
import { ref } from "vue";

import * as auth from "@/platform/auth";
import type { UserProfile } from "@/platform/auth";

export const useAuthStore = defineStore("auth", () => {
  const authenticated = ref(false);
  const profile = ref<UserProfile | null>(null);
  const ready = ref(false);

  async function bootstrap(): Promise<void> {
    // initAuth can reject (e.g. the silent-SSO iframe is blocked by the IdP's CSP
    // frame-ancestors). Treat any failure as "not authenticated" and still mark
    // ready, so the app shows the sign-in gate instead of looping through login().
    try {
      authenticated.value = await auth.initAuth();
      profile.value = auth.profile();
    } catch {
      authenticated.value = false;
      profile.value = null;
    } finally {
      ready.value = true;
    }
  }

  function login(redirectPath?: string): void {
    auth.login(redirectPath);
  }

  function logout(): void {
    auth.logout();
  }

  return { authenticated, profile, ready, bootstrap, login, logout };
});
