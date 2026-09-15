import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // /api aur /uploads dono .NET API ko forward hote hain,
      // isliye dev me CORS ka jhanjhat nahi rehta.
      '/api': {
        target: 'http://localhost:5157',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5157',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
