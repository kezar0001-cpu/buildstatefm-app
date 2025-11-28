import React from 'react';
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
  ListItemText
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
  PlayCircleOutline as PlayIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

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
    { label: 'Blog', path: '/blog' },
    { label: 'Admin', path: '/admin/blog/login' },
  ];

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1} component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'text.primary' }}>
            <Box sx={{ width: 40, height: 40, bgcolor: 'primary.main', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>
              B
            </Box>
            <Typography variant="h6" fontWeight="bold">
              Buildstate FM
            </Typography>
          </Stack>

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
                     <Button fullWidth variant="contained" color="primary" component={RouterLink} to="/signup">Get Started</Button>
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
                    sx={{ textDecoration: 'none', color: 'text.secondary', fontWeight: 500, '&:hover': { color: 'primary.main' } }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" color="primary" component={RouterLink} to="/signin" size="small">
                  Sign In
                </Button>
                <Button variant="contained" color="primary" component={RouterLink} to="/signup" size="small">
                  Get Started
                </Button>
              </Stack>
            </Stack>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

const Hero = () => (
  <Box sx={{ bgcolor: 'background.default', pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 8 }, overflow: 'hidden' }}>
    <Container maxWidth="lg">
      <Grid container spacing={6} alignItems="center">
        <Grid item xs={12} md={6}>
          <FadeIn>
            <Chip label="New: Inspection Workflows" color="secondary" size="small" sx={{ mb: 3, fontWeight: 600 }} />
            <Typography variant="h2" fontWeight={800} sx={{ mb: 2, background: 'linear-gradient(45deg, #b91c1c 30%, #f97316 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Property Management <br /> Built for Trust.
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
              Stop chasing paperwork. Start making decisions with immutable data, real-time audits, and a platform your team will actually love.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="contained" size="large" component={RouterLink} to="/signup" sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
                Start Free Trial
              </Button>
              <Button variant="outlined" size="large" component={RouterLink} to="/demo" sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
                View Demo
              </Button>
            </Stack>
            <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Stack direction="row" spacing={-1}>
                {[1, 2, 3, 4].map((i) => (
                  <Avatar key={i} src={`https://i.pravatar.cc/100?img=${i + 10}`} sx={{ border: '2px solid white' }} />
                ))}
              </Stack>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">Trusted by 500+ Managers</Typography>
                <Typography variant="caption" color="text.secondary">Across 10,000+ Units</Typography>
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
    <Box id="features" sx={{ py: 12, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={8}>
          <Typography variant="overline" color="primary" fontWeight="bold">Features</Typography>
          <Typography variant="h3" fontWeight={800} mb={2}>Everything you need to scale.</Typography>
          <Typography variant="h6" color="text.secondary" maxWidth={600} mx="auto">
            A complete operating system for modern property management.
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <FadeIn delay={index * 0.1}>
                <Card elevation={0} sx={{ height: '100%', bgcolor: 'background.default', '&:hover': { bgcolor: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }, transition: 'all 0.3s' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'primary.light', display: 'inline-flex', opacity: 0.15 }}>
                      {React.cloneElement(feature.icon, { sx: { color: 'primary.main' } })}
                    </Box>
                    <Box sx={{ mt: -7, mb: 2, ml: 1 }}>
                       {/* Re-render icon on top of the background box */}
                       {React.cloneElement(feature.icon, { sx: { color: 'primary.main' } })}
                    </Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>{feature.title}</Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{feature.description}</Typography>
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
    <Container maxWidth="lg">
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

const CTA = () => (
  <Box sx={{ py: 12, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
    <Container maxWidth="md">
      <FadeIn>
        <Typography variant="h3" fontWeight={800} mb={3}>
          Ready to transform your operations?
        </Typography>
        <Typography variant="h6" mb={5} sx={{ opacity: 0.9 }}>
          Join hundreds of property managers who have switched to Buildstate FM.
        </Typography>
        <Button
          variant="contained"
          size="large"
          component={RouterLink}
          to="/signup"
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            px: 6,
            py: 2,
            fontSize: '1.2rem',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          Get Started Now
        </Button>
      </FadeIn>
    </Container>
  </Box>
);

const Footer = () => (
  <Box sx={{ py: 8, bgcolor: '#1a1a1a', color: 'grey.400' }}>
    <Container maxWidth="lg">
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Typography variant="h6" color="white" gutterBottom fontWeight="bold">Buildstate FM</Typography>
          <Typography variant="body2" mb={2}>
            The modern operating system for property management. Built for trust, speed, and compliance.
          </Typography>
        </Grid>
        <Grid item xs={6} md={2}>
          <Typography variant="subtitle2" color="white" gutterBottom>Product</Typography>
          <Stack spacing={1}>
            <Typography variant="body2" component={RouterLink} to="/features" sx={{ color: 'inherit', textDecoration: 'none' }}>Features</Typography>
            <Typography variant="body2" component={RouterLink} to="/pricing" sx={{ color: 'inherit', textDecoration: 'none' }}>Pricing</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} md={2}>
          <Typography variant="subtitle2" color="white" gutterBottom>Company</Typography>
          <Stack spacing={1}>
            <Typography variant="body2" component={RouterLink} to="/about" sx={{ color: 'inherit', textDecoration: 'none' }}>About</Typography>
            <Typography variant="body2" component={RouterLink} to="/blog" sx={{ color: 'inherit', textDecoration: 'none' }}>Blog</Typography>
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" color="white" gutterBottom>Admin</Typography>
          <Button variant="outlined" size="small" color="inherit" component={RouterLink} to="/admin/blog/login">
            Admin Login
          </Button>
        </Grid>
      </Grid>
      <Box mt={8} pt={4} borderTop="1px solid #333" textAlign="center">
        <Typography variant="body2">
          © {new Date().getFullYear()} Buildstate FM. All rights reserved.
        </Typography>
      </Box>
    </Container>
  </Box>
);

const LandingPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Hero />
      <Features />
      <ImageShowcase />
      <CTA />
      <Footer />
    </Box>
  );
};

export default LandingPage;
