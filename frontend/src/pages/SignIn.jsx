import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container, Box, TextField, Button, Typography, Paper, Alert, Divider,
  IconButton, InputAdornment, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Visibility, VisibilityOff, Google as GoogleIcon, ArrowBack } from '@mui/icons-material';
import { saveTokenFromUrl, setCurrentUser } from '../lib/auth';
import { apiClient } from '../api/client.js';
import logger from '../utils/logger';

// Helper function to get dashboard path based on user role
const getDashboardPath = (role) => {
  const dashboardPaths = {
    TECHNICIAN: '/technician/dashboard',
    OWNER: '/owner/dashboard',
    TENANT: '/tenant/dashboard',
    PROPERTY_MANAGER: '/dashboard',
    ADMIN: '/dashboard',
  };
  return dashboardPaths[role] || '/dashboard';
};

export default function SignIn() {
  const navigate = useNavigate();
  // MINIMAL CHANGE: Add 'role' to the initial state with a default value
  const [formData, setFormData] = useState({ email: '', password: '', role: 'PROPERTY_MANAGER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    saveTokenFromUrl?.(false);
  }, []);

  const googleUrl = useMemo(() => {
    const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    if (!BASE) return null;
    const url = new URL('/api/auth/google', BASE + '/');
    url.searchParams.set('role', 'PROPERTY_MANAGER');
    return url.toString();
  }, []);

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // MINIMAL CHANGE: Add the 'role' to the submitted data
      const response = await apiClient.post(
        '/auth/login',
        {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: formData.role,
        }
      );

      const payload = response?.data ?? response;

      if (!payload?.token || !payload?.user) {
        throw new Error(payload?.message || 'Invalid response from server');
      }

      localStorage.setItem('auth_token', payload.token);
      setCurrentUser(payload.user);
      
      // Navigate to role-specific dashboard
      const dashboardPath = getDashboardPath(payload.user?.role);
      navigate(dashboardPath);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please try again.';
      setError(msg);
      logger.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    if (!googleUrl) {
      setError('Google sign-in is not configured');
      return;
    }
    window.location.href = googleUrl;
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: { xs: 4, md: 8 }, mb: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', px: { xs: 1, sm: 0 } }}>
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, width: '100%', borderRadius: 3 }}>
          <Box sx={{ width: '100%', mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              component={Link}
              to="/"
              startIcon={<ArrowBack />}
              variant="text"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600, color: '#b91c1c' }}
            >
              Back to Buildstate FM
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #dc2626 30%, #f97316 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1
              }}
            >
              Buildstate FM
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage your properties
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Button
            fullWidth
            variant="outlined"
            onClick={handleGoogle}
            disabled={loading || !googleUrl}
            startIcon={<GoogleIcon />}
            sx={{
              mb: 2, textTransform: 'none', borderColor: '#e0e0e0', color: '#757575',
              '&:hover': { borderColor: '#bdbdbd', backgroundColor: '#f5f5f5' }
            }}
          >
            Continue with Google
          </Button>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">or sign in with email</Typography>
          </Divider>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal" required fullWidth id="email" label="Email Address" name="email"
              type="email" autoComplete="email" autoFocus value={formData.email}
              onChange={handleChange} disabled={loading} sx={{ mb: 2 }}
            />

            <TextField
              margin="normal" required fullWidth name="password" label="Password"
              type={showPassword ? 'text' : 'password'} id="password" autoComplete="current-password"
              value={formData.password} onChange={handleChange} disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={loading}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            {/* MINIMAL CHANGE: Add the Role selection dropdown */}
            <FormControl fullWidth margin="normal">
              <InputLabel id="role-select-label">Role</InputLabel>
              <Select
                labelId="role-select-label"
                id="role"
                name="role"
                value={formData.role}
                label="Role"
                onChange={handleChange}
                disabled={loading}
              >
                <MenuItem value="PROPERTY_MANAGER">Property Manager</MenuItem>
                <MenuItem value="OWNER">Owner</MenuItem>
                <MenuItem value="TENANT">Tenant</MenuItem>
                <MenuItem value="TECHNICIAN">Technician</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ textAlign: 'right', mb: 2 }}>
              <Button component={Link} to="/forgot-password" variant="text" size="small" sx={{ textTransform: 'none' }} disabled={loading}>
                Forgot password?
              </Button>
            </Box>

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{ mt: 1, mb: 2, py: 1.5, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Don&apos;t have an account?{' '}
                <Button component={Link} to="/signup" variant="text" size="small"
                  sx={{ textTransform: 'none', fontWeight: 600 }} disabled={loading}>
                  Sign Up
                </Button>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}