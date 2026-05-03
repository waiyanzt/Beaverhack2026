import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
    },
  },
  renderer: {
    root: ".",
    plugins: [tailwindcss(), react()],
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: {
          main: "index.html",
          hiddenCapture: "hidden-capture.html",
        },
      },
    },
  },
});
