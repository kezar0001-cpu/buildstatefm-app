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

// ✅ Query Client with enhanced retry logic and mutation defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 mins
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (except 408, 429)
        const status = error?.response?.status;
        if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
          return false;
        }
        // Retry up to 3 times for network errors and 5xx errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on 4xx errors
        const status = error?.response?.status;
        if (status >= 400 && status < 500) {
          return false;
        }
        // Retry once for network errors
        return failureCount < 1;
      },
      retryDelay: 1000,
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
