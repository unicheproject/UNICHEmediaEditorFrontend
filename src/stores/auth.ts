import { defineStore } from "pinia";
import { ref } from "vue";

import * as auth from "@/platform/auth";
import type { UserProfile } from "@/platform/auth";

export const useAuthStore = defineStore("auth", () => {
  const authenticated = ref(false);
  const profile = ref<UserProfile | null>(null);
  const ready = ref(false);

  async function bootstrap(): Promise<void> {
    authenticated.value = await auth.initAuth();
    profile.value = auth.profile();
    ready.value = true;
  }

  function login(redirectPath?: string): void {
    auth.login(redirectPath);
  }

  function logout(): void {
    auth.logout();
  }

  return { authenticated, profile, ready, bootstrap, login, logout };
});
