import { defineConfig } from "vite";
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
      // No forced reload: a new version takes over on the next launch, never mid-fight
      registerType: "autoUpdate",
      injectRegister: "script",
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,jpg,webmanifest}",
          "**/*latin*.woff2",
        ],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
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
});
