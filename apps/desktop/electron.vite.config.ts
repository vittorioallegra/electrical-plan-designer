import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const web = fileURLToPath(new URL('../web', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// Main and preload are fully bundled (every dependency is a devDependency), so the packaged app
// carries no node_modules. The renderer is the web app's source, built here without the PWA.
export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: 'src/main/index.ts' } } },
  },
  preload: {
    build: { rollupOptions: { input: { index: 'src/preload/index.ts' } } },
  },
  renderer: {
    root: web,
    envDir: repoRoot,
    plugins: [
      react(),
      tailwindcss(),
      {
        // electron-vite forces base './' in production, which breaks deep routes such as
        // /project/plan (assets resolve under /project/). A late plugin restores '/'.
        name: 'epd:absolute-base',
        enforce: 'post',
        config: () => ({ base: '/' }),
      },
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('../web/src', import.meta.url)) } },
    server: { port: 5173, strictPort: true },
    build: {
      outDir: fileURLToPath(new URL('./out/renderer', import.meta.url)),
      emptyOutDir: true,
      rollupOptions: { input: { index: `${web}/index.html` } },
    },
  },
});
