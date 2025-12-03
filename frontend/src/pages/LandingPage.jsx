import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  AppBar,
  Toolbar,
  useTheme,
  useMediaQuery,
  Avatar,
  Paper,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Tab,
  Tabs,
  Rating,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Menu as MenuIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  CloudSync as CloudSyncIcon,
  Devices as DevicesIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  PlayCircleOutline as PlayIcon,
  Home as HomeIcon,
  ArrowForward as ArrowForwardIcon,
  Star as StarIcon,
  People as PeopleIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import GradientButton from '../components/GradientButton';

// --- Styled Components & Animations ---

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

const VideoPlaceholder = () => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      paddingTop: '56.25%', // 16:9 aspect ratio
      backgroundColor: '#000',
      borderRadius: 4,
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      mb: 6,
      cursor: 'pointer',
      '&:hover .play-button': {
        transform: 'translate(-50%, -50%) scale(1.1)',
      }
    }}
  >
    <Box
      component="img"
      src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
      alt="App Demo"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.6,
      }}
    />
    <Box
      className="play-button"
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'transform 0.3s ease',
        color: 'white',
      }}
    >
      <PlayIcon sx={{ fontSize: 80, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }} />
    </Box>
  </Box>
);

// --- Components ---

const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const navLinks = [
    { label: 'Features', path: '#features' },
    { label: 'How It Works', path: '#how-it-works' },
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
                    component={link.path.startsWith('#') ? 'a' : RouterLink}
                    to={link.path.startsWith('#') ? undefined : link.path}
                    href={link.path.startsWith('#') ? link.path : undefined}
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

const Hero = () => (
  <Box
    sx={{
      background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)',
      pt: { xs: 8, md: 12 },
      pb: { xs: 8, md: 12 },
      overflow: 'hidden',
      position: 'relative'
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

    <Container maxWidth="lg" sx={{ maxWidth: 1240, position: 'relative' }}>
      <Grid container spacing={6} alignItems="center">
        <Grid item xs={12} md={6}>
          <FadeIn>
            <Chip
              icon={<AutoAwesomeIcon />}
              label="New: AI-Powered Inspection Workflows"
              color="secondary"
              sx={{
                mb: 3,
                fontWeight: 600,
                px: 1,
                background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                color: 'white'
              }}
            />
            <Typography
              variant="h1"
              fontWeight={800}
              sx={{
                mb: 3,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Property Management Built for Trust
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{
                mb: 5,
                lineHeight: 1.7,
                fontWeight: 400,
                fontSize: { xs: '1.1rem', md: '1.3rem' }
              }}
            >
              Stop chasing paperwork. Start making data-driven decisions with immutable audit trails,
              real-time sync, and a platform your entire team will love.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 5 }}>
              <GradientButton
                size="large"
                component={RouterLink}
                to="/signup"
                endIcon={<ArrowForwardIcon />}
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
              >
                Start Free Trial
              </GradientButton>
              <Button
                variant="outlined"
                size="large"
                component="a"
                href="#how-it-works"
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderWidth: 2,
                  borderRadius: 2,
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: 'primary.dark',
                    bgcolor: 'rgba(185, 28, 28, 0.04)'
                  }
                }}
              >
                See How It Works
              </Button>
            </Stack>
            <Box sx={{ mt: 5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Stack direction="row" spacing={-1}>
                {[11, 12, 13, 14, 15].map((i) => (
                  <Avatar
                    key={i}
                    src={`https://i.pravatar.cc/100?img=${i}`}
                    sx={{
                      border: '3px solid white',
                      width: 48,
                      height: 48
                    }}
                  />
                ))}
              </Stack>
              <Box>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <Rating value={5} size="small" readOnly />
                  <Typography variant="caption" fontWeight="bold">5.0</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  Trusted by 500+ Property Managers
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Managing 10,000+ units worldwide
                </Typography>
              </Box>
            </Box>
          </FadeIn>
        </Grid>
        <Grid item xs={12} md={6}>
          <FadeIn delay={0.2}>
            <VideoPlaceholder />
          </FadeIn>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

// Workflow demonstration component
const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      label: 'Add Your Properties',
      icon: <HomeIcon />,
      title: 'Set Up Your Portfolio in Minutes',
      description: 'Import properties and units with our simple onboarding wizard. Add all essential details, amenities, and documentation in one centralized location.',
      features: ['Bulk property import', 'Unit-level tracking', 'Document management', 'Custom fields & tags']
    },
    {
      label: 'Schedule Inspections',
      icon: <AssignmentIcon />,
      title: 'Create Smart Inspection Workflows',
      description: 'Design custom checklists, assign inspections to technicians, and track completion status in real-time with photo evidence and digital signatures.',
      features: ['Custom checklists', 'Photo documentation', 'Digital signatures', 'Automated scheduling']
    },
    {
      label: 'Track Maintenance',
      icon: <BuildIcon />,
      title: 'Manage Jobs from Start to Finish',
      description: 'From service requests to work orders, track every maintenance job with cost estimates, vendor assignments, and completion verification.',
      features: ['Service request portal', 'Vendor management', 'Cost tracking', 'Priority levels']
    },
    {
      label: 'Analyze & Optimize',
      icon: <TrendingUpIcon />,
      title: 'Make Data-Driven Decisions',
      description: 'Access real-time analytics, generate compliance reports, and identify optimization opportunities across your entire portfolio.',
      features: ['Real-time dashboards', 'Compliance reports', 'Cost analysis', 'Performance metrics']
    }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box id="how-it-works" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              fontSize: '0.875rem'
            }}
          >
            HOW IT WORKS
          </Typography>
          <Typography variant="h3" fontWeight={800} mb={2} mt={1}>
            From Setup to Success in 4 Steps
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth={700}
            mx="auto"
            sx={{ lineHeight: 1.7, fontWeight: 400 }}
          >
            BuildState FM streamlines your entire property management workflow.
            Here's how you'll transform your operations.
          </Typography>
        </Box>

        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label} expanded>
                  <StepLabel
                    onClick={() => setActiveStep(index)}
                    sx={{ cursor: 'pointer' }}
                    StepIconProps={{
                      sx: {
                        fontSize: '2rem',
                        '&.Mui-active': {
                          color: 'primary.main',
                          transform: 'scale(1.2)'
                        },
                        '&.Mui-completed': {
                          color: 'secondary.main'
                        }
                      }
                    }}
                  >
                    <Typography variant="h6" fontWeight={700}>
                      {step.label}
                    </Typography>
                  </StepLabel>
                  <AnimatePresence mode="wait">
                    {activeStep === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Box sx={{ pl: 4, pr: 2, pb: 3 }}>
                          <Typography variant="body1" color="text.secondary" paragraph>
                            {step.description}
                          </Typography>
                          <Stack spacing={1}>
                            {step.features.map((feature) => (
                              <Stack key={feature} direction="row" spacing={1} alignItems="center">
                                <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {feature}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Step>
              ))}
            </Stepper>
          </Grid>

          <Grid item xs={12} md={6}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <Card
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)'
                  }}
                >
                  <Box
                    sx={{
                      p: 4,
                      background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {React.cloneElement(steps[activeStep].icon, { sx: { fontSize: 36 } })}
                    </Box>
                    <Typography variant="h5" fontWeight={700}>
                      {steps[activeStep].title}
                    </Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    {/* Placeholder for screenshot/mockup */}
                    <Box
                      sx={{
                        width: '100%',
                        height: 300,
                        bgcolor: '#f5f5f5',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed',
                        borderColor: 'divider',
                        backgroundImage: 'url(https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(185, 28, 28, 0.9)',
                          backdropFilter: 'blur(4px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white'
                        }}
                      >
                        <Stack alignItems="center" spacing={1}>
                          {React.cloneElement(steps[activeStep].icon, { sx: { fontSize: 48 } })}
                          <Typography variant="h6" fontWeight={600}>
                            {steps[activeStep].label}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            Interactive Demo Coming Soon
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </Grid>
        </Grid>

        <Box textAlign="center" mt={8}>
          <GradientButton
            size="large"
            component={RouterLink}
            to="/signup"
            endIcon={<ArrowForwardIcon />}
            sx={{ px: 5, py: 2, fontSize: '1.1rem' }}
          >
            Start Your Free Trial
          </GradientButton>
          <Typography variant="body2" color="text.secondary" mt={2}>
            No credit card required • Full access for 14 days
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

const Features = () => {
  const features = [
    { icon: <AssignmentIcon fontSize="large" color="primary" />, title: 'Smart Inspections', description: 'Customizable checklists, photo evidence, and instant report generation.' },
    { icon: <BuildIcon fontSize="large" color="primary" />, title: 'Maintenance Tracking', description: 'End-to-end job management from request to completion with cost tracking.' },
    { icon: <CloudSyncIcon fontSize="large" color="primary" />, title: 'Real-Time Sync', description: 'Instant updates across all devices. Never work with stale data again.' },
    { icon: <SecurityIcon fontSize="large" color="primary" />, title: 'Audit Trails', description: 'Every action is logged. immutable history for zero compliance risk.' },
    { icon: <DevicesIcon fontSize="large" color="primary" />, title: 'Mobile First', description: 'Native-feel experience for technicians in the field.' },
    { icon: <TrendingUpIcon fontSize="large" color="primary" />, title: 'Analytics', description: 'Deep insights into property performance and maintenance costs.' },
  ];

  return (
    <Box id="features" sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              fontSize: '0.875rem'
            }}
          >
            FEATURES
          </Typography>
          <Typography variant="h3" fontWeight={800} mb={2} mt={1}>
            Everything You Need to Scale
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth={700}
            mx="auto"
            sx={{ lineHeight: 1.7, fontWeight: 400 }}
          >
            A complete operating system for modern property management teams.
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <FadeIn delay={index * 0.1}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(185, 28, 28, 0.1)',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        mb: 3,
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        transition: 'transform 0.3s',
                        '&:hover': {
                          transform: 'rotate(5deg) scale(1.05)'
                        }
                      }}
                    >
                      {React.cloneElement(feature.icon, { sx: { fontSize: 32, color: 'white' } })}
                    </Box>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </FadeIn>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

const ImageShowcase = () => (
  <Box sx={{ py: 12, bgcolor: 'background.default' }}>
    <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
      <Grid container spacing={8} alignItems="center">
        <Grid item xs={12} md={6}>
          <FadeIn>
            <Box
              component="img"
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              alt="Dashboard Analytics"
              sx={{ width: '100%', borderRadius: 4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            />
          </FadeIn>
        </Grid>
        <Grid item xs={12} md={6}>
          <FadeIn delay={0.2}>
            <Typography variant="h4" fontWeight={800} mb={3}>
              Data-Driven Decisions
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={4} fontSize="1.1rem">
              Visualize your portfolio's health at a glance. Track occupancy rates, maintenance costs, and inspection compliance in real-time.
            </Typography>
            <List>
              {['Instant Financial Reports', 'Occupancy Tracking', 'Maintenance Cost Analysis'].map((item) => (
                <ListItem key={item} disableGutters>
                  <CheckCircleIcon color="primary" sx={{ mr: 2 }} />
                  <ListItemText primary={item} primaryTypographyProps={{ fontWeight: 500 }} />
                </ListItem>
              ))}
            </List>
          </FadeIn>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

// Testimonials section
const Testimonials = () => {
  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Property Manager',
      company: 'Urban Living Properties',
      avatar: 'https://i.pravatar.cc/100?img=25',
      rating: 5,
      text: 'BuildState FM has completely transformed how we manage our portfolio. The inspection workflows alone have saved us 15+ hours per week.'
    },
    {
      name: 'James Rodriguez',
      role: 'Facilities Director',
      company: 'Apex Real Estate Group',
      avatar: 'https://i.pravatar.cc/100?img=33',
      rating: 5,
      text: 'The audit trail feature gives us complete peace of mind during compliance reviews. We can track every action, every time. It\'s a game changer.'
    },
    {
      name: 'Emily Chen',
      role: 'Operations Manager',
      company: 'Gateway Residential',
      avatar: 'https://i.pravatar.cc/100?img=45',
      rating: 5,
      text: 'Our maintenance costs dropped by 23% in the first quarter after implementing BuildState FM. The analytics help us spot issues before they become expensive problems.'
    }
  ];

  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              fontSize: '0.875rem'
            }}
          >
            TESTIMONIALS
          </Typography>
          <Typography variant="h3" fontWeight={800} mb={2} mt={1}>
            Trusted by Industry Leaders
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth={700}
            mx="auto"
            sx={{ lineHeight: 1.7, fontWeight: 400 }}
          >
            See what property management professionals are saying about BuildState FM.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {testimonials.map((testimonial, index) => (
            <Grid item xs={12} md={4} key={index}>
              <FadeIn delay={index * 0.1}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    p: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(185, 28, 28, 0.08)'
                    }
                  }}
                >
                  <Rating value={testimonial.rating} readOnly sx={{ mb: 2 }} />
                  <Typography
                    variant="body1"
                    sx={{
                      mb: 3,
                      lineHeight: 1.8,
                      fontStyle: 'italic',
                      color: 'text.secondary'
                    }}
                  >
                    "{testimonial.text}"
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={testimonial.avatar}
                      sx={{
                        width: 56,
                        height: 56,
                        border: '2px solid',
                        borderColor: 'primary.main'
                      }}
                    />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {testimonial.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {testimonial.role}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={600}>
                        {testimonial.company}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </FadeIn>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

const CTA = () => (
  <Box
    sx={{
      py: { xs: 8, md: 12 },
      background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
      color: 'white',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    {/* Decorative elements */}
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
    <Box
      sx={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.05)',
        pointerEvents: 'none'
      }}
    />

    <Container maxWidth="md" sx={{ position: 'relative' }}>
      <FadeIn>
        <Typography variant="h2" fontWeight={800} mb={3} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
          Ready to Transform Your Operations?
        </Typography>
        <Typography variant="h5" mb={6} sx={{ opacity: 0.95, fontWeight: 400 }}>
          Join hundreds of property managers who have switched to BuildState FM.
          Start your free 14-day trial today—no credit card required.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          alignItems="center"
        >
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/signup"
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
            Start Free Trial
          </Button>
          <Button
            variant="outlined"
            size="large"
            component={RouterLink}
            to="/signin"
            sx={{
              borderColor: 'white',
              color: 'white',
              px: 5,
              py: 2,
              fontSize: '1.2rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            Sign In
          </Button>
        </Stack>
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon />
            <Typography variant="body2">14-day free trial</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon />
            <Typography variant="body2">No credit card required</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon />
            <Typography variant="body2">Cancel anytime</Typography>
          </Stack>
        </Box>
      </FadeIn>
    </Container>
  </Box>
);

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
              href="#features"
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
              href="#how-it-works"
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
            <Typography
              variant="body2"
              component={RouterLink}
              to="/about"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              About
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
              <Typography
                variant="body2"
                component={RouterLink}
                to="/admin/blog/login"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { color: 'secondary.light' }
                }}
              >
                Admin
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Container>
  </Box>
);

const LandingPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <ImageShowcase />
      <Testimonials />
      <CTA />
      <Footer />
    </Box>
  );
};

export default LandingPage;
