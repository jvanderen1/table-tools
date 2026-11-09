import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Project Pages need a repo base path. Override with BASE_PATH=/ for custom domains.
const base = process.env.BASE_PATH ?? "/table-tools/";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // public/site.webmanifest stays the manifest so the installed app keeps its identity
      manifest: false,
      // src/UpdatePrompt.tsx registers the worker: it applies updates on an
      // untouched launch, otherwise asks first so a reload never lands mid-fight
      registerType: "prompt",
      injectRegister: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,webmanifest}", "**/*latin*.woff2"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Prompt mode waits for SKIP_WAITING. Claiming clients lets the
        // waiting worker take this page so Reload can refresh into it.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".woff2"),
            handler: "CacheFirst",
            options: { cacheName: "fonts" },
          },
        ],
      },
    }),
  ],
  base,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
