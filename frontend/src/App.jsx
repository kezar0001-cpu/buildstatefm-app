// frontend/src/App.jsx
import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Button, Paper, Stack, Typography, Divider, CircularProgress, useTheme, alpha } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import {
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Email as EmailIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import GlobalGuard from './components/GlobalGuard.jsx';
import AuthGate from './authGate';
import ProtectedLayout from './components/ProtectedLayout';
import AdminLayout from './components/AdminLayout';
import SectionCard from './components/SectionCard.jsx';
import logger from './utils/logger';
import * as Sentry from '@sentry/react';

// Modern loading fallback - theme-aware, works in light and dark mode
function RouteFallback() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Stack
        spacing={3}
        alignItems="center"
        sx={{
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        {/* Animated spinner with brand color */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Outer glow ring */}
          <Box
            sx={{
              position: 'absolute',
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: isDark
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.primary.main, 0.08),
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                '50%': { transform: 'scale(1.15)', opacity: 0.7 },
              },
            }}
          />
          <CircularProgress
            size={48}
            thickness={4}
            sx={{
              color: 'primary.main',
            }}
          />
        </Box>

        {/* Text content */}
        <Stack spacing={1} alignItems="center">
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Loading
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              lineHeight: 1.6,
            }}
          >
            Preparing your view...
          </Typography>
        </Stack>

        {/* Subtle animated dots */}
        <Stack direction="row" spacing={0.75}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                animation: 'bounce 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.16}s`,
                '@keyframes bounce': {
                  '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
                  '40%': { transform: 'scale(1)', opacity: 1 },
                },
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

function NotFound() {
  throw new Error("BuildStateFM Sentry Test Error");

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #fff7f7 0%, #ffffff 60%)',
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          maxWidth: 420,
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Page Not Found
          </Typography>
          <Typography variant="h3" fontWeight={800} sx={{ color: 'text.primary' }}>
            404
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => (window.location.href = '/signin')}
            sx={{ textTransform: 'none', px: 3 }}
          >
            Go to Sign In
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

// ========================================================
// ✨ FIXED ERROR BOUNDARY — now sends errors to Sentry
// ========================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log locally
    logger.error('App Error:', {
      error,
      errorInfo,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Send to Sentry (THIS FIXES YOUR ISSUE)
    Sentry.captureException(error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleContactSupport = () => {
    const subject = encodeURIComponent(`Error Report - ${this.state.errorId || 'Unknown'}`);
    const body = encodeURIComponent(
      `I encountered an error while using Buildstate FM.\n\n` +
        `Error ID: ${this.state.errorId || 'Unknown'}\n` +
        `Time: ${new Date().toLocaleString()}\n` +
        `Page: ${window.location.href}\n\n` +
        `Please describe what you were doing when the error occurred:\n\n`
    );
    window.location.href = `mailto:admin@buildstate.com.au?subject=${subject}&body=${body}`;
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 60%)',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              maxWidth: 560,
              width: '100%',
            }}
          >
            <Stack spacing={3} alignItems="center">
              {/* Error Icon */}
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'error.light',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                }}
              >
                <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />
              </Box>

              {/* Title */}
              <Box>
                <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: 'text.primary' }}>
                  Something went wrong
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  We encountered an unexpected error. Our team has been notified.
                </Typography>

                {this.state.errorId && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'inline-block',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor: 'grey.100',
                      color: 'text.secondary',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                    }}
                  >
                    Error ID: {this.state.errorId}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ width: '100%' }} />

              {/* Buttons */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ width: '100%' }}
                alignItems="stretch"
              >
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  Reload Page
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  Go to Home
                </Button>
              </Stack>

              {/* Support */}
              <Box sx={{ width: '100%', pt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  If the problem persists, please contact our support team:
                </Typography>
                <Button
                  variant="text"
                  color="primary"
                  size="medium"
                  startIcon={<EmailIcon />}
                  onClick={this.handleContactSupport}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                >
                  admin@buildstate.com.au
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded pages
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const SignIn = lazy(() => import('./pages/SignIn.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const AuthCallback = lazy(() => import('./pages/AuthCallback.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.tsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.tsx'));
const Dashboard = lazy(() => import('./pages/DashboardPage.jsx'));
const PropertiesPage = lazy(() => import('./pages/PropertiesPage.jsx'));
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage.jsx'));
const EditPropertyPage = lazy(() => import('./pages/EditPropertyPage.jsx'));
const UnitDetailPage = lazy(() => import('./pages/UnitDetailPage.jsx'));
const InspectionsPage = lazy(() => import('./pages/InspectionsPage.jsx'));
const InspectionDetailPage = lazy(() => import('./pages/InspectionDetailPage.jsx'));
const InspectionConductPage = lazy(() => import('./pages/InspectionConductPage.jsx'));
const InspectionSignaturePage = lazy(() => import('./pages/InspectionSignaturePage.jsx'));
const InspectionReportPage = lazy(() => import('./pages/InspectionReportPage.jsx'));
const JobsPage = lazy(() => import('./pages/JobsPage.jsx'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage.jsx'));
const PlansPage = lazy(() => import('./pages/PlansPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const NewReportsPage = lazy(() => import('./pages/NewReportsPage.jsx'));
const ReportGenerator = lazy(() => import('./pages/ReportGenerator.jsx'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage.jsx'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage.jsx'));
const ServiceRequestsPage = lazy(() => import('./pages/ServiceRequestsPage.jsx'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage.jsx'));
const TechnicianDashboard = lazy(() => import('./pages/TechnicianDashboard.jsx'));
const TechnicianJobDetail = lazy(() => import('./pages/TechnicianJobDetail.jsx'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard.jsx'));
const TenantDashboard = lazy(() => import('./pages/TenantDashboard.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const TeamManagementPage = lazy(() => import('./pages/TeamManagementPage.jsx'));
const BlogPage = lazy(() => import('./pages/BlogPage.jsx'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage.jsx'));
const AdminSetupPage = lazy(() => import('./pages/AdminSetupPage.jsx'));
const BlogAdminLoginPage = lazy(() => import('./pages/admin/BlogAdminLoginPage.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage.jsx'));
const BlogAdminPage = lazy(() => import('./pages/admin/BlogAdminPage.jsx'));
const BlogPostEditorPage = lazy(() => import('./pages/admin/BlogPostEditorPage.jsx'));
const CategoryEditorPage = lazy(() => import('./pages/admin/CategoryEditorPage.jsx'));
const TagEditorPage = lazy(() => import('./pages/admin/TagEditorPage.jsx'));

export default function App() {
  useEffect(() => {
    logger.log('App mounted successfully');

    const errorHandler = (event) => logger.error('Global error:', event.error);
    window.addEventListener('error', errorHandler);

    return () => window.removeEventListener('error', errorHandler);
  }, []);

  return (
    <ErrorBoundary>
      <CssBaseline />
      <GlobalGuard />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          success: {
            duration: 3000,
            style: {
              background: '#4caf50',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#4caf50',
            },
          },
          error: {
            duration: 6000,
            style: {
              background: '#f44336',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#f44336',
            },
          },
          loading: {
            style: {
              background: '#2196f3',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#2196f3',
            },
          },
        }}
      />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Blog (Public) */}
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          {/* Admin Setup (Public) */}
          <Route path="/admin/setup" element={<AdminSetupPage />} />

          {/* Blog Admin Login */}
          <Route path="/admin/blog/login" element={<BlogAdminLoginPage />} />

          {/* Admin Panel - Dedicated admin routes with AdminLayout */}
          <Route path="/admin/dashboard" element={<AuthGate><AdminLayout><AdminDashboard /></AdminLayout></AuthGate>} />
          <Route path="/admin/users" element={<AuthGate><AdminLayout><AdminUsersPage /></AdminLayout></AuthGate>} />
          <Route path="/admin/analytics" element={<AuthGate><AdminLayout><AdminAnalyticsPage /></AdminLayout></AuthGate>} />
          <Route path="/admin/blog" element={<AuthGate><AdminLayout><BlogAdminPage /></AdminLayout></AuthGate>} />
          <Route path="/admin/blog/posts/:id" element={<AuthGate><AdminLayout><BlogPostEditorPage /></AdminLayout></AuthGate>} />
          <Route path="/admin/blog/categories/:id" element={<AuthGate><AdminLayout><CategoryEditorPage /></AdminLayout></AuthGate>} />
          <Route path="/admin/blog/tags/:id" element={<AuthGate><AdminLayout><TagEditorPage /></AdminLayout></AuthGate>} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<AuthGate><ProtectedLayout><Dashboard /></ProtectedLayout></AuthGate>} />

          <Route path="/properties" element={<AuthGate><ProtectedLayout><PropertiesPage /></ProtectedLayout></AuthGate>} />
          <Route path="/properties/:id" element={<AuthGate><ProtectedLayout><PropertyDetailPage /></ProtectedLayout></AuthGate>} />
          <Route path="/properties/:id/edit" element={<AuthGate><ProtectedLayout><EditPropertyPage /></ProtectedLayout></AuthGate>} />

          <Route path="/units/:id" element={<AuthGate><ProtectedLayout><UnitDetailPage /></ProtectedLayout></AuthGate>} />

          <Route path="/inspections" element={<AuthGate><ProtectedLayout><InspectionsPage /></ProtectedLayout></AuthGate>} />
          <Route path="/inspections/:id" element={<AuthGate><ProtectedLayout><InspectionDetailPage /></ProtectedLayout></AuthGate>} />
          <Route path="/inspections/:id/conduct" element={<AuthGate><ProtectedLayout><InspectionConductPage /></ProtectedLayout></AuthGate>} />
          <Route path="/inspections/:id/sign" element={<AuthGate><ProtectedLayout><InspectionSignaturePage /></ProtectedLayout></AuthGate>} />
          <Route path="/inspections/:id/report" element={<AuthGate><ProtectedLayout><InspectionReportPage /></ProtectedLayout></AuthGate>} />

          <Route path="/jobs" element={<AuthGate><ProtectedLayout><JobsPage /></ProtectedLayout></AuthGate>} />
          <Route path="/jobs/:id" element={<AuthGate><ProtectedLayout><JobDetailPage /></ProtectedLayout></AuthGate>} />

          <Route path="/plans" element={<AuthGate><ProtectedLayout><PlansPage /></ProtectedLayout></AuthGate>} />

          <Route path="/service-requests" element={<AuthGate><ProtectedLayout><ServiceRequestsPage /></ProtectedLayout></AuthGate>} />
          <Route path="/recommendations" element={<AuthGate><ProtectedLayout><RecommendationsPage /></ProtectedLayout></AuthGate>} />
          <Route path="/subscriptions" element={<AuthGate><ProtectedLayout><SubscriptionsPage /></ProtectedLayout></AuthGate>} />

          <Route path="/reports" element={<AuthGate><ProtectedLayout><ReportsPage /></ProtectedLayout></AuthGate>} />
          <Route path="/reports/:id" element={<AuthGate><ProtectedLayout><ReportDetailPage /></ProtectedLayout></AuthGate>} />
          <Route path="/reports-new" element={<AuthGate><ProtectedLayout><NewReportsPage /></ProtectedLayout></AuthGate>} />
          <Route path="/reports/generate/:reportType" element={<AuthGate><ProtectedLayout><ReportGenerator /></ProtectedLayout></AuthGate>} />

          <Route path="/profile" element={<AuthGate><ProtectedLayout><ProfilePage /></ProtectedLayout></AuthGate>} />

          <Route path="/technician/dashboard" element={<AuthGate><ProtectedLayout><TechnicianDashboard /></ProtectedLayout></AuthGate>} />
          <Route path="/technician/jobs/:id" element={<AuthGate><ProtectedLayout><TechnicianJobDetail /></ProtectedLayout></AuthGate>} />

          <Route path="/owner/dashboard" element={<AuthGate><ProtectedLayout><OwnerDashboard /></ProtectedLayout></AuthGate>} />
          <Route path="/tenant/dashboard" element={<AuthGate><ProtectedLayout><TenantDashboard /></ProtectedLayout></AuthGate>} />

          <Route path="/team" element={<AuthGate><ProtectedLayout><TeamManagementPage /></ProtectedLayout></AuthGate>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
