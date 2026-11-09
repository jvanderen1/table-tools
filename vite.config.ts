import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project Pages need a repo base path. Override with BASE_PATH=/ for custom domains.
const base = process.env.BASE_PATH ?? "/table-tools/";

export default defineConfig({
  plugins: [react()],
  base,
});
