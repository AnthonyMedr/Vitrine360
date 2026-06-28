import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("react-dom") || id.includes("\\react\\") || id.includes("/react/")) return;
  if (id.includes("@tanstack")) return "tanstack-vendor";
  if (id.includes("\\pg\\") || id.includes("/pg/")) return "postgres-vendor";
  if (id.includes("recharts")) return "charts-vendor";
  if (id.includes("qrcode")) return "qrcode-vendor";
  if (id.includes("lucide-react")) return "icons-vendor";
  if (id.includes("@radix-ui")) return "radix-vendor";
  return undefined;
}

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    ...tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  preview: {
    allowedHosts: ["vitrine360.gamelmetal.com"],
  },
});
