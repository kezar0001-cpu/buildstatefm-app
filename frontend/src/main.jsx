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

// ✅ Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 mins
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.response?.status === 404) {
          return false;
        }
        return failureCount < 2;
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
