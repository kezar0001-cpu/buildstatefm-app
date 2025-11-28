import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container, Box, TextField, Button, Typography, Paper, Alert, Divider,
  IconButton, InputAdornment, Grid, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Visibility, VisibilityOff, Google as GoogleIcon, ArrowBack } from '@mui/icons-material';
import { saveTokenFromUrl, setCurrentUser } from '../lib/auth';
import { apiClient } from '../api/client.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const selectedPlan = searchParams.get('plan'); // Get plan from URL params

  // MINIMAL CHANGE: Add 'role' to the initial state
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '', company: '', role: 'PROPERTY_MANAGER'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    saveTokenFromUrl?.();
    const token = localStorage.getItem('auth_token');
    if (token) navigate('/dashboard');
  }, [navigate]);

  // Fetch invite details if invite token is present
  useEffect(() => {
    const fetchInviteDetails = async () => {
      if (!inviteToken) return;

      setInviteLoading(true);
      try {
        const response = await apiClient.get(`/invites/${inviteToken}`);
        const res = response?.data ?? response;
        const inviteDetails = res.invite || res;
        setInviteData(inviteDetails);
        // Pre-fill email and role from invite
        setFormData(prev => ({
          ...prev,
          email: inviteDetails.email || prev.email,
          role: inviteDetails.role || prev.role
        }));
      } catch (err) {
        setError('Invalid or expired invitation link');
        console.error('Invite fetch error:', err);
      } finally {
        setInviteLoading(false);
      }
    };

    fetchInviteDetails();
  }, [inviteToken]);

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

  const validateForm = () => {
    const { firstName, lastName, email, password, confirmPassword, phone } = formData;
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all required fields');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError('Please enter a valid email address'); return false; }

    // Validate password requirements
    const passwordRequirements = {
      minLength: password.length >= 12,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    };

    if (!Object.values(passwordRequirements).every(Boolean)) {
      setError('Password does not meet all requirements. Please check the requirements below.');
      return false;
    }

    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (phone && !phoneRegex.test(phone)) { setError('Please enter a valid phone number'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    setLoading(true);
    try {
      // MINIMAL CHANGE: Include the selected 'role' from the form data
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim() || undefined,
        role: formData.role,
      };

      // Add invite token if present
      if (inviteToken) {
        payload.inviteToken = inviteToken;
      }

      const response = await apiClient.post('/auth/register', payload, { withCredentials: true });

      const res = response?.data ?? response;

      if (!res?.token || !res?.user) throw new Error(res?.message || 'Invalid response from server');

      localStorage.setItem('auth_token', res.token);
      setCurrentUser(res.user);

      // If a plan was selected, redirect to subscriptions page with plan parameter
      if (selectedPlan) {
        navigate(`/subscriptions?plan=${selectedPlan}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.[0]?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please try again.';
      setError(msg);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    if (!googleUrl) { setError('Google sign-up is not configured'); return; }
    window.location.href = googleUrl;
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: { xs: 4, md: 8 }, mb: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', px: { xs: 1, sm: 0 } }}>
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, width: '100%', borderRadius: 3 }}>
          <Box sx={{ width: '100%', mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              component={Link}
              to="/signin"
              startIcon={<ArrowBack />}
              variant="text"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600, color: '#b91c1c' }}
            >
              Back to Sign In
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" component="h1" sx={{
              fontWeight: 700,
              background: 'linear-gradient(45deg, #dc2626 30%, #f97316 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}>
              Buildstate FM
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Create Account</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedPlan ? `Sign up to start your free trial with the ${selectedPlan.charAt(0) + selectedPlan.slice(1).toLowerCase()} plan` : 'Join Buildstate FM to streamline your property management'}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Button
            fullWidth variant="outlined" onClick={handleGoogle}
            disabled={loading || !googleUrl} startIcon={<GoogleIcon />}
            sx={{ mb: 2, textTransform: 'none', borderColor: '#e0e0e0', color: '#757575',
              '&:hover': { borderColor: '#bdbdbd', backgroundColor: '#f5f5f5' } }}
          >
            Continue with Google
          </Button>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">or sign up with email</Typography>
          </Divider>

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal" required fullWidth id="firstName" label="First Name" name="firstName"
                  autoComplete="given-name" autoFocus value={formData.firstName}
                  onChange={handleChange} disabled={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal" required fullWidth id="lastName" label="Last Name" name="lastName"
                  autoComplete="family-name" value={formData.lastName}
                  onChange={handleChange} disabled={loading}
                />
              </Grid>
            </Grid>

            <TextField
              margin="normal" required fullWidth id="email" label="Email Address" name="email"
              type="email" autoComplete="email" value={formData.email}
              onChange={handleChange} disabled={loading || inviteData}
              InputProps={{
                readOnly: !!inviteData,
              }}
              helperText={inviteData ? 'Email from invitation' : ''}
            />

            <TextField
              margin="normal" fullWidth id="phone" label="Phone Number" name="phone"
              type="tel" autoComplete="tel" placeholder="e.g., +1 555 123 4567"
              value={formData.phone} onChange={handleChange} disabled={loading}
            />

            {/* Role selection only shown for invite-based signup */}
            {inviteToken && inviteData && (
              <FormControl fullWidth margin="normal">
                <InputLabel id="role-select-label">Role</InputLabel>
                <Select
                  labelId="role-select-label"
                  id="role"
                  name="role"
                  value={formData.role}
                  label="Role"
                  onChange={handleChange}
                  disabled={true}
                >
                  <MenuItem value="PROPERTY_MANAGER">Property Manager</MenuItem>
                  <MenuItem value="OWNER">Owner</MenuItem>
                  <MenuItem value="TENANT">Tenant</MenuItem>
                  <MenuItem value="TECHNICIAN">Technician</MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Show info text for non-invite signups */}
            {!inviteToken && (
              <Alert severity="info" sx={{ mt: 2 }}>
                You are signing up as a Property Manager. Other roles require an invitation.
              </Alert>
            )}

            <TextField
              margin="normal" required fullWidth name="password" label="Password"
              type={showPassword ? 'text' : 'password'} id="password" autoComplete="new-password"
              value={formData.password} onChange={handleChange} disabled={loading}
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={loading}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )}}
            />

            <PasswordStrengthMeter password={formData.password} />

            <TextField
              margin="normal" required fullWidth name="confirmPassword" label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" autoComplete="new-password"
              value={formData.confirmPassword} onChange={handleChange} disabled={loading}
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" disabled={loading}>
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )}}
            />

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{ mt: 3, mb: 2, py: 1.5, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Button component={Link} to="/signin" variant="text" size="small"
                  sx={{ textTransform: 'none', fontWeight: 600 }} disabled={loading}>
                  Sign In
                </Button>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}