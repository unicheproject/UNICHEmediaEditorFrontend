import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());

// Attempt silent SSO (and strip any leftover OIDC params from the URL) BEFORE mounting,
// so the app boots with a known auth state and a clean address bar (preserving ?project=).
const authStore = useAuthStore();
authStore.bootstrap().finally(() => {
  app.mount("#app");
});
