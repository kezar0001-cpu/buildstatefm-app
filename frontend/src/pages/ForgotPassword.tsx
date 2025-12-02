import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, Email } from '@mui/icons-material';
import { apiClient } from '../api/client.js';
import logger from '../utils/logger';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email
    if (!normalizedEmail) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/forgot-password', { email: normalizedEmail });
      const payload = response?.data ?? response;

      if (payload.success) {
        setSuccess(true);
        setEmail(''); // Clear the form
      } else {
        setError(payload.message || 'An error occurred. Please try again.');
      }
    } catch (err: any) {
      logger.error('Forgot password error:', err);

      // Handle different error responses
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.1)',
            animation: 'fade-in 0.5s ease-out',
          }}
        >
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              Forgot Password?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No worries! Enter your email address and we'll send you instructions to reset your password.
            </Typography>
          </Box>

          {/* Success Message */}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Check your email!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                If an account exists with this email, you will receive password reset instructions shortly.
                Please check your spam folder if you don't see it within a few minutes.
              </Typography>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          {!success && (
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                }}
                error={!!emailError}
                helperText={emailError}
                disabled={isLoading}
                placeholder="your.email@example.com"
                InputProps={{
                  startAdornment: (
                    <Email sx={{ color: 'action.active', mr: 1 }} />
                  ),
                }}
                sx={{ mb: 3 }}
                autoFocus
                autoComplete="email"
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  mb: 2,
                  py: 1.5,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                  boxShadow: '0 4px 14px 0 rgb(185 28 28 / 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
                    boxShadow: '0 6px 20px 0 rgb(185 28 28 / 0.4)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                    opacity: 0.6,
                  },
                }}
              >
                {isLoading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          )}

          {/* Back to Sign In Link */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link
              to="/signin"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                color: '#1976d2',
                fontWeight: 500,
              }}
            >
              <ArrowBack sx={{ fontSize: 18, mr: 0.5 }} />
              Back to Sign In
            </Link>
          </Box>

          {/* Additional Help */}
          {success && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Didn't receive the email?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                • Check your spam or junk folder
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Make sure you entered the correct email address
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Wait a few minutes and try again
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Additional Information */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Need help? Contact support at{' '}
            <a
              href="mailto:support@buildtstate.com.au"
              style={{
                color: '#b91c1c',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              support@buildtstate.com.au
            </a>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
