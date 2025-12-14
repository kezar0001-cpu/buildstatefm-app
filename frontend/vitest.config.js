import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@testing-library/jest-dom',
        replacement: resolve(__dirname, 'src/test-utils/jest-dom-stub.js'),
      },
      {
        find: '@mui/material/useMediaQuery',
        replacement: resolve(__dirname, 'src/test-utils/mui-useMediaQuery-stub.js'),
      },
      // Important: use exact-match aliases; a prefix alias for '@mui/x-date-pickers' can break
      // nested imports like '@mui/x-date-pickers/AdapterDateFns'.
      {
        find: /^@mui\/x-date-pickers$/,
        replacement: resolve(__dirname, 'src/test-utils/mui-x-date-pickers-stub.js'),
      },
      {
        find: /^@mui\/x-date-pickers\/DatePicker$/,
        replacement: resolve(__dirname, 'src/test-utils/mui-x-date-pickers-stub.js'),
      },
      {
        find: /^@mui\/x-date-pickers\/LocalizationProvider$/,
        replacement: resolve(__dirname, 'src/test-utils/mui-x-date-pickers-stub.js'),
      },
      {
        find: /^@mui\/x-date-pickers\/AdapterDateFns$/,
        replacement: resolve(__dirname, 'src/test-utils/mui-x-date-pickers-stub.js'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    deps: {
      inline: ['@mui/x-date-pickers', '@mui/material', '@mui/system', '@mui/utils'],
    },
  },
});
