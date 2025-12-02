import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Typography, Paper, Stack, Button, Card, CardContent, Divider, Chip,
  List, ListItem, ListItemIcon, ListItemText, Container, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  CircularProgress, Link,
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
  STARTER: {
    name: 'Starter Plan',
    price: 29,
    currency: 'USD',
    interval: 'month',
    billingIntervalLabel: 'Monthly',
    billingIntervalSuffix: '/month',
    description: 'Everything you need to organise your portfolio, track jobs, and keep stakeholders aligned.',
    features: [
      'Unlimited properties & units',
      'Assign owners, tenants & technicians',
      'Inspection & job management',
      'Maintenance plans & scheduling',
      'Reports & analytics dashboard',
      'Service requests & recommendations',
      'Email support',
    ],
  },
  GROWTH: {
    name: 'Growth Plan',
    price: 79,
    currency: 'USD',
    interval: 'month',
    billingIntervalLabel: 'Monthly',
    billingIntervalSuffix: '/month',
    description: 'Advanced automation and analytics for scaling facility teams.',
    features: [
      'Everything in Starter',
      'Advanced automation workflows',
      'Unlimited technician accounts',
      'Custom dashboards & reporting',
      'Priority live chat support',
    ],
  },
  SCALE: {
    name: 'Scale Plan',
    price: 149,
    currency: 'USD',
    interval: 'month',
    billingIntervalLabel: 'Monthly',
    billingIntervalSuffix: '/month',
    description: 'Enterprise controls and insights for complex portfolios.',
    features: [
      'Everything in Growth',
      'Portfolio analytics & forecasting',
      'Single sign-on (SSO)',
      'Dedicated customer success manager',
      'Quarterly optimisation reviews',
    ],
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

export default function SubscriptionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser, refreshUser } = useCurrentUser();

  // Determine if user has active subscription first
  const subscriptionStatus = currentUser?.subscriptionStatus;
  const hasActiveSubscription = subscriptionStatus === 'ACTIVE';

  const query = useApiQuery({
    queryKey: queryKeys.subscriptions.all(),
    url: '/subscriptions',
  });
  const checkoutMutation = useApiMutation({
    url: '/billing/checkout',
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

  // State for cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);

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

  // Effect to auto-start checkout if plan is in URL and user just signed up
  useEffect(() => {
    if (!planFromUrl || hasActiveSubscription || checkoutMutation.isPending) return;

    // Only auto-trigger checkout once
    const hasAutoTriggered = sessionStorage.getItem('autoCheckoutTriggered');
    if (hasAutoTriggered) {
      // Clear the flag and plan from URL
      sessionStorage.removeItem('autoCheckoutTriggered');
      navigate(location.pathname, { replace: true });
      return;
    }

    // Validate plan
    const validPlans = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    const normalizedPlan = planFromUrl.toUpperCase();
    if (validPlans.includes(normalizedPlan)) {
      sessionStorage.setItem('autoCheckoutTriggered', 'true');
      startCheckout(normalizedPlan);
    }
  }, [planFromUrl, hasActiveSubscription, checkoutMutation.isPending]);

  // Define variables based on the currentUser state
  const subscriptionPlan = currentUser?.subscriptionPlan;
  const isTrialActive = subscriptionStatus === 'TRIAL';
  const userHasActiveSubscription = hasActiveSubscription; // Keep for consistency with existing code
  const trialDaysRemaining = calculateDaysRemaining(currentUser?.trialEndDate);
  // Default to STARTER if no plan or if plan is FREE_TRIAL (which isn't a paid plan)
  const planForCheckout = (subscriptionPlan && subscriptionPlan !== 'FREE_TRIAL') ? subscriptionPlan : 'STARTER';

  // Existing data fetching and processing logic
  const subscriptions = normaliseArray(query.data);

  const startCheckout = async (plan = 'STARTER') => {
    try {
      const res = await checkoutMutation.mutateAsync({
        data: {
          plan,
          successUrl: `${window.location.origin}/subscriptions?success=1`,
          cancelUrl: `${window.location.origin}/subscriptions?canceled=1`,
        },
      });
      if (res?.data?.url) {
        window.location.href = res.data.url; // Redirect to Stripe checkout
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      // Error is displayed via checkoutMutation.isError and checkoutMutation.error
      logger.error("Checkout failed:", err);
    }
  };

  const handleManageBilling = () => {
    redirectToBillingPortal();
  };

  const handleUpdatePaymentMethod = async () => {
    try {
      const res = await updatePaymentMutation.mutateAsync({});
      if (res?.data?.url) {
        window.location.href = res.data.url; // Redirect to Stripe billing portal
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

  const trialStatusLabel = () => {
    // Only show trial label if the user is actually in a trial
    if (!isTrialActive || trialDaysRemaining === null) return null;
    if (trialDaysRemaining > 0) {
      return `Trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`;
    }
    return 'Trial ended';
  };

  // Determine the primary call-to-action button's label and action
  let primaryCtaLabel = 'Subscribe';
  let primaryCtaAction = () => startCheckout(planForCheckout);
  if (userHasActiveSubscription) {
    primaryCtaLabel = 'Manage Billing';
    primaryCtaAction = handleManageBilling;
  } else if (isTrialActive && trialDaysRemaining > 0) {
    // Optionally change CTA during trial, e.g., "Upgrade Now"
     primaryCtaLabel = 'Subscribe Now';
  }

  const trialLabel = trialStatusLabel();
  const planCode = (planForCheckout || 'STARTER').toUpperCase();
  const planDetails = PLAN_DETAILS[planCode] || PLAN_DETAILS.STARTER;
  const planNameDisplay = planDetails?.name || formatEnumValue(subscriptionPlan, 'No active plan');
  const planPriceValue =
    typeof planDetails?.price === 'number'
      ? formatCurrency(planDetails.price, planDetails.currency)
      : null;
  const planPricingLabel =
    typeof planDetails?.price === 'number'
      ? `${planPriceValue} ${planDetails?.billingIntervalSuffix ?? ''}`.trim()
      : 'Contact support';
  const planPriceInterval =
    planDetails?.interval === 'year'
      ? 'year'
      : planDetails?.interval === 'week'
        ? 'week'
        : 'month';
  const billingCycleLabel = planDetails?.billingIntervalLabel || 'Monthly';
  const hasSubscriptionRecords = subscriptions.length > 0;
  const activeSubscriptionRecord =
    subscriptions.find((subscription) => normaliseStatus(subscription.status) === 'ACTIVE') ||
    (hasSubscriptionRecords ? subscriptions[0] : null);
  const nextBillingDate = calculateNextBillingDate(activeSubscriptionRecord, planDetails);
  const normalisedActiveStatus = normaliseStatus(activeSubscriptionRecord?.status);

  const cancellationIndicators = [
    activeSubscriptionRecord?.cancelAtPeriodEnd,
    activeSubscriptionRecord?.cancel_at_period_end,
    activeSubscriptionRecord?.cancellationPending,
    activeSubscriptionRecord?.pendingCancellation,
    activeSubscriptionRecord?.cancellationScheduled,
    activeSubscriptionRecord?.isCancellationScheduled,
    activeSubscriptionRecord?.willCancelAtPeriodEnd,
    activeSubscriptionRecord?.isCancelAtPeriodEnd,
    activeSubscriptionRecord?.cancelAtEnd,
    normalisedActiveStatus === 'CANCELLED',
    normalisedActiveStatus === 'CANCELED',
    (typeof subscriptionStatus === 'string' && subscriptionStatus.toUpperCase() === 'CANCELLED'),
  ];

  const hasCancellationFlag = cancellationIndicators.some(Boolean);

  const cancellationDateCandidates = [
    activeSubscriptionRecord?.cancellationEffectiveDate,
    activeSubscriptionRecord?.cancellation_effective_date,
    activeSubscriptionRecord?.cancellationDate,
    activeSubscriptionRecord?.cancellation_date,
    activeSubscriptionRecord?.cancelAt,
    activeSubscriptionRecord?.cancel_at,
    activeSubscriptionRecord?.cancelledAt,
    activeSubscriptionRecord?.cancelled_at,
    activeSubscriptionRecord?.canceledAt,
    activeSubscriptionRecord?.canceled_at,
    activeSubscriptionRecord?.endsAt,
    activeSubscriptionRecord?.ends_at,
    activeSubscriptionRecord?.endAt,
    activeSubscriptionRecord?.end_at,
    activeSubscriptionRecord?.endDate,
    activeSubscriptionRecord?.end_date,
    activeSubscriptionRecord?.expiryDate,
    activeSubscriptionRecord?.expiry_date,
    activeSubscriptionRecord?.expiresAt,
    activeSubscriptionRecord?.expires_at,
  ];

  if (hasCancellationFlag) {
    cancellationDateCandidates.push(
      activeSubscriptionRecord?.stripeCurrentPeriodEnd,
      activeSubscriptionRecord?.currentPeriodEnd,
      activeSubscriptionRecord?.current_period_end,
      activeSubscriptionRecord?.periodEnd,
      activeSubscriptionRecord?.period_end,
      currentUser?.subscriptionEndsAt,
      currentUser?.subscriptionEndDate,
      currentUser?.subscriptionExpiresAt,
      currentUser?.subscriptionExpiresOn,
      currentUser?.subscriptionCancelledAt,
      currentUser?.subscriptionCancelledOn,
      currentUser?.subscriptionCanceledAt,
      currentUser?.subscriptionCancellationDate,
    );
  }

  const cancellationDate = hasCancellationFlag ? firstValidDate(...cancellationDateCandidates) : null;
  const cancellationDateLabel = cancellationDate ? formatDateDisplay(cancellationDate) : null;
  const cancellationHasPassed = cancellationDate ? cancellationDate.getTime() <= Date.now() : false;
  const isCancellationScheduled = Boolean(hasCancellationFlag && cancellationDate && !cancellationHasPassed);
  const cancellationEnded = Boolean(hasCancellationFlag && cancellationDate && cancellationHasPassed);

  let nextBillingRowLabel = 'Next renewal';
  let nextBillingLabel = nextBillingDate ? formatDateDisplay(nextBillingDate) : 'Managed via Stripe';

  if (isCancellationScheduled || cancellationEnded) {
    nextBillingRowLabel = cancellationEnded ? 'Ended on' : 'Access until';
    nextBillingLabel = cancellationDateLabel || nextBillingLabel;
  }

  const cancellationChipLabel = cancellationDateLabel
    ? cancellationEnded
      ? `Ended on ${cancellationDateLabel}`
      : `Access until ${cancellationDateLabel}`
    : null;
  const showCancellationAlert = Boolean(isCancellationScheduled && cancellationDateLabel);
  const planDescription = planDetails?.description || '';
  const planFeatures = Array.isArray(planDetails?.features) ? planDetails.features : [];
  const accountOwner = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const accountOwnerDisplay = accountOwner || currentUser?.email || 'Not available';
  const billingEmail = currentUser?.email || 'Not provided';
  const billingPhone = currentUser?.phone || 'Not provided';
  const accountCreated = formatDateDisplay(currentUser?.createdAt);
  const subscriptionStarted = activeSubscriptionRecord?.createdAt
    ? formatDateDisplay(activeSubscriptionRecord.createdAt)
    : accountCreated;
  const subscriptionUpdated = activeSubscriptionRecord?.updatedAt
    ? formatDateDisplay(activeSubscriptionRecord.updatedAt)
    : 'Managed via Stripe';
  const customerName = activeSubscriptionRecord?.customerName || accountOwnerDisplay;
  const propertyDisplay = activeSubscriptionRecord?.propertyName || 'Workspace-wide access';
  const unitDisplay = activeSubscriptionRecord?.unitName
    ? activeSubscriptionRecord.unitName
    : activeSubscriptionRecord?.propertyName
      ? 'Entire property'
      : null;

  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth="lg">
        <Stack spacing={4}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              {hasActiveSubscription ? 'Your Subscription' : 'Get Started with BuildState FM'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {hasActiveSubscription
                ? 'Manage your subscription and billing details'
                : 'Unlock full access to manage your properties, units, and team'}
            </Typography>
          </Box>

          {/* Banners */}
          {showSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <strong>Payment successful!</strong> Your subscription is now active. Welcome to BuildState FM!
            </Alert>
          )}
          {showCanceled && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Checkout was canceled. No charges were made. You can subscribe anytime.
            </Alert>
          )}
          {showCancellationAlert && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You've cancelled your subscription. You'll retain access until{' '}
              <strong>{cancellationDateLabel}</strong>.
            </Alert>
          )}
          {checkoutMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {checkoutMutation.error?.response?.data?.message || checkoutMutation.error?.message || 'Checkout failed. Please try again.'}
            </Alert>
          )}

          {/* Subscription Summary Card */}
          <Card sx={{ borderRadius: 3, boxShadow: 1 }}>
            <CardContent>
              <Stack spacing={3}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={3}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Plan
                      </Typography>
                      <Typography variant="h6">
                        {formatEnumValue(subscriptionPlan, 'No active plan')}
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Status
                      </Typography>
                      <Chip
                        label={formatEnumValue(subscriptionStatus, 'Inactive')}
                        color={userHasActiveSubscription ? 'success' : isTrialActive ? 'warning' : 'default'}
                        variant={userHasActiveSubscription ? 'filled' : 'outlined'}
                      />
                    </Box>
                  </Stack>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: { xs: '100%', sm: 'auto' } }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={primaryCtaAction}
                      disabled={checkoutMutation.isPending}
                      sx={{ minWidth: 160 }} // Give button consistent width
                    >
                      {checkoutMutation.isPending ? 'Processing...' : primaryCtaLabel}
                    </Button>
                  </Box>
                </Stack>
                {/* Display trial status only if relevant */}
                {trialLabel && (
                  <Chip
                    label={trialLabel}
                    color={trialDaysRemaining > 0 ? 'warning' : 'default'}
                    variant={trialDaysRemaining > 0 ? 'filled' : 'outlined'}
                    sx={{ alignSelf: 'flex-start' }} // Position chip nicely
                  />
                )}
                {cancellationChipLabel && (
                  <Chip
                    label={cancellationChipLabel}
                    color={cancellationEnded ? 'default' : 'warning'}
                    variant={cancellationEnded ? 'outlined' : 'filled'}
                    sx={{ alignSelf: 'flex-start' }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Pricing Card - Show only if the user does NOT have an active subscription */}
          {!userHasActiveSubscription && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Card
                sx={{
                  maxWidth: 500, width: '100%', border: '2px solid',
                  borderColor: 'primary.main', boxShadow: 3, borderRadius: 3,
                  position: 'relative',
                  overflow: 'visible',
                }}
              >
                {/* Limited Time Discount Banner - Show when trial is ending soon or expired */}
                {(trialDaysRemaining <= 3 || !isTrialActive) && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1,
                    }}
                  >
                    <Chip
                      label="🔥 LIMITED TIME: 20% OFF FIRST MONTH"
                      sx={{
                        bgcolor: '#dc2626',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        px: 2,
                        py: 0.5,
                        height: 'auto',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                        '& .MuiChip-label': {
                          px: 1,
                        },
                      }}
                    />
                  </Box>
                )}
                <CardContent sx={{ p: 4, pt: trialDaysRemaining <= 3 || !isTrialActive ? 5 : 4 }}>
                  <Stack spacing={3}>
                    {/* Plan Header */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Chip
                        label="MOST POPULAR" color="primary" size="small"
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                        {planNameDisplay}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
                        {(trialDaysRemaining <= 3 || !isTrialActive) && (
                          <>
                            <Typography
                              variant="h4"
                              sx={{
                                fontWeight: 700,
                                color: 'text.disabled',
                                textDecoration: 'line-through',
                              }}
                            >
                              {planPriceValue || '$29'}
                            </Typography>
                            <Typography variant="h2" sx={{ fontWeight: 700, color: '#dc2626' }}>
                              {formatCurrency(Math.round((planDetails?.price || 29) * 0.8))}
                            </Typography>
                          </>
                        )}
                        {!(trialDaysRemaining <= 3 || !isTrialActive) && (
                          <Typography variant="h2" sx={{ fontWeight: 700 }}>
                            {planPriceValue || '$29'}
                          </Typography>
                        )}
                        <Typography variant="h6" color="text.secondary">/{planPriceInterval}</Typography>
                      </Box>
                      {(trialDaysRemaining <= 3 || !isTrialActive) && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#dc2626',
                            fontWeight: 600,
                            display: 'block',
                            mt: 1,
                          }}
                        >
                          First month only • Regular price applies after
                        </Typography>
                      )}
                    </Box>
                    <Divider />
                    {/* Features List */}
                    <List sx={{ py: 0 }}>
                      {planFeatures.map((feature) => (
                        <ListItem key={feature} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <CheckCircleIcon color="success" />
                          </ListItemIcon>
                          <ListItemText primary={feature} />
                        </ListItem>
                      ))}
                    </List>
                    <Button
                      variant="contained" size="large" fullWidth
                      onClick={() => startCheckout('STARTER')}
                      disabled={checkoutMutation.isPending}
                      sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 600, textTransform: 'none' }}
                    >
                      {checkoutMutation.isPending ? 'Processing...' : 'Subscribe Now'}
                    </Button>
                    <Typography
                      variant="caption" color="text.secondary"
                      sx={{ textAlign: 'center', display: 'block' }}
                    >
                      Secure payment powered by Stripe • Cancel anytime
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Subscription Details for active customers */}
          {hasActiveSubscription && (
            <Stack spacing={3}>
              <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 1 }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Subscription Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Keep track of your billing information, plan coverage, and key dates.
                    </Typography>
                  </Box>
                  <DataState
                    isLoading={query.isLoading}
                    isError={query.isError}
                    error={query.error}
                    isEmpty={!query.isLoading && !query.isError && !hasSubscriptionRecords && !currentUser}
                    onRetry={query.refetch}
                  >
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={2.5}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
                          >
                            Billing overview
                          </Typography>
                          <DetailRow
                            icon={<PaymentIcon fontSize="small" />}
                            label="Plan"
                            value={planNameDisplay}
                          />
                          <DetailRow
                            icon={<PaymentIcon fontSize="small" />}
                            label="Price"
                            value={planPricingLabel}
                          />
                          <DetailRow
                            icon={<AutorenewIcon fontSize="small" />}
                            label="Billing cycle"
                            value={billingCycleLabel}
                          />
                          <DetailRow
                            icon={<AutorenewIcon fontSize="small" />}
                            label="Status"
                            value={(
                              <Chip
                                label={formatEnumValue(subscriptionStatus, 'Inactive')}
                                color={userHasActiveSubscription ? 'success' : isTrialActive ? 'warning' : 'default'}
                                variant={userHasActiveSubscription ? 'filled' : 'outlined'}
                                size="small"
                              />
                            )}
                          />
                          <DetailRow
                            icon={<CalendarMonthIcon fontSize="small" />}
                            label={nextBillingRowLabel}
                            value={nextBillingLabel}
                          />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={2.5}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
                          >
                            Account & billing
                          </Typography>
                          <DetailRow
                            icon={<PersonIcon fontSize="small" />}
                            label="Account owner"
                            value={accountOwnerDisplay}
                          />
                          <DetailRow
                            icon={<EmailIcon fontSize="small" />}
                            label="Billing email"
                            value={billingEmail}
                          />
                          <DetailRow
                            icon={<PhoneIcon fontSize="small" />}
                            label="Phone"
                            value={billingPhone}
                          />
                          <DetailRow
                            icon={<CalendarMonthIcon fontSize="small" />}
                            label="Workspace created"
                            value={accountCreated}
                          />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={2.5}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
                          >
                            Subscription coverage
                          </Typography>
                          <DetailRow
                            icon={<BusinessIcon fontSize="small" />}
                            label="Customer"
                            value={customerName}
                          />
                          <DetailRow
                            icon={<ApartmentIcon fontSize="small" />}
                            label="Property"
                            value={propertyDisplay}
                          />
                          {unitDisplay ? (
                            <DetailRow
                              icon={<MeetingRoomIcon fontSize="small" />}
                              label="Unit"
                              value={unitDisplay}
                            />
                          ) : null}
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={2.5}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
                          >
                            Activity
                          </Typography>
                          <DetailRow
                            icon={<CalendarMonthIcon fontSize="small" />}
                            label="Started on"
                            value={subscriptionStarted}
                          />
                          <DetailRow
                            icon={<UpdateIcon fontSize="small" />}
                            label="Last updated"
                            value={subscriptionUpdated}
                          />
                        </Stack>
                      </Grid>
                    </Grid>
                  </DataState>
                </Stack>
              </Paper>

              {planFeatures.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 1 }}>
                  <Stack spacing={2}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      What's included in your plan
                    </Typography>
                    {planDescription && (
                      <Typography variant="body2" color="text.secondary">
                        {planDescription}
                      </Typography>
                    )}
                    <List sx={{ py: 0 }}>
                      {planFeatures.map((feature) => (
                        <ListItem key={feature} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <CheckCircleIcon color="success" />
                          </ListItemIcon>
                          <ListItemText primary={feature} />
                        </ListItem>
                      ))}
                    </List>
                  </Stack>
                </Paper>
              )}

              {/* Invoice History Section */}
              <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 1 }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
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

              {/* Billing Management Actions */}
              <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 1 }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                      Billing Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Update your payment method or cancel your subscription
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Stack spacing={2}>
                            <CreditCardIcon color="primary" sx={{ fontSize: 40 }} />
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Update Payment Method
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Change your credit card or payment information
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              startIcon={<CreditCardIcon />}
                              onClick={handleUpdatePaymentMethod}
                              disabled={updatePaymentMutation.isPending}
                              fullWidth
                            >
                              {updatePaymentMutation.isPending ? 'Processing...' : 'Update Payment'}
                            </Button>
                            {updatePaymentMutation.isError && (
                              <Alert severity="error" sx={{ mt: 1 }}>
                                {updatePaymentMutation.error?.response?.data?.message || updatePaymentMutation.error?.message || 'Failed to update payment method'}
                              </Alert>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined" sx={{ height: '100%', borderColor: 'error.light' }}>
                        <CardContent>
                          <Stack spacing={2}>
                            <CancelIcon color="error" sx={{ fontSize: 40 }} />
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Cancel Subscription
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Cancel your subscription at the end of the billing period
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => openCancelDialog(false)}
                              disabled={cancelMutation.isPending || isCancellationScheduled}
                              fullWidth
                            >
                              {isCancellationScheduled ? 'Already Scheduled' : 'Cancel Subscription'}
                            </Button>
                            {cancelMutation.isError && (
                              <Alert severity="error" sx={{ mt: 1 }}>
                                {cancelMutation.error?.response?.data?.message || cancelMutation.error?.message || 'Failed to cancel subscription'}
                              </Alert>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Stack>
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
                    Your subscription will be cancelled at the end of the current billing period. You'll continue to have access until {nextBillingLabel}.
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

          {/* FAQ or Additional Info Section */}
          {!userHasActiveSubscription && (
            <Paper sx={{ p: 3, bgcolor: 'grey.50', borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Why subscribe to BuildState FM?
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    🏢 Streamline Your Operations
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage all your properties, units, and team members from one unified platform.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    ✅ Stay Compliant
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Track inspections, maintenance plans, and generate reports for compliance and decision-making.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    👥 Collaborate Better
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Invite owners, tenants, and technicians to collaborate seamlessly on jobs and service requests.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Container>
    </Box>
  );
}