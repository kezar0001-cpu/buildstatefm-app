import * as Sentry from "@sentry/react";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";
import "./index.css";
import "./i18n.js";
import { UserProvider } from "./context/UserContext.jsx";
import LightThemeWrapper from "./components/LightThemeWrapper.jsx";
import { isRetryableError } from "./utils/errorMessages.js";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failCount, error) =>
        isRetryableError(error) ? failCount < 3 : false
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
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
