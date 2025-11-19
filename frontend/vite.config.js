import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import resolveDevProxyTarget from './config/resolveDevProxyTarget.js';

const devProxyTarget = resolveDevProxyTarget();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Default to the local backend during development so we never send
        // local test traffic to the production API by accident.
        target: devProxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        // Proxy /uploads to backend for document viewing/downloading
        // This ensures iframes and direct file access work in development
        target: devProxyTarget,
        changeOrigin: true,
      }
    }
  },
  build: {
    sourcemap: true, // Enable source maps for debugging production builds
  }
});


