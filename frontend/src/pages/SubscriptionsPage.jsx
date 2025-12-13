import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Typography, Paper, Stack, Button, Card, CardContent, Divider, Chip,
  List, ListItem, ListItemIcon, ListItemText, Container, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  CircularProgress, Link, LinearProgress, TextField, InputAdornment,
  Tooltip, IconButton, Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import ApartmentIcon from '@mui/icons-material/Apartment';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import UpdateIcon from '@mui/icons-material/Update';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CancelIcon from '@mui/icons-material/Cancel';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import { useQuery } from '@tanstack/react-query';
import useApiMutation from '../hooks/useApiMutation.js';
import { apiClient } from '../api/client.js';
import DataState from '../components/DataState.jsx';
import { normaliseArray } from '../utils/error.js';
import { calculateDaysRemaining, formatDate } from '../utils/date.js';
import { useCurrentUser } from '../context/UserContext.jsx';
import { redirectToBillingPortal } from '../utils/billing.js';
import { queryKeys } from '../utils/queryKeys.js';
import logger from '../utils/logger';

const normaliseStatus = (status) =>
  typeof status === 'string' ? status.toUpperCase() : '';

const PLAN_DETAILS = {
  BASIC: {
    name: 'Basic Plan',
    price: 29,
    currency: 'USD',
    interval: 'month',
    billingIntervalLabel: 'Monthly',
    billingIntervalSuffix: '/month',
    description: 'Perfect for individual property managers getting started.',
    popular: false,
    features: [
      'Up to 10 properties',
      '30 team members',
      '25 inspections per month',
      '5 recurring inspections',
      '3 custom templates',
      '30 days analytics history',
      '10 report exports per month',
      '3 automation rules',
      '100 automation runs per month',
      '5 maintenance plans',
      '50 jobs per month',
      '5GB storage',
      '50 document uploads per month',
      '100 API calls per day',
      '2 active webhooks',
      '1 integration',
      'Email support',
      'Mobile access',
    ],
    limits: {
      properties: 10,
      teamMembers: 30,
      inspectionsPerMonth: 25,
      recurringInspections: 5,
      customTemplates: 3,
      analyticsHistoryDays: 30,
      reportExportsPerMonth: 10,
      automationRules: 3,
      automationRunsPerMonth: 100,
      maintenancePlans: 5,
      jobsPerMonth: 50,
      storageGB: 5,
      documentUploadsPerMonth: 50,
      apiCallsPerDay: 100,
      webhooks: 2,
      integrations: 1,
    },
  },
  PROFESSIONAL: {
    name: 'Professional Plan',
    price: 79,
    currency: 'USD',
    interval: 'month',
    billingIntervalLabel: 'Monthly',
    billingIntervalSuffix: '/month',
    description: 'For growing teams managing multiple properties.',
    popular: true,
    features: [
      'Up to 50 properties',
      '100 team members',
      '100 inspections per month',
      '25 recurring inspections',
      '15 custom templates',
      '180 days analytics history',
      '50 report exports per month',
      '15 automation rules',
      '1,000 automation runs per month',
      '25 maintenance plans',
      '250 jobs per month',
      '50GB storage',
      '250 document uploads per month',
      '1,000 API calls per day',
      '10 active webhooks',
      '5 integrations',
      'Priority email & chat support',
      'Mobile access',
    ],
    limits: {
      properties: 50,
      teamMembers: 100,
      inspectionsPerMonth: 100,
      recurringInspections: 25,
      customTemplates: 15,
      analyticsHistoryDays: 180,
      reportExportsPerMonth: 50,
      automationRules: 15,
      automationRunsPerMonth: 1000,
      maintenancePlans: 25,
      jobsPerMonth: 250,
      storageGB: 50,
      documentUploadsPerMonth: 250,
      apiCallsPerDay: 1000,
      webhooks: 10,
      integrations: 5,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise Plan',
    price: 149,
    currency: 'USD',
    interval: 'month',
    billingIntervalLabel: 'Monthly',
    billingIntervalSuffix: '/month',
    description: 'For large organizations with complex needs.',
    popular: false,
    features: [
      'Unlimited properties',
      'Unlimited team members',
      'Unlimited inspections',
      'Unlimited recurring inspections',
      'Unlimited custom templates',
      'Unlimited analytics history',
      'Unlimited report exports',
      'Unlimited automation rules',
      'Unlimited automation runs',
      'Unlimited maintenance plans',
      'Unlimited jobs',
      'Unlimited storage',
      'Unlimited document uploads',
      'Unlimited API calls',
      'Unlimited webhooks',
      'Unlimited integrations',
      'Dedicated support (4-hour response)',
      'Mobile access',
      'Custom integrations',
      'Dedicated account manager',
    ],
    limits: {
      properties: Infinity,
      teamMembers: Infinity,
      inspectionsPerMonth: Infinity,
      recurringInspections: Infinity,
      customTemplates: Infinity,
      analyticsHistoryDays: Infinity,
      reportExportsPerMonth: Infinity,
      automationRules: Infinity,
      automationRunsPerMonth: Infinity,
      maintenancePlans: Infinity,
      jobsPerMonth: Infinity,
      storageGB: Infinity,
      documentUploadsPerMonth: Infinity,
      apiCallsPerDay: Infinity,
      webhooks: Infinity,
      integrations: Infinity,
    },
  },
};

const formatCurrency = (amount, currency = 'USD') => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null;
  const hasDecimals = Math.abs(amount) % 1 > 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(hasDecimals ? 2 : 0)}`;
  }
};

const formatDateDisplay = (value) => {
  if (!value) return 'Not available';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const firstValidDate = (...values) => {
  for (const value of values) {
    const parsed = parseDateValue(value);
    if (parsed) return parsed;
  }
  return null;
};

const calculateNextBillingDate = (subscription, plan) => {
  if (!subscription?.createdAt || !plan?.interval) return null;
  const start = new Date(subscription.createdAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const next = new Date(start);

  const addInterval = () => {
    switch (plan.interval) {
      case 'year':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'week':
        next.setDate(next.getDate() + 7);
        break;
      case 'month':
      default:
        next.setMonth(next.getMonth() + 1);
        break;
    }
  };

  while (next <= now) {
    addInterval();
    if (Number.isNaN(next.getTime())) return null;
  }

  return next;
};

function DetailRow({ icon, label, value }) {
  const resolvedValue = React.isValidElement(value) ? value : value ?? 'Not available';

  return (
    <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} alignItems="flex-start" sx={{ width: '100%' }}>
      {icon ? (
        <Box sx={{ color: 'primary.main', mt: 0.5, display: 'inline-flex', flexShrink: 0 }}>
          {icon}
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 0.6, display: 'block', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
        >
          {label}
        </Typography>
        {React.isValidElement(resolvedValue) ? (
          resolvedValue
        ) : (
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' }, wordBreak: 'break-word' }}>
            {resolvedValue}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function UsageProgressBar({ label, current, limit, unit = '' }) {
  const isUnlimited = limit === Infinity || limit === 'unlimited' || limit === 'Unlimited';
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const isApproaching = percentage >= 80 && percentage < 100;
  const isExceeded = percentage >= 100;

  const displayLimit = isUnlimited ? 'Unlimited' : limit;
  const displayCurrent = isUnlimited ? current : `${current} / ${displayLimit}${unit ? ` ${unit}` : ''}`;

  return (
    <Box sx={{ mb: 2, width: '100%', overflow: 'hidden' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5, gap: 1, width: '100%' }}>
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: isExceeded ? 'error.main' : isApproaching ? 'warning.main' : 'text.secondary',
            flexShrink: 0,
            ml: 1,
          }}
        >
          {displayCurrent}
        </Typography>
      </Stack>
      {!isUnlimited && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, percentage)}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'grey.200',
            width: '100%',
            '& .MuiLinearProgress-bar': {
              bgcolor: isExceeded ? 'error.main' : isApproaching ? 'warning.main' : 'primary.main',
            },
          }}
        />
      )}
    </Box>
  );
}

// Mobile-specific square card with expandable drawer
function MobilePlanCard({ plan, planKey, isCurrentPlan, onSelect, isLoading, trialDaysRemaining, isTrialActive, isUpgrade = false, isDowngrade = false }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        border: isCurrentPlan ? '2px solid' : plan.popular ? '2px solid' : '1px solid',
        borderColor: isCurrentPlan
          ? 'primary.main'
          : plan.popular
            ? 'primary.main'
            : 'divider',
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
        mx: 'auto',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Badges */}
        {plan.popular && !isCurrentPlan && (
          <Chip
            label="MOST POPULAR"
            color="primary"
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 2 }}
          />
        )}
        {isCurrentPlan && (
          <Chip
            label="CURRENT PLAN"
            color="success"
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 2 }}
          />
        )}

        {/* Plan Name */}
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {plan.name}
        </Typography>

        {/* Price */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            {formatCurrency(plan.price)}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            /month
          </Typography>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {plan.description}
        </Typography>

        {/* Expandable Features Section */}
        <Box>
          <Button
            fullWidth
            variant="text"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ mb: 1, justifyContent: 'space-between' }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {expanded ? 'Hide Features' : 'View All Features'}
            </Typography>
          </Button>

          <Collapse in={expanded}>
            <Divider sx={{ mb: 2 }} />
            <List sx={{ py: 0 }}>
              {plan.features.map((feature) => (
                <ListItem key={feature} sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={feature}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        {/* CTA Button */}
        <Button
          variant={isCurrentPlan ? 'outlined' : plan.popular ? 'contained' : 'outlined'}
          size="large"
          fullWidth
          onClick={() => onSelect(planKey)}
          disabled={isLoading || isCurrentPlan}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            mt: 2,
          }}
        >
          {isLoading
            ? 'Processing...'
            : isCurrentPlan
              ? 'Current Plan'
              : isTrialActive && !isCurrentPlan
                ? 'Subscribe Now'
                : isUpgrade
                  ? 'Upgrade to This Plan'
                  : isDowngrade
                    ? 'Downgrade to This Plan'
                    : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan, planKey, isCurrentPlan, onSelect, isLoading, trialDaysRemaining, isTrialActive, isUpgrade = false, isDowngrade = false }) {

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: isCurrentPlan ? '2px solid' : plan.popular ? '2px solid' : '1px solid',
        borderColor: isCurrentPlan
          ? 'primary.main'
          : plan.popular
            ? 'primary.main'
            : 'divider',
        position: 'relative',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
        },
      }}
    >
      <CardContent sx={{ p: 4, pt: 4, flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Badges positioned inside CardContent to avoid cutoff */}
        {plan.popular && !isCurrentPlan && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1,
            }}
          >
            <Chip
              label="MOST POPULAR"
              color="primary"
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
          </Box>
        )}
        {isCurrentPlan && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 1,
            }}
          >
            <Chip
              label="CURRENT PLAN"
              color="success"
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
          </Box>
        )}
        <Stack spacing={3} sx={{ flexGrow: 1, mt: (plan.popular || isCurrentPlan) ? 4 : 0 }}>
          {/* Plan Header */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {plan.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {plan.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {formatCurrency(plan.price)}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                /month
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Features List */}
          <List sx={{ py: 0, flexGrow: 1 }}>
            {plan.features.map((feature) => (
              <ListItem key={feature} sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={feature}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>

          {/* CTA Button */}
          <Button
            variant={isCurrentPlan ? 'outlined' : plan.popular ? 'contained' : 'outlined'}
            size="large"
            fullWidth
            onClick={() => onSelect(planKey)}
            disabled={isLoading || isCurrentPlan}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              mt: 'auto',
            }}
          >
            {isLoading
              ? 'Processing...'
              : isCurrentPlan
                ? 'Current Plan'
                : isTrialActive && !isCurrentPlan
                  ? 'Subscribe Now'
                  : isUpgrade
                    ? 'Upgrade to This Plan'
                    : isDowngrade
                      ? 'Downgrade to This Plan'
                      : 'Select Plan'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser, refreshUser } = useCurrentUser();

  // Redirect non-property-managers (backend will also reject, but better UX to redirect early)
  React.useEffect(() => {
    if (currentUser && currentUser.role !== 'PROPERTY_MANAGER') {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  // Determine if user has active subscription first
  const subscriptionStatus = currentUser?.subscriptionStatus;
  const hasActiveSubscription = subscriptionStatus === 'ACTIVE';
  const isTrialActive = subscriptionStatus === 'TRIAL';
  const trialDaysRemaining = calculateDaysRemaining(currentUser?.trialEndDate);

  // Don't render if user is not a property manager
  if (!currentUser || currentUser.role !== 'PROPERTY_MANAGER') {
    return null;
  }

  // Fetch subscriptions
  // Migrated to React Query for better caching and state management
  const query = useQuery({
    queryKey: queryKeys.subscriptions.all(),
    queryFn: async () => {
      const response = await apiClient.get('/subscriptions');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch usage stats - Migrated to React Query
  const usageQuery = useQuery({
    queryKey: ['subscriptions', 'usage'],
    queryFn: async () => {
      const response = await apiClient.get('/subscriptions/usage');
      return response.data;
    },
    enabled: Boolean(currentUser),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Checkout mutation
  const checkoutMutation = useApiMutation({
    url: '/billing/checkout',
    method: 'post',
  });

  // Change plan mutation (for existing subscriptions)
  const changePlanMutation = useApiMutation({
    url: '/billing/change-plan',
    method: 'post',
    onSuccess: () => {
      query.refetch();
      refreshUser();
    },
  });

  // Promo code validation
  const validatePromoMutation = useApiMutation({
    url: '/promo-codes/validate',
    method: 'post',
  });

  // Invoices query
  // Fetch invoices - Migrated to React Query
  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      const response = await apiClient.get('/billing/invoices');
      return response.data;
    },
    enabled: hasActiveSubscription,
    staleTime: 5 * 60 * 1000, // 5 minutes (invoices change less frequently)
  });

  // Cancel subscription mutation
  const cancelMutation = useApiMutation({
    url: '/billing/cancel',
    method: 'post',
    onSuccess: () => {
      query.refetch();
      refreshUser();
    },
  });

  // Update payment method mutation
  const updatePaymentMutation = useApiMutation({
    url: '/billing/payment-method',
    method: 'post',
  });

  // Confirm subscription mutation
  const confirmMutation = useApiMutation({
    url: '/billing/confirm',
    method: 'post',
  });

  // State
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [validatedPromo, setValidatedPromo] = useState(null);
  const [showUsageDetails, setShowUsageDetails] = useState(false);

  const params = new URLSearchParams(location.search);
  const showSuccess = params.get('success') === '1';
  const showCanceled = params.get('canceled') === '1';
  const planFromUrl = params.get('plan');

  // Effect to refresh user data on successful subscription
  useEffect(() => {
    if (!showSuccess) return;
    let isMounted = true;
    let refreshInterval;
    
    (async () => {
      try {
        // Get session ID from URL if available (Stripe replaces {CHECKOUT_SESSION_ID} in the URL)
        const sessionId = params.get('session_id') || 
                         new URLSearchParams(window.location.search).get('session_id') ||
                         window.location.pathname.split('/').pop(); // Sometimes Stripe puts it in the path
        
        console.log('Subscription success - sessionId:', sessionId);
        
        // If we have a session ID, confirm the subscription first
        if (sessionId && sessionId !== 'subscriptions') {
          try {
            console.log('Calling confirm endpoint with sessionId:', sessionId);
            const confirmResult = await confirmMutation.mutateAsync({
              data: { sessionId },
            });
            console.log('Confirm result:', confirmResult);
          } catch (err) {
            logger.error('Failed to confirm subscription:', err);
            // Continue anyway - webhook should handle it
          }
        } else {
          console.log('No session ID found in URL, relying on webhook');
        }
        
        // Refresh user data immediately
        console.log('Refreshing user data...');
        await refreshUser();
        query.refetch();
        
        // Set up polling to check subscription status
        let attempts = 0;
        const maxAttempts = 10; // Check for up to 20 seconds
        
        refreshInterval = setInterval(async () => {
          if (!isMounted || attempts >= maxAttempts) {
            if (refreshInterval) clearInterval(refreshInterval);
            return;
          }
          
          attempts++;
          console.log(`Refreshing user data (attempt ${attempts}/${maxAttempts})...`);
          
          try {
            const updatedUser = await refreshUser();
            query.refetch();
            
            // If subscription is now active, stop polling
            if (updatedUser?.subscriptionStatus === 'ACTIVE') {
              console.log('Subscription is now ACTIVE, stopping refresh polling');
              if (refreshInterval) clearInterval(refreshInterval);
            }
          } catch (err) {
            logger.error('Error refreshing user data:', err);
          }
        }, 2000); // Check every 2 seconds
        
        // Also do a final check after 15 seconds
        setTimeout(async () => {
          if (isMounted && refreshInterval) {
            clearInterval(refreshInterval);
            await refreshUser();
            query.refetch();
          }
        }, 15000);
        
      } catch (err) {
        logger.error('Error in subscription success handler:', err);
      } finally {
        // Don't navigate immediately - let the polling complete
        setTimeout(() => {
          if (isMounted) {
            navigate(location.pathname, { replace: true });
          }
        }, 1000);
      }
    })();

    return () => {
      isMounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [showSuccess, refreshUser, navigate, location.pathname, params, query, confirmMutation]);

  // Effect to auto-start checkout if plan is in URL
  useEffect(() => {
    if (!planFromUrl || hasActiveSubscription || checkoutMutation.isPending) return;

    const hasAutoTriggered = sessionStorage.getItem('autoCheckoutTriggered');
    if (hasAutoTriggered) {
      sessionStorage.removeItem('autoCheckoutTriggered');
      navigate(location.pathname, { replace: true });
      return;
    }

    const validPlans = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
    const normalizedPlan = planFromUrl.toUpperCase();
    if (validPlans.includes(normalizedPlan)) {
      sessionStorage.setItem('autoCheckoutTriggered', 'true');
      startCheckout(normalizedPlan);
    }
    // Note: startCheckout is intentionally not in deps to avoid re-triggering on state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFromUrl, hasActiveSubscription, checkoutMutation.isPending, navigate, location.pathname]);

  const subscriptionPlan = currentUser?.subscriptionPlan;
  const subscriptions = normaliseArray(query.data);

  const startCheckout = async (plan = 'BASIC') => {
    try {
      // If user has an active subscription, use change-plan endpoint instead
      if (hasActiveSubscription) {
        const res = await changePlanMutation.mutateAsync({
          data: { plan },
        });
        if (res?.success) {
          // Show success message - the mutation's onSuccess will refresh the data
          return;
        }
      } else {
        // Apply 20% discount for Basic plan when trial is ending (first month only)
        const shouldApplyDiscount = plan === 'BASIC' && (trialDaysRemaining <= 3 || !isTrialActive);

        // Determine final promo code to use (priority order):
        // 1. Validated promo code (user clicked validate)
        // 2. Manual promo code input (user typed but didn't validate)
        // 3. Auto-applied discount (FIRST20 for Basic plan when trial ending)
        let finalPromoCode = null;

        if (validatedPromo?.code) {
          // User validated a promo code - use it
          finalPromoCode = validatedPromo.code;
        } else if (promoCode && promoCode.trim()) {
          // User entered a promo code but didn't validate - still try to use it
          finalPromoCode = promoCode.trim().toUpperCase();
        } else if (shouldApplyDiscount) {
          // Auto-apply FIRST20 discount for Basic plan
          finalPromoCode = 'FIRST20';
        }

        const checkoutData = {
          plan,
          successUrl: `${window.location.origin}/subscriptions?success=1&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/subscriptions?canceled=1`,
        };

        // Only include promoCode if we have one
        if (finalPromoCode) {
          checkoutData.promoCode = finalPromoCode;
        }

        const res = await checkoutMutation.mutateAsync({
          data: checkoutData,
        });

        if (res?.data?.url) {
          window.location.href = res.data.url;
        } else {
          logger.error('No checkout URL returned from backend');
        }
      }
    } catch (err) {
      logger.error("Checkout/plan change failed:", err);
      // Error will be shown via mutation error state
    }
  };

  const handleValidatePromo = async () => {
    const trimmedCode = promoCode.trim();
    if (!trimmedCode) return;

    try {
      const res = await validatePromoMutation.mutateAsync({
        data: { code: trimmedCode.toUpperCase(), plan: subscriptionPlan || 'BASIC' },
      });

      if (res?.data?.valid) {
        // Promo code is valid in our database
        setValidatedPromo(res.data.promoCode);
      } else {
        // Even if validation fails in database, the code might exist in Stripe
        // So we'll still allow it to be used (backend will check Stripe)
        setValidatedPromo({ code: trimmedCode.toUpperCase() });
      }
    } catch (err) {
      // Even if validation fails, allow the code to be used
      // Backend will check Stripe directly during checkout
      setValidatedPromo({ code: trimmedCode.toUpperCase() });
      logger.error('Promo code validation failed (will check Stripe during checkout):', err);
    }
  };

  const handleManageBilling = async () => {
    try {
      await redirectToBillingPortal();
    } catch (err) {
      logger.error('Failed to open billing portal:', err);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    try {
      const res = await updatePaymentMutation.mutateAsync({});
      if (res?.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      logger.error('Update payment method failed:', err);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelMutation.mutateAsync({
        data: { immediate: cancelImmediate },
      });
      setCancelDialogOpen(false);
    } catch (err) {
      logger.error('Cancel subscription failed:', err);
    }
  };

  const openCancelDialog = (immediate = false) => {
    setCancelImmediate(immediate);
    setCancelDialogOpen(true);
  };

  const closeCancelDialog = () => {
    setCancelDialogOpen(false);
    setCancelImmediate(false);
  };

  const formatEnumValue = (value, fallback = 'Not available') => {
    if (!value) return fallback;
    return value
      .toString()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  const hasSubscriptionRecords = subscriptions.length > 0;
  const activeSubscriptionRecord =
    subscriptions.find((subscription) => normaliseStatus(subscription.status) === 'ACTIVE') ||
    (hasSubscriptionRecords ? subscriptions[0] : null);
  const planCode = (subscriptionPlan || 'FREE_TRIAL').toUpperCase();
  const currentPlanDetails = PLAN_DETAILS[planCode] || PLAN_DETAILS.BASIC;
  const nextBillingDate = calculateNextBillingDate(activeSubscriptionRecord, currentPlanDetails);

  const usageStats = usageQuery.data?.usage || {};
  const usageWarnings = usageQuery.data?.warnings || [];

  return (
    <Box sx={{ py: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', overflowX: 'hidden', width: '100%', mx: 'auto' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240, px: { xs: 1.5, sm: 3, md: 4 }, width: '100%', mx: 'auto' }}>
        <Stack spacing={{ xs: 3, sm: 3.5, md: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
              {hasActiveSubscription ? 'Manage Your Subscription' : 'Choose Your Plan'}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto', fontSize: { xs: '0.95rem', sm: '1.15rem', md: '1.25rem' }, px: { xs: 1, sm: 0 } }}>
              {hasActiveSubscription
                ? 'Manage your subscription, view usage, and update billing information'
                : 'Start with a free trial. All plans include every feature - only usage limits differ.'}
            </Typography>
          </Box>

          {/* Trial Status Banner */}
          {isTrialActive && trialDaysRemaining !== null && trialDaysRemaining > 0 && (
            <Alert
              severity={trialDaysRemaining <= 3 ? 'warning' : 'info'}
              icon={<AccessTimeIcon />}
              sx={{
                '& .MuiAlert-message': {
                  width: '100%',
                },
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={{ xs: 2, sm: 3, md: 4 }}
                sx={{ width: '100%' }}
              >
                <Box sx={{ flex: { xs: 1, sm: '1 1 auto' }, minWidth: 0, pr: { sm: 2 } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem', md: '1.15rem' } }}>
                    {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in your trial
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' }, mt: 0.5 }}>
                    {trialDaysRemaining <= 3
                      ? 'Your trial is ending soon. Subscribe now to continue using BuildState FM without interruption.'
                      : 'Subscribe before your trial ends to ensure uninterrupted access to all features.'}
                  </Typography>
                </Box>
                {!hasActiveSubscription && (
                  <Button
                    variant="contained"
                    size="medium"
                    onClick={() => startCheckout('BASIC')}
                    disabled={checkoutMutation.isPending}
                    fullWidth={{ xs: true, sm: false }}
                    sx={{
                      ml: { xs: 0, sm: 0 },
                      minWidth: { xs: '100%', sm: '140px', md: '160px' },
                      maxWidth: { xs: '100%', sm: '180px' },
                      py: { xs: 1.5, sm: 1 },
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {checkoutMutation.isPending ? 'Processing...' : 'Subscribe Now'}
                  </Button>
                )}
              </Stack>
            </Alert>
          )}

          {/* Success/Cancel Banners */}
          {showSuccess && (
            <Alert severity="success">
              <strong>Payment successful!</strong> Your subscription is now active. Welcome to BuildState FM!
            </Alert>
          )}
          {showCanceled && (
            <Alert severity="info">
              Checkout was canceled. No charges were made. You can subscribe anytime.
            </Alert>
          )}
          {checkoutMutation.isError && (
            <Alert severity="error">
              {checkoutMutation.error?.response?.data?.message || checkoutMutation.error?.message || 'Checkout failed. Please try again.'}
            </Alert>
          )}
          {changePlanMutation.isError && (
            <Alert severity="error">
              {changePlanMutation.error?.response?.data?.message || changePlanMutation.error?.message || 'Plan change failed. Please try again.'}
            </Alert>
          )}
          {changePlanMutation.isSuccess && (
            <Alert severity="success">
              <strong>Plan changed successfully!</strong> Your subscription has been updated.
            </Alert>
          )}

          {/* Plan Selection - Show all plans side by side */}
          {!hasActiveSubscription && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
                Compare Plans
              </Typography>
              {/* Mobile Grid Layout */}
              <Grid container spacing={2} sx={{ display: { xs: 'flex', md: 'none' }, mx: 0, width: '100%' }}>
                {Object.entries(PLAN_DETAILS).map(([planKey, plan]) => (
                  <Grid item xs={12} key={planKey} sx={{ px: 0 }}>
                    <MobilePlanCard
                      plan={plan}
                      planKey={planKey}
                      isCurrentPlan={false}
                      onSelect={startCheckout}
                      isLoading={checkoutMutation.isPending}
                      trialDaysRemaining={trialDaysRemaining}
                      isTrialActive={isTrialActive}
                    />
                  </Grid>
                ))}
              </Grid>
              {/* Desktop Grid Layout */}
              <Grid container spacing={3} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                {Object.entries(PLAN_DETAILS).map(([planKey, plan]) => (
                  <Grid item xs={12} md={4} key={planKey}>
                    <PlanCard
                      plan={plan}
                      planKey={planKey}
                      isCurrentPlan={false}
                      onSelect={startCheckout}
                      isLoading={checkoutMutation.isPending}
                      trialDaysRemaining={trialDaysRemaining}
                      isTrialActive={isTrialActive}
                    />
                  </Grid>
                ))}
              </Grid>

              {/* Promo Code Section */}
              <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 }, mt: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: 'background.paper', width: '100%', mx: 'auto' }}>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <LocalOfferIcon color="primary" sx={{ fontSize: { xs: 28, sm: 32 }, alignSelf: { xs: 'center', sm: 'flex-start' } }} />
                  <Box sx={{ flexGrow: 1, width: { xs: '100%', sm: 'auto' } }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, textAlign: { xs: 'center', sm: 'left' } }}>
                      Have a promo code?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'center', sm: 'left' }, mb: 0.5 }}>
                      Enter your code during checkout to apply the discount
                    </Typography>
                    <Typography variant="caption" color="primary" sx={{ fontWeight: 600, textAlign: { xs: 'center', sm: 'left' }, display: 'block' }}>
                      💡 Use code <strong>"FIRST20"</strong> for a one-time 20% off your first month!
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleValidatePromo}
                            disabled={!promoCode.trim() || validatePromoMutation.isPending}
                          >
                            Validate
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 250 } }}
                  />
                </Stack>
                {validatedPromo && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>{validatedPromo.code}</strong> - {validatedPromo.description || 'Valid promo code'}
                      {validatedPromo.discountType === 'PERCENTAGE' && ` (${validatedPromo.discountPercentage}% off)`}
                      {validatedPromo.discountType === 'FIXED' && ` (${formatCurrency(validatedPromo.discountAmount)} off)`}
                    </Typography>
                  </Alert>
                )}
              </Paper>
            </Box>
          )}

          {/* Plan Comparison for Active Subscribers - No white background, just plan cards */}
          {hasActiveSubscription && (
            <Box>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  Change Your Plan
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}>
                  Upgrade or downgrade your subscription at any time. Changes will be prorated.
                </Typography>
              </Box>
              {/* Mobile Grid Layout */}
              <Grid container spacing={2} sx={{ display: { xs: 'flex', md: 'none' }, mx: 0, width: '100%', justifyContent: 'center' }}>
                {Object.entries(PLAN_DETAILS).map(([planKey, plan]) => {
                  const isCurrentPlan = subscriptionPlan === planKey;
                  const currentPlanIndex = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].indexOf(subscriptionPlan);
                  const thisPlanIndex = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].indexOf(planKey);
                  const isUpgrade = thisPlanIndex > currentPlanIndex;
                  const isDowngrade = thisPlanIndex < currentPlanIndex;

                  return (
                    <Grid item xs={12} key={planKey} sx={{ px: 0, maxWidth: { xs: '100%', sm: '500px' } }}>
                      <MobilePlanCard
                        plan={plan}
                        planKey={planKey}
                        isCurrentPlan={isCurrentPlan}
                        onSelect={startCheckout}
                        isLoading={checkoutMutation.isPending || changePlanMutation.isPending}
                        trialDaysRemaining={trialDaysRemaining}
                        isTrialActive={false}
                        isUpgrade={isUpgrade}
                        isDowngrade={isDowngrade}
                      />
                    </Grid>
                  );
                })}
              </Grid>
              {/* Desktop Grid Layout */}
              <Grid container spacing={3} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                {Object.entries(PLAN_DETAILS).map(([planKey, plan]) => {
                  const isCurrentPlan = subscriptionPlan === planKey;
                  const currentPlanIndex = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].indexOf(subscriptionPlan);
                  const thisPlanIndex = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].indexOf(planKey);
                  const isUpgrade = thisPlanIndex > currentPlanIndex;
                  const isDowngrade = thisPlanIndex < currentPlanIndex;

                  return (
                    <Grid item xs={12} md={4} key={planKey}>
                      <PlanCard
                        plan={plan}
                        planKey={planKey}
                        isCurrentPlan={isCurrentPlan}
                        onSelect={startCheckout}
                        isLoading={checkoutMutation.isPending || changePlanMutation.isPending}
                        trialDaysRemaining={trialDaysRemaining}
                        isTrialActive={false}
                        isUpgrade={isUpgrade}
                        isDowngrade={isDowngrade}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}


          {/* Subscription Details for Active Subscribers */}
          {hasActiveSubscription && (
            <>
              {/* First Row: Subscription Details and Billing Management */}
              <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ width: '100%', mx: 'auto', maxWidth: '100%' }}>
                {/* Subscription Info */}
                <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                  <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3, boxShadow: 2, height: '100%', width: '100%', flex: 1 }}>
                      <Stack spacing={3}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                            Subscription Details
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}>
                            Your current plan and billing information
                          </Typography>
                        </Box>
                        <Stack spacing={2}>
                          <DetailRow
                            icon={<PaymentIcon fontSize="small" />}
                            label="Plan"
                            value={currentPlanDetails.name}
                          />
                          <DetailRow
                            icon={<PaymentIcon fontSize="small" />}
                            label="Price"
                            value={`${formatCurrency(currentPlanDetails.price)}/month`}
                          />
                          <DetailRow
                            icon={<AutorenewIcon fontSize="small" />}
                            label="Billing Cycle"
                            value="Monthly"
                          />
                          <DetailRow
                            icon={<CalendarMonthIcon fontSize="small" />}
                            label="Next Billing Date"
                            value={nextBillingDate ? formatDateDisplay(nextBillingDate) : 'Managed via Stripe'}
                          />
                          <DetailRow
                            icon={<PersonIcon fontSize="small" />}
                            label="Account Owner"
                            value={[currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.email || 'Not available'}
                          />
                        </Stack>
                      </Stack>
                    </Paper>
                </Grid>

                {/* Billing Actions */}
                <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                  <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3, boxShadow: 2, height: '100%', width: '100%', flex: 1 }}>
                      <Stack spacing={3}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                            Billing Management
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}>
                            Update payment method or manage your subscription
                          </Typography>
                        </Box>
                        {/* Desktop: Vertical Stack */}
                        <Stack spacing={2} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                          <Button
                            variant="outlined"
                            startIcon={<CreditCardIcon />}
                            onClick={handleManageBilling}
                            fullWidth
                            size="large"
                          >
                            Manage Billing Portal
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<CreditCardIcon />}
                            onClick={handleUpdatePaymentMethod}
                            disabled={updatePaymentMutation.isPending}
                            fullWidth
                            size="large"
                          >
                            {updatePaymentMutation.isPending ? 'Processing...' : 'Update Payment Method'}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => openCancelDialog(false)}
                            disabled={cancelMutation.isPending}
                            fullWidth
                            size="large"
                          >
                            Cancel Subscription
                          </Button>
                        </Stack>
                        {/* Mobile: Vertical Stack (same as desktop for better UX) */}
                        <Stack spacing={2} sx={{ display: { xs: 'flex', sm: 'none' } }}>
                          <Button
                            variant="outlined"
                            startIcon={<CreditCardIcon />}
                            onClick={handleManageBilling}
                            fullWidth
                            size="large"
                            sx={{ py: 1.5 }}
                          >
                            Manage Billing Portal
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<CreditCardIcon />}
                            onClick={handleUpdatePaymentMethod}
                            disabled={updatePaymentMutation.isPending}
                            fullWidth
                            size="large"
                            sx={{ py: 1.5 }}
                          >
                            {updatePaymentMutation.isPending ? 'Processing...' : 'Update Payment Method'}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => openCancelDialog(false)}
                            disabled={cancelMutation.isPending}
                            fullWidth
                            size="large"
                            sx={{ py: 1.5 }}
                          >
                            Cancel Subscription
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                </Grid>
              </Grid>

              {/* Second Row: Usage Statistics */}
              {usageQuery.data && (
                <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', mt: { xs: 2, sm: 3 } }}>
                  <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3, boxShadow: 2, width: '100%', overflow: 'hidden' }}>
                    <Stack spacing={3}>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 2, sm: 0 } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                            Usage Statistics
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}>
                            Track your current usage against plan limits
                          </Typography>
                        </Box>
                        {/* Mobile only - Show/Hide button */}
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setShowUsageDetails(!showUsageDetails)}
                          endIcon={showUsageDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          sx={{ 
                            display: { xs: 'flex', md: 'none' },
                            alignSelf: { xs: 'stretch', sm: 'auto' }, 
                            minWidth: { xs: '100%', sm: 'auto' }, 
                            flexShrink: 0 
                          }}
                        >
                          {showUsageDetails ? 'Show Less' : 'Show All'}
                        </Button>
                      </Box>

                      <Grid container spacing={3} sx={{ mx: 0, width: '100%' }}>
                        {/* Key Metrics */}
                        <Grid item xs={12} md={6} sx={{ px: 0 }}>
                          <UsageProgressBar
                            label="Properties"
                            current={usageStats.properties?.current || 0}
                            limit={usageStats.properties?.limit}
                          />
                          <UsageProgressBar
                            label="Team Members"
                            current={usageStats.teamMembers?.current || 0}
                            limit={usageStats.teamMembers?.limit}
                          />
                          <UsageProgressBar
                            label="Inspections This Month"
                            current={usageStats.inspectionsPerMonth?.current || 0}
                            limit={usageStats.inspectionsPerMonth?.limit}
                          />
                          <UsageProgressBar
                            label="Jobs This Month"
                            current={usageStats.jobsPerMonth?.current || 0}
                            limit={usageStats.jobsPerMonth?.limit}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} sx={{ px: 0 }}>
                          {/* Desktop: Always show, Mobile: Collapse */}
                          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                            <UsageProgressBar
                              label="Recurring Inspections"
                              current={usageStats.recurringInspections?.current || 0}
                              limit={usageStats.recurringInspections?.limit}
                            />
                            <UsageProgressBar
                              label="Custom Templates"
                              current={usageStats.customTemplates?.current || 0}
                              limit={usageStats.customTemplates?.limit}
                            />
                            <UsageProgressBar
                              label="Document Uploads This Month"
                              current={usageStats.documentUploadsPerMonth?.current || 0}
                              limit={usageStats.documentUploadsPerMonth?.limit}
                            />
                            <UsageProgressBar
                              label="Storage"
                              current={usageStats.storageGB?.current || 0}
                              limit={usageStats.storageGB?.limit}
                              unit="GB"
                            />
                          </Box>
                          {/* Mobile: Collapsible */}
                          <Collapse in={showUsageDetails} sx={{ display: { xs: 'block', md: 'none' } }}>
                            <UsageProgressBar
                              label="Recurring Inspections"
                              current={usageStats.recurringInspections?.current || 0}
                              limit={usageStats.recurringInspections?.limit}
                            />
                            <UsageProgressBar
                              label="Custom Templates"
                              current={usageStats.customTemplates?.current || 0}
                              limit={usageStats.customTemplates?.limit}
                            />
                            <UsageProgressBar
                              label="Document Uploads This Month"
                              current={usageStats.documentUploadsPerMonth?.current || 0}
                              limit={usageStats.documentUploadsPerMonth?.limit}
                            />
                            <UsageProgressBar
                              label="Storage"
                              current={usageStats.storageGB?.current || 0}
                              limit={usageStats.storageGB?.limit}
                              unit="GB"
                            />
                          </Collapse>
                          {!showUsageDetails && (
                            <Box sx={{ textAlign: 'center', pt: 2, display: { xs: 'block', md: 'none' } }}>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => setShowUsageDetails(true)}
                              >
                                View all usage metrics
                              </Button>
                            </Box>
                          )}
                        </Grid>
                      </Grid>

                      {usageWarnings.length > 0 && (
                        <Alert severity="warning">
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Approaching Limits
                          </Typography>
                          <List dense>
                            {usageWarnings.map((warning, idx) => (
                              <ListItem key={idx} sx={{ py: 0.5 }}>
                                <ListItemText
                                  primary={warning.message || `You're using ${warning.percentage}% of your ${warning.limitType} limit`}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Alert>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              )}

              {/* Third Row: Invoice History */}
              <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', mt: { xs: 2, sm: 3 } }}>
                <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3, boxShadow: 2, width: '100%' }}>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                        Invoice History
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}>
                        View and download your billing invoices
                      </Typography>
                    </Box>
                    <DataState
                      isLoading={invoicesQuery.isLoading}
                      isError={invoicesQuery.isError}
                      error={invoicesQuery.error}
                      isEmpty={!invoicesQuery.isLoading && !invoicesQuery.isError && (!invoicesQuery.data?.invoices || invoicesQuery.data.invoices.length === 0)}
                      emptyMessage="No invoices found"
                      onRetry={invoicesQuery.refetch}
                    >
                      {invoicesQuery.data?.invoices && invoicesQuery.data.invoices.length > 0 && (
                        <>
                          {/* Desktop: Table View */}
                          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                            <Table>
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Invoice #</strong></TableCell>
                                  <TableCell><strong>Date</strong></TableCell>
                                  <TableCell><strong>Description</strong></TableCell>
                                  <TableCell align="right"><strong>Amount</strong></TableCell>
                                  <TableCell><strong>Status</strong></TableCell>
                                  <TableCell align="center"><strong>Actions</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {invoicesQuery.data.invoices.map((invoice) => (
                                  <TableRow key={invoice.id} hover>
                                    <TableCell>{invoice.number || invoice.id.slice(-8)}</TableCell>
                                    <TableCell>
                                      {formatDate(new Date(invoice.created * 1000))}
                                    </TableCell>
                                    <TableCell>{invoice.description}</TableCell>
                                    <TableCell align="right">
                                      {formatCurrency(invoice.amount, invoice.currency)}
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={invoice.status.toUpperCase()}
                                        color={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'default'}
                                        size="small"
                                      />
                                    </TableCell>
                                    <TableCell align="center">
                                      {invoice.invoicePdf && (
                                        <Link
                                          href={invoice.invoicePdf}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                                        >
                                          <DownloadIcon fontSize="small" />
                                          PDF
                                        </Link>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                          {/* Mobile: Card View */}
                          <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                            {invoicesQuery.data.invoices.map((invoice) => (
                              <Card key={invoice.id} sx={{ boxShadow: 2 }}>
                                <CardContent sx={{ p: 2.5 }}>
                                  <Stack spacing={2}>
                                    {/* Header Row */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                                      <Box>
                                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                          Invoice Number
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                                          {invoice.number || invoice.id.slice(-8)}
                                        </Typography>
                                      </Box>
                                      <Chip
                                        label={invoice.status.toUpperCase()}
                                        color={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'default'}
                                        size="small"
                                        sx={{ fontWeight: 600 }}
                                      />
                                    </Box>
                                    <Divider />
                                    {/* Description */}
                                    <Box>
                                      <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                        Description
                                      </Typography>
                                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                                        {invoice.description}
                                      </Typography>
                                    </Box>
                                    {/* Date and Amount Row */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                      <Box>
                                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                          Date
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                                          {formatDate(new Date(invoice.created * 1000))}
                                        </Typography>
                                      </Box>
                                      <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                          Amount
                                        </Typography>
                                        <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 700, color: 'primary.main' }}>
                                          {formatCurrency(invoice.amount, invoice.currency)}
                                        </Typography>
                                      </Box>
                                    </Box>
                                    {/* Action Button */}
                                    {invoice.invoicePdf && (
                                      <>
                                        <Divider />
                                        <Button
                                          variant="outlined"
                                          startIcon={<DownloadIcon />}
                                          href={invoice.invoicePdf}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          fullWidth
                                          size="medium"
                                          component="a"
                                          sx={{ mt: 1 }}
                                        >
                                          Download PDF
                                        </Button>
                                      </>
                                    )}
                                  </Stack>
                                </CardContent>
                              </Card>
                            ))}
                          </Stack>
                        </>
                      )}
                    </DataState>
                  </Stack>
                </Paper>
              </Box>
            </>
          )}

          {/* Why Subscribe Section */}
          {!hasActiveSubscription && (
            <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: 3, bgcolor: 'background.paper', boxShadow: 2, width: '100%', mx: 'auto' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
                Why Subscribe to BuildState FM?
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                    <BusinessIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Streamline Operations
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage all your properties, units, and team members from one unified platform.
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Stay Compliant
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Track inspections, maintenance plans, and generate reports for compliance and decision-making.
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                    <TrendingUpIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Collaborate Better
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Invite owners, tenants, and technicians to collaborate seamlessly on jobs and service requests.
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Cancellation Confirmation Dialog */}
          <Dialog
            open={cancelDialogOpen}
            onClose={closeCancelDialog}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {cancelImmediate ? 'Cancel Subscription Immediately?' : 'Cancel Subscription?'}
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                {cancelImmediate ? (
                  <>
                    Your subscription will be cancelled immediately and you will lose access to all features right away.
                    <br /><br />
                    <strong>This action cannot be undone.</strong>
                  </>
                ) : (
                  <>
                    Your subscription will be cancelled at the end of the current billing period. You'll continue to have access until {nextBillingDate ? formatDateDisplay(nextBillingDate) : 'the end of your billing period'}.
                    <br /><br />
                    You can resubscribe at any time.
                  </>
                )}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeCancelDialog} disabled={cancelMutation.isPending}>
                Keep Subscription
              </Button>
              <Button
                onClick={handleCancelSubscription}
                color="error"
                variant="contained"
                disabled={cancelMutation.isPending}
                startIcon={cancelMutation.isPending ? <CircularProgress size={16} /> : <CancelIcon />}
              >
                {cancelMutation.isPending ? 'Cancelling...' : cancelImmediate ? 'Cancel Now' : 'Cancel at Period End'}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Container>
    </Box>
  );
}
