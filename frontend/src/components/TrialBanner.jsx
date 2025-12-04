import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  Bolt as BoltIcon,
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../context/UserContext';
import { calculateDaysRemaining } from '../utils/date';

const TrialBanner = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [isExpanded, setIsExpanded] = useState(true);
  const lastScrollYRef = useRef(0);
  const isExpandedRef = useRef(true);
  const bannerRef = useRef(null);
  const subscriptionStatus = user?.subscriptionStatus ?? null;
  const trialEndDate = user?.trialEndDate;
  const daysRemaining = calculateDaysRemaining(trialEndDate);
  const isTrialActive = subscriptionStatus === 'TRIAL' && daysRemaining > 0;
  const isTrialExpired = subscriptionStatus === 'TRIAL' && daysRemaining <= 0;
  const isSuspended = subscriptionStatus === 'SUSPENDED' || subscriptionStatus === 'CANCELLED';

  // Handle scroll to collapse/expand banner
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const previousScrollY = lastScrollYRef.current;
      const delta = currentScrollY - previousScrollY;

      lastScrollYRef.current = currentScrollY;

      // Ignore tiny adjustments that can happen from layout shifts while collapsing/expanding
      if (Math.abs(delta) < 2) {
        return;
      }

      const isScrollingDown = delta > 0;
      const isScrollingUp = delta < 0;

      if (isScrollingDown && currentScrollY > 50 && isExpandedRef.current) {
        // Only collapse after a meaningful downward movement to avoid oscillation
        if (delta > 4) {
          isExpandedRef.current = false;
          setIsExpanded(false);
        }
        return;
      }

      if (
        isScrollingUp &&
        !isExpandedRef.current &&
        (currentScrollY < 16 || Math.abs(delta) > 8)
      ) {
        isExpandedRef.current = true;
        setIsExpanded(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    const updateBannerHeight = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty('--trial-banner-height', `${height}px`);
    };

    updateBannerHeight();

    window.addEventListener('resize', updateBannerHeight);

    let resizeObserver;
    if (bannerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateBannerHeight);
      resizeObserver.observe(bannerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateBannerHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      document.documentElement.style.removeProperty('--trial-banner-height');
    };
  }, [isExpanded, isTrialActive, isTrialExpired, isSuspended]);

  // Don't show banner if user has active subscription
  if (!user || subscriptionStatus === 'ACTIVE') {
    return null;
  }

  // Calculate urgency level
  const isUrgent = daysRemaining <= 3 && daysRemaining > 0;
  const isCritical = daysRemaining <= 1 && daysRemaining > 0;

  // Calculate progress percentage (14-day trial assumed)
  const totalTrialDays = 14;
  const progressPercentage = Math.max(0, Math.min(100, ((totalTrialDays - daysRemaining) / totalTrialDays) * 100));

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem('trialBannerCollapsed');
    if (storedValue === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('trialBannerCollapsed', isCollapsed ? 'true' : 'false');
  }, [isCollapsed]);

  const floatingContainerStyles = {
    position: 'fixed',
    bottom: { xs: 16, sm: 24 },
    right: { xs: 16, sm: 24 },
    left: { xs: 16, sm: 'auto' },
    zIndex: (theme) => theme.zIndex.drawer + 2,
    width: { xs: 'auto', sm: 360 },
    maxWidth: { xs: 'calc(100% - 32px)', sm: 360 },
  };

  const collapsedChip = (
    <Box sx={floatingContainerStyles}>
      <Tooltip title="Show trial details">
        <Chip
          color="warning"
          onClick={() => setIsCollapsed(false)}
          label={
            daysRemaining > 0
              ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your trial`
              : 'Trial ended - view plans'
          }
          icon={daysRemaining > 0 ? <AccessTimeIcon /> : <WarningIcon />}
          sx={{
            cursor: 'pointer',
            fontWeight: 600,
            width: '100%',
            px: 1.5,
            '& .MuiChip-label': {
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              whiteSpace: 'nowrap',
            },
          }}
        />
      </Tooltip>
    </Box>
  );

  // Trial expired or suspended - show urgent warning
  if (isTrialExpired || isSuspended) {
    if (isCollapsed) {
      return collapsedChip;
    }

    return (
      <Box sx={floatingContainerStyles}>
        <Paper
          elevation={8}
          sx={{
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            color: '#fff',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <WarningIcon sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Your Trial Has Ended
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mt: 0.5 }}>
                  Subscribe now to restore full access to all features and keep your data secure.
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Minimize">
              <IconButton size="small" onClick={() => setIsCollapsed(true)} sx={{ color: '#fff' }}>
                <KeyboardArrowUpIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ bgcolor: 'rgba(0,0,0,0.12)', px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Reactivate your workspace instantly
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/subscriptions')}
              sx={{
                bgcolor: '#fff',
                color: '#dc2626',
                fontWeight: 700,
                px: 2,
                py: 1,
                '&:hover': {
                  bgcolor: '#fef2f2',
                },
              }}
            >
              Subscribe
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Trial active - show countdown banner
  if (isTrialActive) {
    // Determine banner styling based on urgency
    const bannerBgColor = isCritical
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : isUrgent
      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
      : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'; // Changed to orange theme

    const bannerBorderColor = isCritical ? '#7f1d1d' : isUrgent ? '#92400e' : '#c2410c'; // Changed to orange

    if (isCollapsed) {
      return collapsedChip;
    }

    return (
      <Box sx={floatingContainerStyles}>
        <Paper
          elevation={6}
          sx={{
            background: bannerBgColor,
            color: '#fff',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                {isCritical || isUrgent ? (
                  <BoltIcon sx={{ fontSize: 26 }} />
                ) : (
                  <AccessTimeIcon sx={{ fontSize: 26 }} />
                )}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {isCritical
                      ? 'Your trial ends tomorrow'
                      : isUrgent
                      ? `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your trial`
                      : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your free trial`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mt: 0.5 }}>
                    {isCritical
                      ? 'Lock in uninterrupted access before your team is locked out.'
                      : isUrgent
                      ? 'Secure your premium workflows now to keep momentum going.'
                      : 'Upgrade to continue automated workflows, reminders, and reporting.'}
                  </Typography>
                </Box>
              </Box>
              <Tooltip title="Minimize">
                <IconButton size="small" onClick={() => setIsCollapsed(true)} sx={{ color: '#fff' }}>
                  <KeyboardArrowUpIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
                  Trial progress
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
                  {Math.max(daysRemaining, 0)} day{Math.max(daysRemaining, 0) === 1 ? '' : 's'} left
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPercentage}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#fff',
                  },
                }}
              />
            </Box>
          </Box>
          <Box
            sx={{
              bgcolor: 'rgba(0,0,0,0.12)',
              px: 2,
              py: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {isCritical || isUrgent ? 'Reserve your rate today' : 'Upgrade when you’re ready'}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/subscriptions')}
              startIcon={<TrendingUpIcon />}
              sx={{
                bgcolor: '#fff',
                color: isCritical || isUrgent ? '#dc2626' : '#ea580c',
                fontWeight: 700,
                px: 2,
                py: 1,
                '&:hover': {
                  bgcolor: '#fef2f2',
                },
              }}
            >
              View plans
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (isCollapsed) {
    return collapsedChip;
  }

  return (
    <Box sx={floatingContainerStyles}>
      <Paper
        elevation={4}
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <WarningIcon color="warning" sx={{ fontSize: 26 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Trial status unavailable
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Visit billing to review your subscription options and keep your workspace active.
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Dismiss">
            <IconButton size="small" onClick={() => setIsCollapsed(true)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ bgcolor: 'rgba(0,0,0,0.04)', px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Explore subscription plans
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/subscriptions')}
            sx={{ fontWeight: 700, px: 2, py: 1 }}
          >
            View plans
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default TrialBanner;
