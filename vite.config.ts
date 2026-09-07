import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(({command}) => {
  return {
    base: command === 'build' ? '/sih2026/' : '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-404-plugin',
        closeBundle() {
          const indexPath = path.resolve(__dirname, 'dist', 'index.html');
          const notFoundPath = path.resolve(__dirname, 'dist', '404.html');
          if (fs.existsSync(indexPath)) {
            fs.copyFileSync(indexPath, notFoundPath);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
