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
import useApiQuery from '../hooks/useApiQuery.js';
import useApiMutation from '../hooks/useApiMutation.js';
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
      '1 team member',
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
      teamMembers: 1,
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
      '5 team members',
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
      teamMembers: 5,
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
    <Stack direction="row" spacing={2} alignItems="flex-start">
      {icon ? (
        <Box sx={{ color: 'primary.main', mt: 0.5, display: 'inline-flex' }}>
          {icon}
        </Box>
      ) : null}
      <Box>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 0.6, display: 'block' }}
        >
          {label}
        </Typography>
        {React.isValidElement(resolvedValue) ? (
          resolvedValue
        ) : (
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
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
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: isExceeded ? 'error.main' : isApproaching ? 'warning.main' : 'text.secondary',
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
            '& .MuiLinearProgress-bar': {
              bgcolor: isExceeded ? 'error.main' : isApproaching ? 'warning.main' : 'primary.main',
            },
          }}
        />
      )}
    </Box>
  );
}

function PlanCard({ plan, planKey, isCurrentPlan, onSelect, isLoading, trialDaysRemaining, isTrialActive }) {
  const showDiscount = (trialDaysRemaining <= 3 || !isTrialActive) && planKey === 'BASIC';
  const discountedPrice = showDiscount ? Math.round(plan.price * 0.8) : plan.price;

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
        {showDiscount && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: plan.popular ? '50%' : '50%',
              transform: 'translateX(-50%)',
              zIndex: plan.popular ? 2 : 1,
            }}
          >
            <Chip
              icon={<LocalOfferIcon />}
              label="20% OFF FIRST MONTH"
              sx={{
                bgcolor: '#dc2626',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        )}
        <Stack spacing={3} sx={{ flexGrow: 1, mt: (plan.popular || showDiscount || isCurrentPlan) ? 4 : 0 }}>
          {/* Plan Header */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {plan.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {plan.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              {showDiscount && (
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    textDecoration: 'line-through',
                  }}
                >
                  {formatCurrency(plan.price)}
                </Typography>
              )}
              <Typography variant="h3" sx={{ fontWeight: 700, color: showDiscount ? '#dc2626' : 'inherit' }}>
                {formatCurrency(discountedPrice)}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                /month
              </Typography>
            </Box>
            {showDiscount && (
              <Typography variant="caption" color="error" sx={{ fontWeight: 600, display: 'block', mt: 0.5 }}>
                First month only • Regular price applies after
              </Typography>
            )}
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

  // Determine if user has active subscription first
  const subscriptionStatus = currentUser?.subscriptionStatus;
  const hasActiveSubscription = subscriptionStatus === 'ACTIVE';
  const isTrialActive = subscriptionStatus === 'TRIAL';
  const trialDaysRemaining = calculateDaysRemaining(currentUser?.trialEndDate);

  // Fetch subscriptions
  const query = useApiQuery({
    queryKey: queryKeys.subscriptions.all(),
    url: '/subscriptions',
  });

  // Fetch usage stats
  const usageQuery = useApiQuery({
    queryKey: ['subscriptions', 'usage'],
    url: '/subscriptions/usage',
    enabled: Boolean(currentUser),
  });

  // Checkout mutation
  const checkoutMutation = useApiMutation({
    url: '/billing/checkout',
    method: 'post',
  });

  // Promo code validation
  const validatePromoMutation = useApiMutation({
    url: '/promo-codes/validate',
    method: 'post',
  });

  // Invoices query
  const invoicesQuery = useApiQuery({
    queryKey: ['billing', 'invoices'],
    url: '/billing/invoices',
    enabled: hasActiveSubscription,
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
    (async () => {
      try {
        await refreshUser();
      } finally {
        if (isMounted) {
          navigate(location.pathname, { replace: true });
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [showSuccess, refreshUser, navigate, location.pathname]);

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
  }, [planFromUrl, hasActiveSubscription, checkoutMutation.isPending]);

  const subscriptionPlan = currentUser?.subscriptionPlan;
  const subscriptions = normaliseArray(query.data);

  const startCheckout = async (plan = 'BASIC') => {
    try {
      // Apply 20% discount for Basic plan when trial is ending (first month only)
      const shouldApplyDiscount = plan === 'BASIC' && (trialDaysRemaining <= 3 || !isTrialActive);
      const promoCode = shouldApplyDiscount ? 'FIRST20' : validatedPromo?.code || null;

      const res = await checkoutMutation.mutateAsync({
        data: {
          plan,
          successUrl: `${window.location.origin}/subscriptions?success=1`,
          cancelUrl: `${window.location.origin}/subscriptions?canceled=1`,
          promoCode,
        },
      });
      if (res?.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      logger.error("Checkout failed:", err);
    }
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const res = await validatePromoMutation.mutateAsync({
        data: { code: promoCode.trim().toUpperCase(), plan: subscriptionPlan || 'BASIC' },
      });
      if (res?.data?.valid) {
        setValidatedPromo(res.data.promoCode);
      } else {
        setValidatedPromo(null);
      }
    } catch (err) {
      setValidatedPromo(null);
      logger.error('Promo code validation failed:', err);
    }
  };

  const handleManageBilling = () => {
    redirectToBillingPortal();
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
    <Box sx={{ py: 4, minHeight: '100vh' }}>
      <Container maxWidth="xl">
        <Stack spacing={4}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
              {hasActiveSubscription ? 'Manage Your Subscription' : 'Choose Your Plan'}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in your trial
                  </Typography>
                  <Typography variant="body2">
                    {trialDaysRemaining <= 3
                      ? 'Your trial is ending soon. Subscribe now to continue using BuildState FM without interruption.'
                      : 'Subscribe before your trial ends to ensure uninterrupted access to all features.'}
                  </Typography>
                </Box>
                {!hasActiveSubscription && (
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => startCheckout('BASIC')}
                    disabled={checkoutMutation.isPending}
                    sx={{ ml: 2 }}
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

          {/* Usage Statistics Section */}
          {hasActiveSubscription && usageQuery.data && (
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Usage Statistics
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Track your current usage against plan limits
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowUsageDetails(!showUsageDetails)}
                    endIcon={showUsageDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {showUsageDetails ? 'Show Less' : 'Show All'}
                  </Button>
                </Box>

                <Grid container spacing={3}>
                  {/* Key Metrics */}
                  <Grid item xs={12} md={6}>
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
                  <Grid item xs={12} md={6}>
                    <Collapse in={showUsageDetails}>
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
                      <Box sx={{ textAlign: 'center', pt: 2 }}>
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
          )}

          {/* Plan Selection - Show all plans side by side */}
          {!hasActiveSubscription && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
                Compare Plans
              </Typography>
              <Grid container spacing={3}>
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
              <Paper sx={{ p: 3, mt: 4, borderRadius: 3, bgcolor: 'background.paper' }}>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems="center">
                  <LocalOfferIcon color="primary" sx={{ fontSize: 32 }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Have a promo code?
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Enter your code during checkout to apply the discount
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
                    sx={{ minWidth: 250 }}
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

          {/* Plan Comparison for Active Subscribers */}
          {hasActiveSubscription && (
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                    Change Your Plan
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Upgrade or downgrade your subscription at any time. Changes will be prorated.
                  </Typography>
                </Box>
                <Grid container spacing={3}>
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
                          isLoading={checkoutMutation.isPending}
                          trialDaysRemaining={trialDaysRemaining}
                          isTrialActive={false}
                        />
                      </Grid>
                    );
                  })}
                </Grid>
              </Stack>
            </Paper>
          )}


          {/* Subscription Details for Active Subscribers */}
          {hasActiveSubscription && (
            <Grid container spacing={3}>
              {/* Subscription Info */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2, height: '100%' }}>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Subscription Details
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
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
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2, height: '100%' }}>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Billing Management
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Update payment method or manage your subscription
                      </Typography>
                    </Box>
                    <Stack spacing={2}>
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
                  </Stack>
                </Paper>
              </Grid>

              {/* Invoice History */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Invoice History
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
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
                        <TableContainer>
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
                      )}
                    </DataState>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Why Subscribe Section */}
          {!hasActiveSubscription && (
            <Paper sx={{ p: 4, borderRadius: 3, bgcolor: 'background.paper', boxShadow: 2 }}>
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
