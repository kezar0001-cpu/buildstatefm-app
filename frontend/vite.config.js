import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import resolveDevProxyTarget from "./config/resolveDevProxyTarget.js";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const devProxyTarget = resolveDevProxyTarget();

export default defineConfig({
  plugins: [
    react(),

    // Sentry Vite plugin for source maps and performance tracing
    sentryVitePlugin({
      org: "buildstate-fm",
      project: "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN
    })
  ],

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: devProxyTarget,
        changeOrigin: true
      },
      "/uploads": {
        target: devProxyTarget,
        changeOrigin: true
      }
    }
  },

  build: {
    sourcemap: true // Required for Sentry readable stack traces
  }
});
