import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Set base to './' for relative paths — works on GitHub Pages
  // If deploying to a subdirectory, change to '/repo-name/'
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        dashboard: resolve(rootDir, 'src/html/dashboard.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['myAgent/**', 'node_modules/**'],
  },
});
