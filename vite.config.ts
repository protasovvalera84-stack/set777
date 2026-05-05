import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + Router
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Matrix SDK (largest dependency)
          "vendor-matrix": ["matrix-js-sdk"],
          // UI libraries
          "vendor-ui": ["react-virtuoso", "sonner", "lucide-react"],
          // Radix UI components
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-slider",
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
