// frontend/src/App.jsx
import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import GlobalGuard from './components/GlobalGuard.jsx';
import AuthGate from './authGate';
import Layout from './components/Layout';
import SectionCard from './components/SectionCard.jsx';

// Simple fallback
function RouteFallback() {
  return (
    <Box sx={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SectionCard title="Loading" subtitle="Fetching the latest data for you">
        <Typography variant="body2" color="text.secondary">
          This won&apos;t take long. We&apos;re preparing the next view.
        </Typography>
      </SectionCard>
    </Box>
  );
}

function NotFound() {
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

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error('App Error:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <SectionCard title="Something went wrong" subtitle="We ran into an unexpected issue">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Please reload the page to continue. If the issue persists, contact support.
              </Typography>
              <Button variant="contained" color="primary" onClick={() => window.location.reload()} sx={{ textTransform: 'none' }}>
                Reload Page
              </Button>
            </Stack>
          </SectionCard>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ---- Lazy pages (Vite will code-split these) ----
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const SignIn = lazy(() => import('./pages/SignIn.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const AuthCallback = lazy(() => import('./pages/AuthCallback.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.tsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.tsx'));
const Dashboard = lazy(() => import('./pages/DashboardPage.jsx'));
const PropertiesPage = lazy(() => import('./pages/PropertiesPage.jsx')); // wizard inside
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage.jsx'));
const EditPropertyPage = lazy(() => import('./pages/EditPropertyPage.jsx'));
const UnitDetailPage = lazy(() => import('./pages/UnitDetailPage.jsx'));
const InspectionsPage = lazy(() => import('./pages/InspectionsPage.jsx'));
const InspectionDetailPage = lazy(() => import('./pages/InspectionDetailPage.jsx'));
const InspectionReportPage = lazy(() => import('./pages/InspectionReportPage.jsx'));
const JobsPage = lazy(() => import('./pages/JobsPage.jsx'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage.jsx'));
const PlansPage = lazy(() => import('./pages/PlansPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const NewReportsPage = lazy(() => import('./pages/NewReportsPage.jsx'));
const ReportGenerator = lazy(() => import('./pages/ReportGenerator.jsx'));
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
const BlogAdminPage = lazy(() => import('./pages/admin/BlogAdminPage.jsx'));
const BlogPostEditorPage = lazy(() => import('./pages/admin/BlogPostEditorPage.jsx'));
const CategoryEditorPage = lazy(() => import('./pages/admin/CategoryEditorPage.jsx'));
const TagEditorPage = lazy(() => import('./pages/admin/TagEditorPage.jsx'));

// NOTE: AddPropertyPage intentionally removed (wizard is in PropertiesPage)

export default function App() {
  useEffect(() => {
    console.log('App mounted successfully');
    const errorHandler = (event) => console.error('Global error:', event.error);
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
          <Route path="/pricing" element={<PricingPage />} />

          {/* Blog (Public) */}
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          {/* Admin Setup (Public - only works if no admin exists) */}
          <Route path="/admin/setup" element={<AdminSetupPage />} />

          {/* Blog Admin Login (Public) */}
          <Route path="/admin/blog/login" element={<BlogAdminLoginPage />} />

          {/* Blog Admin (Admin only) */}
          <Route path="/admin/blog" element={<AuthGate><Layout><BlogAdminPage /></Layout></AuthGate>} />
          <Route path="/admin/blog/posts/:id" element={<AuthGate><Layout><BlogPostEditorPage /></Layout></AuthGate>} />
          <Route path="/admin/blog/categories/:id" element={<AuthGate><Layout><CategoryEditorPage /></Layout></AuthGate>} />
          <Route path="/admin/blog/tags/:id" element={<AuthGate><Layout><TagEditorPage /></Layout></AuthGate>} />

          {/* Protected */}
          <Route path="/dashboard" element={<AuthGate><Layout><Dashboard /></Layout></AuthGate>} />

          {/* Properties (no /properties/add route) */}
          <Route path="/properties" element={<AuthGate><Layout><PropertiesPage /></Layout></AuthGate>} />
          <Route path="/properties/:id" element={<AuthGate><Layout><PropertyDetailPage /></Layout></AuthGate>} />
          <Route path="/properties/:id/edit" element={<AuthGate><Layout><EditPropertyPage /></Layout></AuthGate>} />
          
          {/* Units */}
          <Route path="/units/:id" element={<AuthGate><Layout><UnitDetailPage /></Layout></AuthGate>} />

          {/* Other feature pages */}
          <Route path="/inspections" element={<AuthGate><Layout><InspectionsPage /></Layout></AuthGate>} />
          <Route path="/inspections/:id" element={<AuthGate><Layout><InspectionDetailPage /></Layout></AuthGate>} />
          <Route path="/inspections/:id/report" element={<AuthGate><Layout><InspectionReportPage /></Layout></AuthGate>} />
          <Route path="/jobs" element={<AuthGate><Layout><JobsPage /></Layout></AuthGate>} />
          <Route path="/jobs/:id" element={<AuthGate><Layout><JobDetailPage /></Layout></AuthGate>} />
          <Route path="/plans" element={<AuthGate><Layout><PlansPage /></Layout></AuthGate>} />
          <Route path="/service-requests" element={<AuthGate><Layout><ServiceRequestsPage /></Layout></AuthGate>} />
          <Route path="/recommendations" element={<AuthGate><Layout><RecommendationsPage /></Layout></AuthGate>} />
          <Route path="/subscriptions" element={<AuthGate><Layout><SubscriptionsPage /></Layout></AuthGate>} />
          <Route path="/reports" element={<AuthGate><Layout><ReportsPage /></Layout></AuthGate>} />
          <Route path="/reports-new" element={<AuthGate><Layout><NewReportsPage /></Layout></AuthGate>} />
          <Route path="/reports/:reportType" element={<AuthGate><Layout><ReportGenerator /></Layout></AuthGate>} />
          <Route path="/profile" element={<AuthGate><Layout><ProfilePage /></Layout></AuthGate>} />

          {/* Role-specific dashboards */}
          <Route path="/technician/dashboard" element={<AuthGate><Layout><TechnicianDashboard /></Layout></AuthGate>} />
          <Route path="/technician/jobs/:id" element={<AuthGate><Layout><TechnicianJobDetail /></Layout></AuthGate>} />
          <Route path="/owner/dashboard" element={<AuthGate><Layout><OwnerDashboard /></Layout></AuthGate>} />
          <Route path="/tenant/dashboard" element={<AuthGate><Layout><TenantDashboard /></Layout></AuthGate>} />
          
          {/* Team Management (Property Manager only) */}
          <Route path="/team" element={<AuthGate><Layout><TeamManagementPage /></Layout></AuthGate>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
