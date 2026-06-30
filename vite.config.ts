import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    // 5174 so it does not collide with the Portal dev server (5173) when both
    // run on the same host. The IdP `media-editor-web` client is registered for
    // this origin.
    port: 5174,
    host: true,
  },
});
