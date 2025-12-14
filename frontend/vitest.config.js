import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@testing-library/jest-dom': resolve(__dirname, 'src/test-utils/jest-dom-stub.js'),
      '@mui/material/useMediaQuery': resolve(
        __dirname,
        'src/test-utils/mui-useMediaQuery-stub.js'
      ),
      '@mui/x-date-pickers': resolve(
        __dirname,
        'src/test-utils/mui-x-date-pickers-stub.js'
      ),
      '@mui/x-date-pickers/DatePicker': resolve(
        __dirname,
        'src/test-utils/mui-x-date-pickers-stub.js'
      ),
      '@mui/x-date-pickers/LocalizationProvider': resolve(
        __dirname,
        'src/test-utils/mui-x-date-pickers-stub.js'
      ),
      '@mui/x-date-pickers/AdapterDateFns': resolve(
        __dirname,
        'src/test-utils/mui-x-date-pickers-stub.js'
      ),
    },
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
