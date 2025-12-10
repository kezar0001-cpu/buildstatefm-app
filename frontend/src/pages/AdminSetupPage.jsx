import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link as MuiLink,
  Collapse,
  IconButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { saveAuthToken, setCurrentUser } from '../lib/auth';
import logger from '../utils/logger';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockIcon from '@mui/icons-material/Lock';

export default function AdminSetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');
  
  // Recovery Mode State
  const [showRecovery, setShowRecovery] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    adminSecret: '', // New field for recovery PIN
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await apiClient.get('/auth/setup/check');
      setSetupRequired(response.data.setupRequired);
      if (!response.data.setupRequired) {
        // Don't set error immediately, let the UI handle the "Already Exists" state
      }
    } catch (err) {
      setError('Failed to check setup status. Please try again.');
      logger.error('Setup check error:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone || undefined,
      };

      // Only include secret if we are in recovery mode (or if user entered one)
      if (formData.adminSecret) {
        payload.adminSecret = formData.adminSecret;
      }

      const response = await apiClient.post('/auth/setup', payload);

      if (response.data.success) {
        // Save auth token and user
        saveAuthToken(response.data.accessToken);
        setCurrentUser(response.data.user);

        // Redirect to admin dashboard
        navigate('/admin/dashboard');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Setup failed. Please try again.';
      setError(message);
      logger.error('Setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecoveryMode = () => {
    setShowRecovery(!showRecovery);
    setError(''); // Clear previous errors
  };

  if (checking) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Checking setup status...
        </Typography>
      </Container>
    );
  }

  // Determine if we should show the full form
  // Show form if setup IS required OR if we are in recovery mode
  const shouldShowForm = setupRequired || showRecovery;

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 60, color: shouldShowForm ? 'primary.main' : 'text.secondary', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            {shouldShowForm ? (showRecovery ? 'Admin Recovery' : 'Admin Setup') : 'Setup Complete'}
          </Typography>
          
          {!shouldShowForm && (
            <Box>
              <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
                An admin account already exists. Please sign in to continue.
              </Alert>
              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate('/admin/blog/login')}
                sx={{ mb: 2 }}
              >
                Go to Admin Sign In
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<LockIcon />}
                onClick={toggleRecoveryMode}
                sx={{ mt: 1 }}
              >
                Recover Admin Access
              </Button>
            </Box>
          )}
          
          {shouldShowForm && (
            <Typography variant="body1" color="text.secondary">
               {showRecovery 
                 ? 'Create an additional admin account using your Recovery PIN.' 
                 : 'Create the first admin account for Buildstate FM'}
            </Typography>
          )}
        </Box>

        {shouldShowForm && (
          <Box component="form" onSubmit={handleSubmit}>
             {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Recovery PIN Field - Only shown in recovery mode */}
            {showRecovery && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.200' }}>
                <Typography variant="subtitle2" color="error" gutterBottom fontWeight="bold">
                  Security Check
                </Typography>
                <TextField
                  fullWidth
                  required={showRecovery}
                  type="password"
                  label="Recovery PIN"
                  name="adminSecret"
                  value={formData.adminSecret}
                  onChange={handleChange}
                  placeholder="Enter the secret PIN to bypass check"
                  size="small"
                  autoFocus
                  color="error"
                />
              </Box>
            )}

            <TextField
              fullWidth
              required
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
            />
            <TextField
              fullWidth
              required
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
            />
            <TextField
              fullWidth
              required
              type="email"
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Phone (Optional)"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              margin="normal"
              placeholder="+1 234 567 8900"
              disabled={loading}
            />
            <TextField
              fullWidth
              required
              type="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
              helperText="Minimum 8 characters"
            />
            <TextField
              fullWidth
              required
              type="password"
              label="Confirm Password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              color={showRecovery ? "error" : "primary"}
              disabled={loading}
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : (showRecovery ? 'Create Recovery Admin' : 'Create Admin Account')}
            </Button>

            {showRecovery && (
               <Button 
                 fullWidth 
                 variant="text" 
                 onClick={toggleRecoveryMode}
                 sx={{ mb: 1 }}
               >
                 Cancel Recovery
               </Button>
            )}
          </Box>
        )}

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <MuiLink
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer' }}
            disabled={loading}
          >
            Back to Home
          </MuiLink>
        </Box>
      </Paper>
    </Container>
  );
}