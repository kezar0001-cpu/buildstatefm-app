import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import resolveDevProxyTarget from "./config/resolveDevProxyTarget.js";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const devProxyTarget = resolveDevProxyTarget();

export default defineConfig({
  plugins: [
    react(),

    // Sentry Vite Plugin for source maps and release tracking
    sentryVitePlugin({
      org: "buildstate-fm",               // Your Sentry Organization Slug
      project: "buildstatefm-frontend",                // <-- Replace with your actual Sentry Project Slug
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
    sourcemap: true
  }
});
