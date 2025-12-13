import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Support as SupportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../context/UserContext';
import { calculateDaysRemaining } from '../utils/date';

const UpgradePromptModal = ({ open, onClose, trigger = 'feature', onNeverShowAgain }) => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const theme = useTheme();

  if (!user || user.role !== 'PROPERTY_MANAGER') return null;

  const daysRemaining = calculateDaysRemaining(user.trialEndDate);
  const isOnTrial = user.subscriptionStatus === 'TRIAL' && daysRemaining > 0;

  // Different messaging based on trigger context
  const contexts = {
    feature: {
      title: 'Unlock Premium Features',
      subtitle: 'Upgrade to access this and more advanced features',
      icon: <TrendingUpIcon sx={{ fontSize: 48, color: '#3b82f6' }} />,
    },
    milestone: {
      title: 'Great Progress! 🎉',
      subtitle: "You're getting the most out of Buildstate FM. Upgrade to unlock unlimited potential",
      icon: <SpeedIcon sx={{ fontSize: 48, color: '#10b981' }} />,
    },
    onboarding: {
      title: 'Welcome to Buildstate FM! 👋',
      subtitle: 'Subscribe now to unlock all features and manage your properties without limits',
      icon: <SecurityIcon sx={{ fontSize: 48, color: '#f59e0b' }} />,
    },
  };

  const context = contexts[trigger] || contexts.feature;

  const benefits = [
    'Unlimited properties and units',
    'Advanced automation & scheduling',
    'Priority customer support',
    'Detailed analytics & reporting',
    'Document management & storage',
    'Mobile app access (coming soon)',
  ];

  const handleUpgrade = () => {
    onClose();
    navigate('/subscriptions');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1f2937 0%, #111827 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'grey.500',
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogTitle sx={{ pt: 4, pb: 2, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          {context.icon}
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1,
          }}
        >
          {context.title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {context.subtitle}
        </Typography>
        {isOnTrial && (
          <Chip
            label={`${daysRemaining} days left in trial`}
            color="warning"
            size="small"
            sx={{ mt: 2 }}
          />
        )}
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        <Box
          sx={{
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(248, 113, 113, 0.1)'
              : 'rgba(185, 28, 28, 0.05)',
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              mb: 2,
              color: '#b91c1c',
            }}
          >
            What You'll Get:
          </Typography>
          <List sx={{ py: 0 }}>
            {benefits.map((benefit, index) => (
              <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={benefit}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: 500,
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(74, 222, 128, 0.1)'
              : '#f0fdf4',
            borderRadius: 2,
            p: 2,
          }}
        >
          <SupportIcon sx={{ color: '#10b981' }} />
          <Typography variant="body2" color="text.secondary">
            <strong>Join 500+</strong> property managers already using Buildstate FM Pro
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
          <Button
            onClick={onClose}
            variant="outlined"
            size="large"
            sx={{
              flex: 1,
              borderRadius: 2,
            }}
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleUpgrade}
            variant="contained"
            size="large"
            startIcon={<TrendingUpIcon />}
            sx={{
              flex: 2,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              fontWeight: 700,
              '&:hover': {
                background: 'linear-gradient(135deg, #991b1b 0%, #ea580c 100%)',
                transform: 'scale(1.02)',
              },
            }}
          >
            View Plans
          </Button>
        </Box>
        {onNeverShowAgain && (
          <Button
            onClick={() => {
              onNeverShowAgain();
              onClose();
            }}
            variant="text"
            size="small"
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': {
                bgcolor: 'transparent',
                textDecoration: 'underline',
              },
            }}
          >
            Don't show this again
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default UpgradePromptModal;
