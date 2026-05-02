import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "dist-electron/main",
    },
  },
  preload: {
    build: {
      outDir: "dist-electron/preload",
    },
  },
  renderer: {
    root: ".",
    build: {
      outDir: "dist-electron/renderer",
      rollupOptions: {
        input: "index.html",
      },
    },
  },
});
