import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, CheckCircle } from '@mui/icons-material';
import { apiClient } from '../api/client.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import logger from '../utils/logger';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const selector = searchParams.get('selector');
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!selector || !token) {
        setError('Invalid reset link. Please request a new password reset.');
        setIsValidating(false);
        return;
      }

      try {
        const response = await apiClient.get('/auth/reset-password/validate', {
          params: { selector, token },
        });

        const payload = response?.data ?? response;

        if (payload.success) {
          setTokenValid(true);
          setUserEmail(payload.email || '');
        } else {
          setError(payload.message || 'Invalid or expired reset link.');
        }
      } catch (err: any) {
        logger.error('Token validation error:', err);
        setError(
          err.response?.data?.message ||
          'Invalid or expired reset link. Please request a new password reset.'
        );
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [selector, token]);

  const validatePassword = (pwd: string): string | null => {
    if (!pwd) {
      return 'Password is required';
    }
    if (pwd.length < 12) {
      return 'Password must be at least 12 characters long';
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate password
    const pwdError = validatePassword(password);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    // Validate password confirmation
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/reset-password', {
        selector,
        token,
        password,
      });

      const payload = response?.data ?? response;

      if (payload.success) {
        setSuccess(true);
        // Redirect to sign in after 3 seconds
        setTimeout(() => {
          navigate('/signin?reset=success');
        }, 3000);
      } else {
        setError(payload.message || 'Failed to reset password. Please try again.');
      }
    } catch (err: any) {
      logger.error('Reset password error:', err);

      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 400) {
        setError('Invalid or expired reset link. Please request a new password reset.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while validating token
  if (isValidating) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            maxWidth: 400,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.1)',
          }}
        >
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="h6">Validating reset link...</Typography>
        </Paper>
      </Box>
    );
  }

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
              {success ? 'Password Reset Successful!' : 'Reset Your Password'}
            </Typography>
            {!success && tokenValid && userEmail && (
              <Typography variant="body2" color="text.secondary">
                Resetting password for: <strong>{userEmail}</strong>
              </Typography>
            )}
          </Box>

          {/* Success Message */}
          {success && (
            <Alert
              severity="success"
              icon={<CheckCircle />}
              sx={{ mb: 3 }}
            >
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Your password has been reset successfully!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                You can now sign in with your new password. Redirecting you to the sign-in page...
              </Typography>
            </Alert>
          )}

          {/* Error Message - Invalid/Expired Token */}
          {error && !tokenValid && (
            <Box>
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
              <Box sx={{ textAlign: 'center' }}>
                <Button
                  variant="contained"
                  component={Link}
                  to="/forgot-password"
                  sx={{
                    textTransform: 'none',
                    mb: 2,
                    background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                    boxShadow: '0 4px 14px 0 rgb(185 28 28 / 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
                      boxShadow: '0 6px 20px 0 rgb(185 28 28 / 0.4)',
                    },
                  }}
                >
                  Request New Reset Link
                </Button>
                <Typography variant="body2">
                  or{' '}
                  <Link to="/signin" style={{ color: '#b91c1c', textDecoration: 'none' }}>
                    return to sign in
                  </Link>
                </Typography>
              </Box>
            </Box>
          )}

          {/* Form - Show only if token is valid and not yet successful */}
          {tokenValid && !success && (
            <form onSubmit={handleSubmit}>
              {/* Error Message for Form Submission */}
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {/* New Password Field */}
              <TextField
                fullWidth
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                error={!!passwordError}
                helperText={passwordError}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <Lock sx={{ color: 'action.active', mr: 1 }} />
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={isLoading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 0 }}
                autoFocus
              />

              <PasswordStrengthMeter password={password} />

              {/* Confirm Password Field */}
              <TextField
                fullWidth
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError('');
                }}
                error={!!confirmPasswordError}
                helperText={confirmPasswordError}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <Lock sx={{ color: 'action.active', mr: 1 }} />
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        disabled={isLoading}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
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
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          )}

          {/* Back to Sign In Link */}
          {!success && tokenValid && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Link
                to="/signin"
                style={{
                  textDecoration: 'none',
                  color: '#1976d2',
                  fontWeight: 500,
                }}
              >
                Back to Sign In
              </Link>
            </Box>
          )}

          {/* Password Requirements Info */}
          {tokenValid && !success && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                Password Requirements:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • At least 12 characters long
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Contains uppercase and lowercase letters
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Contains at least one number
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Contains at least one special character
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
