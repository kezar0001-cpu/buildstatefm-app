import React from 'react';
import { Box, Container, Typography, Button, styled } from '@mui/material';

// Custom styled components for better structure and potential theming
const HeroSection = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(12, 0),
  textAlign: 'center',
}));

const ContentSection = styled(Container)(({ theme }) => ({
  padding: theme.spacing(8, 0),
}));

const CallToAction = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  padding: theme.spacing(10, 0),
  textAlign: 'center',
}));

const LandingPage = () => {
  return (
    <Box>
      {/* Hero Section */}
      <HeroSection>
        <Container maxWidth="md">
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Stop Chasing Paperwork. Start Making Decisions with Audited, Real-Time Data.
          </Typography>
          <Typography variant="h5" component="p" sx={{ mb: 4 }}>
            Buildstate FM is the only platform that gives you an immutable, second-by-second audit trail of every inspection, job, and service request, so you can operate with 100% confidence and zero compliance risk.
          </Typography>
          <Button variant="contained" color="secondary" size="large">
            Start Your Free Trial
          </Button>
          <Typography variant="body1" sx={{ mt: 2 }}>
            Get control over your portfolio today.
          </Typography>
        </Container>
      </HeroSection>

      {/* Core Technical Benefits Section */}
      <ContentSection maxWidth="md">
        <Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 6, fontWeight: 'bold' }}>
          Why Buildstate FM is Better
        </Typography>

        <Box sx={{ mb: 8 }}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
            Comprehensive, Verifiable Audit Trails
          </Typography>
          <Typography variant="body1" paragraph>
            Your operations are complex, but your data doesn't have to be. We built Buildstate FM on a foundation of verifiable trust. Our database doesn't just track changes; it creates a permanent, time-stamped audit log for every critical action. When a dispute arises over a completed job or an inspection finding, you have a cryptographically secure record to resolve it instantly. This means less time in arguments and more time building trust with property owners who can see a clear, unchangeable history of their investment's care.
          </Typography>
        </Box>

        <Box sx={{ mb: 8 }}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
            Real-Time Data Synchronization
          </Typography>
          <Typography variant="body1" paragraph>
            Eliminate the lag between the field and the office. Our platform uses a real-time WebSocket architecture, the same technology powering live trading platforms. When a technician marks an inspection as "Complete" or a service request is updated to "Pending Owner Approval," your dashboard updates instantly. There are no delays, no "sync" buttons, and no stale information. This live, single source of truth allows you to manage by exception, react faster to urgent issues, and run a more efficient, proactive operation.
          </Typography>
        </Box>

        <Box sx={{ mb: 8 }}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
            Granular, Role-Based Access Control (RBAC)
          </Typography>
          <Typography variant="body1" paragraph>
            Your data security is non-negotiable. Buildstate FM was engineered with a granular, role-based access control system at its core. This ensures that property owners can only view their specific properties, and tenants can only access information relevant to their unit. Sensitive documents, like lease agreements or financial reports, are explicitly permissioned using access control lists. This isn't just a feature; it's a foundational promise that your business, and your clients' data, is always kept confidential and secure.
          </Typography>
        </Box>
      </ContentSection>

      {/* Targeted User Block (Technicians) */}
      <CallToAction>
        <Container maxWidth="md">
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
            For the Hands-On Technician
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Lose the clipboard and the endless phone calls. Our mobile-first design means you get job updates, inspection checklists, and route details in real-time, right on your phone. Upload photos, add notes, and mark jobs as complete with a single tap. The app is built on a modern React framework, making it fast, intuitive, and reliable, even in low-connectivity areas. We handle the data entry so you can focus on the work that matters.
          </Typography>
        </Container>
      </CallToAction>

      {/* Final CTA Block */}
      <ContentSection maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          It's time to upgrade your foundation.
        </Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>
          You can't build a modern property management business on outdated software. Buildstate FM gives you the authority and the evidence to operate with absolute confidence. Our platform is built on a secure, scalable PostgreSQL database and leverages modern authentication standards, including SSO, to protect your data.
        </Typography>
        <Button variant="contained" color="primary" size="large">
          Start Your Free Trial and See the Difference
        </Button>
      </ContentSection>
    </Box>
  );
};

export default LandingPage;