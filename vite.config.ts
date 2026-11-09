import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Project Pages need a repo base path. Override with BASE_PATH=/ for custom domains.
const base = process.env.BASE_PATH ?? "/table-tools/";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base,
});
