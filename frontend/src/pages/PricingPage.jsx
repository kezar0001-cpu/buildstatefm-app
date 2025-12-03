import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
  Paper,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import BusinessIcon from '@mui/icons-material/Business';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useCurrentUser } from '../context/UserContext.jsx';
import BlogPublicNav from '../components/BlogPublicNav';

const PRICING_TIERS = [
  {
    id: 'BASIC',
    name: 'Basic',
    price: 29,
    yearlyPrice: 290, // ~17% discount
    description: 'Perfect for individual property managers getting started',
    icon: RocketLaunchIcon,
    features: [
      { text: 'Up to 10 properties', included: true },
      { text: 'Unlimited units', included: true },
      { text: 'Basic inspections', included: true },
      { text: 'Job management', included: true },
      { text: 'Service requests', included: true },
      { text: '1 property manager', included: true },
      { text: 'Email support', included: true },
      { text: 'Mobile access', included: true },
      { text: 'Maintenance plans & scheduling', included: false },
      { text: 'Analytics dashboard', included: false },
      { text: 'Recurring inspections', included: false },
      { text: 'Custom inspection templates', included: false },
      { text: 'API access', included: false },
    ],
    highlighted: false,
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: 79,
    yearlyPrice: 790, // ~17% discount
    description: 'For growing teams managing multiple properties',
    icon: StarIcon,
    features: [
      { text: 'Up to 50 properties', included: true },
      { text: 'Unlimited units', included: true },
      { text: 'Advanced inspections with templates', included: true },
      { text: 'Job management', included: true },
      { text: 'Service requests', included: true },
      { text: 'Up to 5 team members', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Mobile access', included: true },
      { text: 'Maintenance plans & scheduling', included: true },
      { text: 'Analytics dashboard', included: true },
      { text: 'Recurring inspections', included: true },
      { text: 'Technician & owner invites', included: true },
      { text: 'Custom inspection templates', included: false },
      { text: 'Audit trails & compliance', included: false },
      { text: 'API access', included: false },
      { text: 'Custom integrations', included: false },
    ],
    highlighted: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 149,
    yearlyPrice: 1490, // ~17% discount
    description: 'For large organizations with complex needs',
    icon: BusinessIcon,
    features: [
      { text: 'Unlimited properties', included: true },
      { text: 'Unlimited units', included: true },
      { text: 'Advanced inspections with templates', included: true },
      { text: 'Job management', included: true },
      { text: 'Service requests', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'Mobile access', included: true },
      { text: 'Maintenance plans & scheduling', included: true },
      { text: 'Advanced analytics & reporting', included: true },
      { text: 'Custom inspection templates', included: true },
      { text: 'Audit trails & compliance', included: true },
      { text: 'API access', included: true },
      { text: 'Custom integrations', included: true },
    ],
    highlighted: false,
  },
];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

function PricingCard({ tier, billingCycle, onSelectPlan, isAuthenticated }) {
  const Icon = tier.icon;
  const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.price;
  const monthlyEquivalent = billingCycle === 'yearly' ? tier.yearlyPrice / 12 : tier.price;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: tier.highlighted ? '2px solid' : '1px solid',
        borderColor: tier.highlighted ? 'primary.main' : 'divider',
        boxShadow: tier.highlighted ? 6 : 1,
        transform: tier.highlighted ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: tier.highlighted ? 8 : 3,
          transform: tier.highlighted ? 'scale(1.06)' : 'scale(1.02)',
        },
      }}
    >
      {tier.highlighted && (
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
            label="MOST POPULAR"
            color="primary"
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              px: 2,
              boxShadow: 2,
            }}
          />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3, pt: tier.highlighted ? 4 : 3 }}>
        <Stack spacing={3} sx={{ flexGrow: 1 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Icon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {tier.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
              {tier.description}
            </Typography>
          </Box>

          {/* Pricing */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {formatCurrency(monthlyEquivalent)}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                /month
              </Typography>
            </Box>
            {billingCycle === 'yearly' && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Billed as {formatCurrency(price)}/year
                </Typography>
                <Chip
                  label="Save 17%"
                  color="success"
                  size="small"
                  sx={{ mt: 1, fontWeight: 600 }}
                />
              </>
            )}
            {billingCycle === 'monthly' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Billed monthly
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Features */}
          <List dense sx={{ py: 0 }}>
            {tier.features.map((feature, index) => (
              <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {feature.included ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <CloseIcon color="disabled" fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={feature.text}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: feature.included ? 'text.primary' : 'text.disabled',
                  }}
                />
              </ListItem>
            ))}
          </List>

          {/* CTA Button */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Button
              variant={tier.highlighted ? 'contained' : 'outlined'}
              color="primary"
              size="large"
              fullWidth
              onClick={() => onSelectPlan(tier.id)}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              {isAuthenticated ? 'Upgrade Now' : 'Start Free Trial'}
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', display: 'block', mt: 1 }}
            >
              14-day free trial • No credit card required
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [billingCycle, setBillingCycle] = useState('monthly');

  const handleBillingCycleChange = (event, newCycle) => {
    if (newCycle !== null) {
      setBillingCycle(newCycle);
    }
  };

  const handleSelectPlan = (planId) => {
    if (user) {
      // User is authenticated, redirect to subscriptions page with checkout
      navigate(`/subscriptions?plan=${planId}`);
    } else {
      // User is not authenticated, redirect to signup with plan selection
      navigate(`/signup?plan=${planId}`);
    }
  };

  return (
    <>
      <BlogPublicNav />
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #fff7f7 0%, #ffffff 60%)',
          py: 8,
        }}
      >
        <Container maxWidth="lg" sx={{ maxWidth: 1240, px: { xs: 2, sm: 3, md: 4 } }}>
        <Stack spacing={{ xs: 4, sm: 5, md: 6 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 600, letterSpacing: 1.5 }}
            >
              Pricing
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, mt: 1 }}>
              Choose Your Plan
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
              Start with a 14-day free trial. No credit card required. Cancel anytime.
            </Typography>
          </Box>

          {/* Billing Cycle Toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup
              value={billingCycle}
              exclusive
              onChange={handleBillingCycleChange}
              aria-label="billing cycle"
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 1,
                '& .MuiToggleButton-root': {
                  px: 3,
                  py: 1,
                  border: 'none',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="monthly">Monthly</ToggleButton>
              <ToggleButton value="yearly">
                Yearly
                <Chip
                  label="Save 17%"
                  size="small"
                  color="success"
                  sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Pricing Cards */}
          <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} alignItems="stretch">
            {PRICING_TIERS.map((tier) => (
              <Grid item xs={12} sm={12} md={4} key={tier.id}>
                <PricingCard
                  tier={tier}
                  billingCycle={billingCycle}
                  onSelectPlan={handleSelectPlan}
                  isAuthenticated={!!user}
                />
              </Grid>
            ))}
          </Grid>

          {/* FAQ Section */}
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, bgcolor: 'grey.50', borderRadius: 3, mt: { xs: 4, md: 6 } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
              Frequently Asked Questions
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Do I need a credit card for the free trial?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No! You can start your 14-day free trial without entering any payment information. You'll only need to add a payment method when you're ready to subscribe.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Can I change plans later?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    What happens after my trial ends?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    After your 14-day trial, you'll need to select a paid plan to continue using BuildState FM. Your data will be preserved, and you can subscribe whenever you're ready.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Can I cancel anytime?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Absolutely! You can cancel your subscription at any time. You'll retain access until the end of your billing period.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Is my data secure?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Yes! We use bank-level encryption and security measures to protect your data. All payments are processed securely through Stripe.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Do you offer custom plans?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Yes! If you have specific requirements or manage a large portfolio, contact our sales team for a custom Enterprise plan tailored to your needs.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* CTA Section */}
          <Paper
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              textAlign: 'center',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: 'white',
              borderRadius: 3,
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
              Ready to get started?
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, opacity: 0.9, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              Join 500+ property managers managing 10,000+ units worldwide
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate(user ? '/subscriptions' : '/signup')}
              sx={{
                bgcolor: 'white',
                color: '#dc2626',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: 'grey.100',
                },
              }}
            >
              {user ? 'View Plans' : 'Start Free Trial'}
            </Button>
          </Paper>
        </Stack>
      </Container>
    </Box>
    </>
  );
}
