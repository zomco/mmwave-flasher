import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      'node:crypto': resolve('test/browser/sha256-shim.js'),
    },
  },
  server: { fs: { allow: [resolve('..')] } },
  build: {
    outDir: process.env.MWCP_CONSOLE_OUT || 'dist-console-browser',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve('console-browser.html'),
    },
  },
});
