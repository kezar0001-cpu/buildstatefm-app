import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  EmojiEvents as EmojiEventsIcon,
  CheckCircle as CheckCircleIcon,
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';

export default function WelcomeLifetime() {
  const [searchParams] = useSearchParams();
  const rawEmail = searchParams.get('email');
  const email = typeof rawEmail === 'string' && rawEmail.includes('@') ? rawEmail : null;

  const howItWorksUrl = '/#how-it-works';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 6, md: 10 },
        background: 'linear-gradient(180deg, #fff7f2 0%, #ffffff 70%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack spacing={3}>
            <Stack spacing={1} alignItems="center" textAlign="center">
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                  color: 'white',
                }}
              >
                <EmojiEventsIcon sx={{ fontSize: 34, color: 'white' }} />
              </Box>

              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                Welcome to BuildState FM - Lifetime Member!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Thank you for your purchase. You&apos;re now a lifetime member.
              </Typography>
            </Stack>

            <Divider />

            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                What&apos;s Next
              </Typography>
              <List dense sx={{ py: 0 }}>
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Check your email{email ? ` (${email})` : ''} for your login credentials
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        If you don&apos;t see it, check spam/promotions or contact support.
                      </Typography>
                    }
                  />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Watch the quick demo (How it works)
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        component="a"
                        href={howItWorksUrl}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ color: 'primary.main', textDecoration: 'none' }}
                      >
                        buildstate.com.au/#how-it-works
                      </Typography>
                    }
                  />
                </ListItem>
              </List>
            </Box>

            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  fullWidth
                  variant="contained"
                  component={RouterLink}
                  to="/signin"
                  startIcon={<LoginIcon />}
                  sx={{ textTransform: 'none', fontWeight: 700, py: 1.25 }}
                >
                  Go to Login
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  component={RouterLink}
                  to="/signup"
                  startIcon={<PersonAddIcon />}
                  sx={{ textTransform: 'none', fontWeight: 700, py: 1.25 }}
                >
                  Create Account
                </Button>
              </Stack>

              <Button
                variant="text"
                component="a"
                href="mailto:admin@buildstate.com.au"
                startIcon={<EmailIcon />}
                sx={{ textTransform: 'none', alignSelf: 'center', fontWeight: 600 }}
              >
                admin@buildstate.com.au
              </Button>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                <RocketLaunchIcon color="secondary" fontSize="small" />
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  P.S. Thanks for supporting us on Product Hunt!
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                If you purchased on a different email address, you can pass it here as
                {' '}
                <Typography component="span" variant="caption" sx={{ fontFamily: 'monospace' }}>
                  ?email=you@example.com
                </Typography>
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
