import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), {
    name: 'copy-public-assets',
    closeBundle() {
      const source = path.resolve('assets');
      const target = path.resolve('dist/assets');
      if (existsSync(source)) { mkdirSync(path.dirname(target), { recursive: true }); cpSync(source, target, { recursive: true }); }
    }
  }],
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
  build: { outDir: 'dist', emptyOutDir: true }
});
