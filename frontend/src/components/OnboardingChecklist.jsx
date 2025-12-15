import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Stack,
  Collapse,
  IconButton,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { useCurrentUser } from '../context/UserContext';

const ONBOARDING_STEPS = {
  PROPERTY_MANAGER: [
    {
      id: 'add_property',
      title: 'Add Your First Property',
      description: 'Create a property to start managing your portfolio',
      icon: HomeIcon,
      action: '/properties',
      actionLabel: 'Add Property',
      checkFn: (data) => (data?.properties?.total || 0) > 0,
    },
    {
      id: 'add_unit',
      title: 'Add Units to Property',
      description: 'Define the units within your properties',
      icon: HomeIcon,
      action: '/properties',
      actionLabel: 'Manage Units',
      checkFn: (data) => (data?.units?.total || 0) > 0,
    },
    {
      id: 'invite_tenant',
      title: 'Invite a Tenant',
      description: 'Assign tenants to your units',
      icon: PersonIcon,
      action: '/properties',
      actionLabel: 'Assign Tenant',
      checkFn: (data) => (data?.tenants?.total || 0) > 0,
    },
    {
      id: 'create_inspection',
      title: 'Schedule an Inspection',
      description: 'Set up routine property inspections',
      icon: AssignmentIcon,
      action: '/inspections',
      actionLabel: 'Schedule Inspection',
      checkFn: (data) => ((data?.inspections?.completedAllTime ?? data?.inspections?.total) || 0) > 0,
    },
    {
      id: 'create_job',
      title: 'Create a Maintenance Job',
      description: 'Track maintenance and repairs',
      icon: BuildIcon,
      action: '/jobs',
      actionLabel: 'Create Job',
      checkFn: (data) => (data?.jobs?.total || 0) > 0,
    },
  ],
  OWNER: [
    {
      id: 'view_properties',
      title: 'Review Your Properties',
      description: 'Check the properties you own',
      icon: HomeIcon,
      action: '/owner/dashboard',
      actionLabel: 'View Properties',
      checkFn: (data) => (data?.properties?.total || 0) > 0,
    },
    {
      id: 'review_inspections',
      title: 'Review Inspection Reports',
      description: 'Stay informed about property conditions',
      icon: AssignmentIcon,
      action: '/inspections',
      actionLabel: 'View Inspections',
      checkFn: (data) => (data?.inspections?.total || 0) > 0,
    },
  ],
  TENANT: [
    {
      id: 'view_unit',
      title: 'View Your Home',
      description: 'Check your home and unit details',
      icon: HomeIcon,
      action: '/tenant/home',
      actionLabel: 'View My Home',
      checkFn: () => true, // Always true if they have access
    },
    {
      id: 'submit_request',
      title: 'Submit a Service Request',
      description: 'Report maintenance issues',
      icon: BuildIcon,
      action: '/service-requests',
      actionLabel: 'New Request',
      checkFn: (data) => (data?.serviceRequests?.total || 0) > 0,
    },
  ],
};

export default function OnboardingChecklist({ onDismiss }) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [expanded, setExpanded] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const completionKey = useMemo(() => {
    const identifier = user?.id || user?.email || 'unknown';
    return `onboarding:completed:${identifier}`;
  }, [user?.email, user?.id]);

  const [stickyCompleted, setStickyCompleted] = useState(() => {
    try {
      const raw = localStorage.getItem(completionKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });

  const dismissKey = useMemo(() => {
    const identifier = user?.id || user?.email || 'unknown';
    return `onboarding:dismissed:${identifier}`;
  }, [user?.email, user?.id]);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey) === 'true');
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(completionKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setStickyCompleted(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setStickyCompleted(new Set());
    }
  }, [completionKey]);

  // Fetch dashboard summary to check completion
  const { data: summary } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/summary');
      return response.data?.summary || response.data;
    },
    staleTime: 30 * 1000,
  });

  const userRole = user?.role || 'PROPERTY_MANAGER';
  const steps = ONBOARDING_STEPS[userRole] || ONBOARDING_STEPS.PROPERTY_MANAGER;

  useEffect(() => {
    const liveCompleted = steps
      .filter((step) => step.checkFn(summary || {}))
      .map((step) => step.id);

    if (liveCompleted.length === 0) return;

    let changed = false;
    const next = new Set(stickyCompleted);
    for (const id of liveCompleted) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }

    if (!changed) return;

    try {
      localStorage.setItem(completionKey, JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
    setStickyCompleted(next);
  }, [completionKey, steps, stickyCompleted, summary]);

  // Calculate completion
  const completedSteps = steps.filter(
    (step) => stickyCompleted.has(step.id) || step.checkFn(summary || {})
  );
  const progress = (completedSteps.length / steps.length) * 100;
  const isComplete = progress === 100;

  // Hide permanently when complete; hide temporarily when dismissed (resets on new sign-in because logout clears sessionStorage)
  if (isComplete || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, 'true');
    } catch {
      // ignore
    }
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleAction = (action) => {
    navigate(action);
  };

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: 3,
        border: '2px solid',
        borderColor: 'primary.main',
        boxShadow: 3,
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={1.5}
          mb={2}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <AssignmentIcon color="primary" sx={{ fontSize: 28 }} />
            <Typography variant="h6" fontWeight={600}>
              Getting Started
            </Typography>
            <Chip label={`${completedSteps.length}/${steps.length}`} color="primary" size="small" />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' } }}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <IconButton size="small" onClick={handleDismiss}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Complete these steps to get the most out of Buildstate FM
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 1,
              mt: 1,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {Math.round(progress)}% complete
          </Typography>
        </Box>

        <Collapse in={expanded}>
          <List disablePadding>
            {steps.map((step, index) => {
              const isCompleted = stickyCompleted.has(step.id) || step.checkFn(summary || {});
              const StepIcon = step.icon;

              const actionButton =
                !isCompleted && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAction(step.action)}
                    sx={{ mt: isMobile ? 1 : 0 }}
                    fullWidth={isMobile}
                  >
                    {step.actionLabel}
                  </Button>
                );

              return (
                <ListItem
                  key={step.id}
                  sx={{
                    borderRadius: 2,
                    mb: index < steps.length - 1 ? 1 : 0,
                    bgcolor: isCompleted ? 'success.lighter' : 'background.default',
                    border: '1px solid',
                    borderColor: isCompleted ? 'success.main' : 'divider',
                    transition: 'all 0.2s',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    '&:hover': {
                      bgcolor: isCompleted ? 'success.lighter' : 'action.hover',
                    },
                  }}
                  secondaryAction={!isMobile ? actionButton : undefined}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    {isCompleted ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <UncheckedIcon color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <StepIcon color={isCompleted ? 'success' : 'action'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body1"
                        fontWeight={isCompleted ? 500 : 600}
                        sx={{
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted ? 'text.secondary' : 'text.primary',
                        }}
                      >
                        {step.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {step.description}
                      </Typography>
                    }
                    sx={{ minWidth: 0 }}
                  />

                  {isMobile && (
                    <Box sx={{ width: '100%', pl: 8 }}>
                      {actionButton}
                    </Box>
                  )}
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
}
