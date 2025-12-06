import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  AppBar,
  Toolbar,
  useTheme,
  useMediaQuery,
  IconButton,
  Drawer,
  ListItemButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import BusinessIcon from '@mui/icons-material/Business';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { motion } from 'framer-motion';
import { useCurrentUser } from '../context/UserContext.jsx';
import GradientButton from '../components/GradientButton';

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

// FadeIn animation component
const FadeIn = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
  >
    {children}
  </motion.div>
);

// Navbar component matching landing page
const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const navLinks = [
    { label: 'Features', path: '/#features' },
    { label: 'How It Works', path: '/#how-it-works' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Blog', path: '/blog' },
  ];

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255, 245, 245, 0.85)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 0 } }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
          >
            BuildState FM
          </Typography>

          {isMobile ? (
            <>
              <IconButton onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
              <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <List sx={{ width: 250 }}>
                  {navLinks.map((link) => (
                    <ListItem key={link.label} disablePadding>
                      <ListItemButton component={RouterLink} to={link.path} onClick={() => setDrawerOpen(false)}>
                        <ListItemText primary={link.label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  <ListItem disablePadding>
                    <ListItemButton component={RouterLink} to="/signin" onClick={() => setDrawerOpen(false)}>
                      <ListItemText primary="Sign In" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem sx={{ mt: 2 }}>
                    <GradientButton fullWidth component={RouterLink} to="/signup">
                      Get Started Free
                    </GradientButton>
                  </ListItem>
                </List>
              </Drawer>
            </>
          ) : (
            <Stack direction="row" alignItems="center" spacing={4}>
              <Stack direction="row" spacing={3}>
                {navLinks.map((link) => (
                  <Typography
                    key={link.label}
                    component={RouterLink}
                    to={link.path}
                    variant="body2"
                    sx={{
                      textDecoration: 'none',
                      color: 'text.secondary',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  color="primary"
                  component={RouterLink}
                  to="/signin"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2.5
                  }}
                >
                  Sign In
                </Button>
                <GradientButton component={RouterLink} to="/signup">
                  Get Started Free
                </GradientButton>
              </Stack>
            </Stack>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

// Footer component matching landing page
const Footer = () => (
  <Box sx={{ py: 8, bgcolor: '#1a1a1a', color: 'grey.400' }}>
    <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Typography
            variant="h6"
            gutterBottom
            fontWeight={800}
            sx={{
              background: 'linear-gradient(135deg, #f87171 0%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2
            }}
          >
            BuildState FM
          </Typography>
          <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
            The modern operating system for property management. Built for trust, speed, and compliance.
          </Typography>
          <Stack direction="row" spacing={1} mt={3}>
            <Chip
              label="Trusted"
              size="small"
              sx={{ bgcolor: 'rgba(185, 28, 28, 0.2)', color: 'white', fontWeight: 600 }}
            />
            <Chip
              label="Secure"
              size="small"
              sx={{ bgcolor: 'rgba(249, 115, 22, 0.2)', color: 'white', fontWeight: 600 }}
            />
          </Stack>
        </Grid>
        <Grid item xs={6} md={2}>
          <Typography variant="subtitle2" color="white" gutterBottom fontWeight={700}>
            Product
          </Typography>
          <Stack spacing={1.5} mt={2}>
            <Typography
              variant="body2"
              component="a"
              href="/#features"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              Features
            </Typography>
            <Typography
              variant="body2"
              component="a"
              href="/#how-it-works"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              How It Works
            </Typography>
            <Typography
              variant="body2"
              component={RouterLink}
              to="/pricing"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              Pricing
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} md={2}>
          <Typography variant="subtitle2" color="white" gutterBottom fontWeight={700}>
            Company
          </Typography>
          <Stack spacing={1.5} mt={2}>
            <Typography
              variant="body2"
              component={RouterLink}
              to="/blog"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              Blog
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" color="white" gutterBottom fontWeight={700}>
            Get Started
          </Typography>
          <Typography variant="body2" mb={2} mt={2} sx={{ lineHeight: 1.7 }}>
            Start your free 14-day trial today. No credit card required.
          </Typography>
          <GradientButton
            size="small"
            component={RouterLink}
            to="/signup"
            sx={{ mt: 1 }}
          >
            Sign Up Free
          </GradientButton>
        </Grid>
      </Grid>
      <Box mt={8} pt={4} borderTop="1px solid #333">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="body2" textAlign={{ xs: 'center', md: 'left' }}>
              © {new Date().getFullYear()} BuildState FM. All rights reserved.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack
              direction="row"
              spacing={2}
              justifyContent={{ xs: 'center', md: 'flex-end' }}
            >
              <Typography
                variant="body2"
                component={RouterLink}
                to="/privacy"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.light' }
                }}
              >
                Privacy
              </Typography>
              <Typography
                variant="body2"
                component={RouterLink}
                to="/terms"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.light' }
                }}
              >
                Terms
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Container>
  </Box>
);

function PricingCard({ tier, onSelectPlan, isAuthenticated }) {
  const Icon = tier.icon;
  const price = tier.price;

  return (
    <FadeIn delay={tier.highlighted ? 0.2 : 0.1}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: tier.highlighted ? '2px solid' : '1px solid',
          borderColor: tier.highlighted ? 'primary.main' : 'divider',
          boxShadow: tier.highlighted ? 6 : 1,
          borderRadius: 3,
          bgcolor: 'white',
          overflow: 'visible',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: tier.highlighted ? 8 : 3,
            transform: 'translateY(-4px)',
            borderColor: tier.highlighted ? 'primary.main' : 'primary.light',
          },
        }}
      >
      {tier.highlighted && (
        <Box
          sx={{
            position: 'absolute',
            top: -16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
          }}
        >
          <Chip
            label="MOST POPULAR"
            color="primary"
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              px: 2,
              py: 0.5,
              boxShadow: 2,
            }}
          />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 4, pt: tier.highlighted ? 6 : 4 }}>
        <Stack spacing={3} sx={{ flexGrow: 1 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                mb: 2,
                width: 64,
                height: 64,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                mx: 'auto',
                transition: 'transform 0.3s',
                '&:hover': {
                  transform: 'rotate(5deg) scale(1.05)'
                }
              }}
            >
              <Icon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {tier.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, lineHeight: 1.7 }}>
              {tier.description}
            </Typography>
          </Box>

          {/* Pricing */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {formatCurrency(price)}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                /month
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Billed monthly
            </Typography>
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
            {tier.highlighted ? (
              <GradientButton
                size="large"
                fullWidth
                onClick={() => onSelectPlan(tier.id)}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                {isAuthenticated ? 'Start Trial Today' : 'Start Free Trial'}
              </GradientButton>
            ) : (
              <Button
                variant="outlined"
                color="primary"
                size="large"
                fullWidth
                onClick={() => onSelectPlan(tier.id)}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderWidth: 2,
                  borderRadius: 2,
                  '&:hover': {
                    borderWidth: 2,
                    bgcolor: 'rgba(185, 28, 28, 0.04)'
                  }
                }}
              >
                {isAuthenticated ? 'Start Trial Today' : 'Start Free Trial'}
              </Button>
            )}
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
    </FadeIn>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();

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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Box
        sx={{
          flex: 1,
          background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative gradient blobs */}
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -100,
            left: -100,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(185, 28, 28, 0.08) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />

        <Container maxWidth="lg" sx={{ maxWidth: 1240, px: { xs: 2, sm: 3, md: 4 }, position: 'relative' }}>
        <Stack spacing={{ xs: 4, sm: 5, md: 6 }}>
          {/* Header */}
          <FadeIn>
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="overline"
                sx={{
                  color: 'primary.main',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  fontSize: '0.875rem'
                }}
              >
                PRICING
              </Typography>
              <Typography 
                variant="h1" 
                sx={{ 
                  fontWeight: 800, 
                  mb: 2, 
                  mt: 1,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Choose Your Plan
              </Typography>
              <Typography 
                variant="h6" 
                color="text.secondary" 
                sx={{ 
                  maxWidth: 700, 
                  mx: 'auto',
                  lineHeight: 1.7,
                  fontWeight: 400,
                  fontSize: { xs: '1.1rem', md: '1.3rem' }
                }}
              >
                Start with a 14-day free trial. No credit card required. Cancel anytime.
              </Typography>
            </Box>
          </FadeIn>

          {/* Pricing Cards */}
          <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} alignItems="stretch" sx={{ pt: 2 }}>
            {PRICING_TIERS.map((tier) => (
              <Grid item xs={12} sm={12} md={4} key={tier.id}>
                <PricingCard
                  tier={tier}
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
          <FadeIn delay={0.3}>
            <Paper
              sx={{
                p: { xs: 3, sm: 4, md: 5 },
                textAlign: 'center',
                background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                color: 'white',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 300,
                  height: 300,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  pointerEvents: 'none'
                }}
              />
              <Box sx={{ position: 'relative' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
                  Ready to get started?
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, opacity: 0.95, fontSize: { xs: '0.9rem', sm: '1rem' }, fontWeight: 400 }}>
                  Join 500+ property managers managing 10,000+ units worldwide
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate(user ? '/subscriptions' : '/signup')}
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    px: 5,
                    py: 2,
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                    '&:hover': {
                      bgcolor: 'grey.100',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 24px rgba(0, 0, 0, 0.25)'
                    },
                    transition: 'all 0.2s'
                  }}
                >
                  {user ? 'View Plans' : 'Start Free Trial'}
                </Button>
              </Box>
            </Paper>
          </FadeIn>
        </Stack>
      </Container>
    </Box>
    <Footer />
    </Box>
  );
}
