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
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: "index.html",
      },
    },
  },
});
