import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Person, Lock, Save, Edit, Article as ArticleIcon, Notifications as NotificationsIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCurrentUser } from '../context/UserContext';
import { apiClient } from '../api/client.js';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDate } from '../utils/date';

export default function ProfilePage() {
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [editingNotifications, setEditingNotifications] = useState(false);

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.auth.profile(currentUser?.id),
    queryFn: async () => {
      const response = await apiClient.get('/users/me');
      return response.data?.data ?? response.data;
    },
    enabled: !!currentUser?.id,
  });

  // Phase 3: Fetch notification preferences
  const { data: notificationPreferences, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const response = await apiClient.get('/notification-preferences');
      return response.data;
    },
    enabled: !!currentUser?.id,
  });

  // Notification preferences form state
  const [notificationForm, setNotificationForm] = useState({
    emailEnabled: true,
    pushEnabled: true,
    jobAssigned: true,
    jobStatusChanged: true,
    jobCompleted: true,
    inspectionScheduled: true,
    inspectionCompleted: true,
    serviceRequestCreated: true,
    serviceRequestApproved: true,
    paymentFailed: true,
    paymentSucceeded: true,
    trialExpiring: true,
    emailDigestFrequency: 'DAILY',
  });

  // Update notification form when preferences load
  React.useEffect(() => {
    if (notificationPreferences) {
      setNotificationForm({
        emailEnabled: notificationPreferences.emailEnabled ?? true,
        pushEnabled: notificationPreferences.pushEnabled ?? true,
        jobAssigned: notificationPreferences.jobAssigned ?? true,
        jobStatusChanged: notificationPreferences.jobStatusChanged ?? true,
        jobCompleted: notificationPreferences.jobCompleted ?? true,
        inspectionScheduled: notificationPreferences.inspectionScheduled ?? true,
        inspectionCompleted: notificationPreferences.inspectionCompleted ?? true,
        serviceRequestCreated: notificationPreferences.serviceRequestCreated ?? true,
        serviceRequestApproved: notificationPreferences.serviceRequestApproved ?? true,
        paymentFailed: notificationPreferences.paymentFailed ?? true,
        paymentSucceeded: notificationPreferences.paymentSucceeded ?? true,
        trialExpiring: notificationPreferences.trialExpiring ?? true,
        emailDigestFrequency: notificationPreferences.emailDigestFrequency || 'DAILY',
      });
    }
  }, [notificationPreferences]);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Update profile when data loads
  React.useEffect(() => {
    if (profile) {
      setProfileForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        company: profile.company || '',
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.patch(`/users/${currentUser.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile(currentUser?.id) });
      toast.success('Profile updated successfully');
      setEditingProfile(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post(`/users/${currentUser.id}/change-password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setEditingPassword(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to change password');
    },
  });

  // Phase 3: Update notification preferences mutation
  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.patch('/notification-preferences', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      toast.success('Notification preferences updated successfully');
      setEditingNotifications(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update notification preferences');
    },
  });

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    changePasswordMutation.mutate(passwordForm);
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontWeight: 800,
          background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
          animation: 'fade-in-down 0.5s ease-out',
        }}
      >
        Profile Settings
      </Typography>

      {/* Profile Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ width: 80, height: 80, mr: 2, bgcolor: 'primary.main' }}>
            <Person sx={{ fontSize: 40 }} />
          </Avatar>
          <Box>
            <Typography variant="h6">
              {profile?.firstName} {profile?.lastName}
            </Typography>
            <Typography color="text.secondary">{profile?.email}</Typography>
            <Typography variant="body2" color="text.secondary">
              Role: {profile?.role}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Personal Information</Typography>
          {!editingProfile && (
            <Button
              startIcon={<Edit />}
              onClick={() => setEditingProfile(true)}
            >
              Edit
            </Button>
          )}
        </Box>

        <form onSubmit={handleProfileSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                disabled={!editingProfile}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                disabled={!editingProfile}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                disabled={!editingProfile}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company"
                value={profileForm.company}
                onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                disabled={!editingProfile}
              />
            </Grid>
          </Grid>

          {editingProfile && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<Save />}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setEditingProfile(false);
                  setProfileForm({
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    phone: profile.phone || '',
                    company: profile.company || '',
                  });
                }}
              >
                Cancel
              </Button>
            </Box>
          )}
        </form>
      </Paper>

      {/* Change Password */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Change Password</Typography>
          {!editingPassword && (
            <Button
              startIcon={<Lock />}
              onClick={() => setEditingPassword(true)}
            >
              Change
            </Button>
          )}
        </Box>

        {editingPassword ? (
          <form onSubmit={handlePasswordSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  helperText="Must be at least 8 characters"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<Lock />}
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setEditingPassword(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
              >
                Cancel
              </Button>
            </Box>
          </form>
        ) : (
          <Typography color="text.secondary">
            Click "Change" to update your password
          </Typography>
        )}
      </Paper>

      {/* Subscription Info */}
      {profile && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Subscription
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography color="text.secondary">Plan</Typography>
              <Typography variant="body1">{profile.subscriptionPlan}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography color="text.secondary">Status</Typography>
              <Typography variant="body1">{profile.subscriptionStatus}</Typography>
            </Grid>
            {profile.trialEndDate && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Trial ends on {formatDate(profile.trialEndDate)}
                </Alert>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Phase 3: Notification Preferences */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6">Notification Preferences</Typography>
          </Box>
          {!editingNotifications && (
            <Button
              startIcon={<Edit />}
              onClick={() => setEditingNotifications(true)}
            >
              Edit
            </Button>
          )}
        </Box>

        {editingNotifications ? (
          <form onSubmit={(e) => {
            e.preventDefault();
            updateNotificationPreferencesMutation.mutate(notificationForm);
          }}>
            <FormGroup>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                General Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.emailEnabled}
                    onChange={(e) => setNotificationForm({ ...notificationForm, emailEnabled: e.target.checked })}
                  />
                }
                label="Email Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.pushEnabled}
                    onChange={(e) => setNotificationForm({ ...notificationForm, pushEnabled: e.target.checked })}
                  />
                }
                label="In-App Notifications"
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Job Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.jobAssigned}
                    onChange={(e) => setNotificationForm({ ...notificationForm, jobAssigned: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Job Assigned"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.jobStatusChanged}
                    onChange={(e) => setNotificationForm({ ...notificationForm, jobStatusChanged: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Job Status Changed"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.jobCompleted}
                    onChange={(e) => setNotificationForm({ ...notificationForm, jobCompleted: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Job Completed"
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Inspection Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.inspectionScheduled}
                    onChange={(e) => setNotificationForm({ ...notificationForm, inspectionScheduled: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Inspection Scheduled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.inspectionCompleted}
                    onChange={(e) => setNotificationForm({ ...notificationForm, inspectionCompleted: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Inspection Completed"
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Service Request Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.serviceRequestCreated}
                    onChange={(e) => setNotificationForm({ ...notificationForm, serviceRequestCreated: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Service Request Created"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.serviceRequestApproved}
                    onChange={(e) => setNotificationForm({ ...notificationForm, serviceRequestApproved: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Service Request Approved"
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Subscription & Payment
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.trialExpiring}
                    onChange={(e) => setNotificationForm({ ...notificationForm, trialExpiring: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Trial Expiring"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.paymentFailed}
                    onChange={(e) => setNotificationForm({ ...notificationForm, paymentFailed: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Payment Failed"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationForm.paymentSucceeded}
                    onChange={(e) => setNotificationForm({ ...notificationForm, paymentSucceeded: e.target.checked })}
                    disabled={!notificationForm.pushEnabled && !notificationForm.emailEnabled}
                  />
                }
                label="Payment Succeeded"
              />

              {notificationForm.emailEnabled && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Email Digest Frequency</InputLabel>
                    <Select
                      value={notificationForm.emailDigestFrequency}
                      onChange={(e) => setNotificationForm({ ...notificationForm, emailDigestFrequency: e.target.value })}
                      label="Email Digest Frequency"
                    >
                      <MenuItem value="NONE">No Digest</MenuItem>
                      <MenuItem value="DAILY">Daily</MenuItem>
                      <MenuItem value="WEEKLY">Weekly</MenuItem>
                      <MenuItem value="MONTHLY">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={updateNotificationPreferencesMutation.isPending}
                >
                  {updateNotificationPreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditingNotifications(false);
                    if (notificationPreferences) {
                      setNotificationForm({
                        emailEnabled: notificationPreferences.emailEnabled ?? true,
                        pushEnabled: notificationPreferences.pushEnabled ?? true,
                        jobAssigned: notificationPreferences.jobAssigned ?? true,
                        jobStatusChanged: notificationPreferences.jobStatusChanged ?? true,
                        jobCompleted: notificationPreferences.jobCompleted ?? true,
                        inspectionScheduled: notificationPreferences.inspectionScheduled ?? true,
                        inspectionCompleted: notificationPreferences.inspectionCompleted ?? true,
                        serviceRequestCreated: notificationPreferences.serviceRequestCreated ?? true,
                        serviceRequestApproved: notificationPreferences.serviceRequestApproved ?? true,
                        paymentFailed: notificationPreferences.paymentFailed ?? true,
                        paymentSucceeded: notificationPreferences.paymentSucceeded ?? true,
                        trialExpiring: notificationPreferences.trialExpiring ?? true,
                        emailDigestFrequency: notificationPreferences.emailDigestFrequency || 'DAILY',
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </FormGroup>
          </form>
        ) : (
          <Typography color="text.secondary">
            Click "Edit" to manage your notification preferences
          </Typography>
        )}
      </Paper>

      {/* Blog Admin Link (only for ADMIN users) */}
      {profile?.role === 'ADMIN' && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Blog Administration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage blog posts, categories, tags, and AI automation
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<ArticleIcon />}
              onClick={() => navigate('/admin/blog')}
              sx={{
                textTransform: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6941a0 100%)',
                },
              }}
            >
              Go to Blog Admin
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
}
