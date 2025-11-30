import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff, ArrowBack, AdminPanelSettings } from '@mui/icons-material';
import { setCurrentUser } from '../../lib/auth';
import { apiClient } from '../../api/client.js';

export default function BlogAdminLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      // Always use ADMIN role for blog admin login
      const response = await apiClient.post(
        '/auth/login',
        {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: 'ADMIN',
        }
      );

      const payload = response?.data ?? response;

      if (!payload?.token || !payload?.user) {
        throw new Error(payload?.message || 'Invalid response from server');
      }

      // Verify user has ADMIN role
      if (payload.user.role !== 'ADMIN') {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('auth_token', payload.token);
      setCurrentUser(payload.user);

      // Redirect to blog admin dashboard
      navigate('/admin/blog');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please check your credentials.';
      setError(msg);
      console.error('Blog admin login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{
        mt: { xs: 4, md: 8 },
        mb: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: { xs: 1, sm: 0 }
      }}>
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, width: '100%', borderRadius: 3 }}>
          {/* Back Button */}
          <Box sx={{ width: '100%', mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              component={Link}
              to="/blog"
              startIcon={<ArrowBack />}
              variant="text"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Back to Blog
            </Button>
          </Box>

          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <AdminPanelSettings sx={{ fontSize: 60, color: 'primary.main' }} />
            </Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                mb: 1
              }}
            >
              Blog Admin
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to manage blog content
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Admin credentials required
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Admin Email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 3,
                mb: 2,
                py: 1.5,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In as Admin'}
            </Button>

            {/* Info Box */}
            <Box sx={{
              mt: 3,
              p: 2,
              bgcolor: 'info.lighter',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'info.light'
            }}>
              <Typography variant="caption" color="text.secondary">
                This is a secure admin-only area. If you need to access the main application,
                please use the <Link to="/signin" style={{ fontWeight: 600 }}>standard sign-in page</Link>.
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
