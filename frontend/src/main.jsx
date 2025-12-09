import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/react";
import { Replay } from "@sentry/replay";


import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import './index.css';  // Tailwind entry point
import './i18n.js';
import { UserProvider } from './context/UserContext.jsx';
import LightThemeWrapper from './components/LightThemeWrapper.jsx';
import { isRetryableError } from './utils/errorMessages.js';


Sentry.init({
  dsn: "https://46403553ba31e65badcc95a4e142e35c@o4510503287390208.ingest.us.sentry.io/4510503295778816",

  integrations: [
    new BrowserTracing(),
    new Replay()
  ],

  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});


// Phase 7: Query Client with enhanced retry logic using isRetryableError utility
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 mins
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Use centralized retry logic
        if (!isRetryableError(error)) {
          return false;
        }
        // Retry up to 3 times for retryable errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff with jitter for 429 errors
        const baseDelay = 1000 * 2 ** attemptIndex;
        const jitter = Math.random() * 1000;
        return Math.min(baseDelay + jitter, 30000);
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Use centralized retry logic for mutations
        if (!isRetryableError(error)) {
          return false;
        }
        // Retry once for retryable errors (network issues, 5xx, 429)
        return failureCount < 1;
      },
      retryDelay: (attemptIndex, error) => {
        // Special handling for 429 (rate limit) errors
        if (error?.response?.status === 429) {
          const retryAfter = error?.response?.headers?.['retry-after'];
          if (retryAfter) {
            return parseInt(retryAfter, 10) * 1000;
          }
          // Exponential backoff for rate limits
          return Math.min(1000 * 2 ** attemptIndex, 30000);
        }
        return 1000;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <LightThemeWrapper>
          <BrowserRouter>
            <UserProvider>
              <App />
            </UserProvider>
          </BrowserRouter>
        </LightThemeWrapper>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
