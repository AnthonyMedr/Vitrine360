import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const chunkGroups: Record<string, string[]> = {
  react: ["react", "react-dom", "react-router-dom"],
  motion: ["framer-motion"],
  query: ["@tanstack/react-query"],
  "radix-overlay": [
    "@radix-ui/react-alert-dialog",
    "@radix-ui/react-context-menu",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-hover-card",
    "@radix-ui/react-popover",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-toast",
    "@radix-ui/react-tooltip",
  ],
  "radix-checkbox": ["@radix-ui/react-checkbox"],
  "radix-radio": ["@radix-ui/react-radio-group"],
  "radix-switch": ["@radix-ui/react-switch"],
  "radix-label": ["@radix-ui/react-label"],
  "radix-slider": ["@radix-ui/react-slider"],
  "radix-select": ["@radix-ui/react-select"],
  "radix-layout": [
    "@radix-ui/react-accordion",
    "@radix-ui/react-avatar",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-progress",
    "@radix-ui/react-separator",
    "@radix-ui/react-slot",
    "@radix-ui/react-tabs",
    "@radix-ui/react-toggle",
    "@radix-ui/react-toggle-group",
    "@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu",
    "@radix-ui/react-aspect-ratio",
  ],
  charts: ["recharts"],
};

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: Number(process.env.VITE_DEV_PORT || 8082),
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_API_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: process.env.VITE_PROXY_API_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "framer-motion": path.resolve(__dirname, "./src/lib/motion.tsx"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          for (const [chunkName, packages] of Object.entries(chunkGroups)) {
            if (packages.some((packageName) => id.includes(`/node_modules/${packageName}/`) || id.includes(`\\node_modules\\${packageName}\\`))) {
              return chunkName;
            }
          }
          return undefined;
        },
      },
    },
  },
}));
