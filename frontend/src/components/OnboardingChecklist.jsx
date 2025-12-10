import { useState } from 'react';
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
      checkFn: (data) => (data?.inspections?.total || 0) > 0,
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
      title: 'View Your Unit',
      description: 'Check your lease and unit details',
      icon: HomeIcon,
      action: '/tenant/dashboard',
      actionLabel: 'View Dashboard',
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

  // Calculate completion
  const completedSteps = steps.filter((step) => step.checkFn(summary || {}));
  const progress = (completedSteps.length / steps.length) * 100;
  const isComplete = progress === 100;

  // Don't show if user has dismissed or completed
  const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
  if (hasSeenOnboarding && isComplete) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
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
        borderColor: isComplete ? 'success.main' : 'primary.main',
        boxShadow: 3,
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {isComplete ? (
              <CelebrationIcon color="success" sx={{ fontSize: 28 }} />
            ) : (
              <AssignmentIcon color="primary" sx={{ fontSize: 28 }} />
            )}
            <Typography variant="h6" fontWeight={600}>
              {isComplete ? 'Onboarding Complete!' : 'Getting Started'}
            </Typography>
            <Chip
              label={`${completedSteps.length}/${steps.length}`}
              color={isComplete ? 'success' : 'primary'}
              size="small"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <IconButton size="small" onClick={handleDismiss}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        {isComplete && (
          <Alert severity="success" sx={{ mb: 2 }} icon={<CelebrationIcon />}>
            Congratulations! You've completed all the essential setup steps. 
            Your property management system is ready to use.
          </Alert>
        )}

        {!isComplete && (
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
        )}

        <Collapse in={expanded}>
          <List disablePadding>
            {steps.map((step, index) => {
              const isCompleted = step.checkFn(summary || {});
              const StepIcon = step.icon;

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
                    '&:hover': {
                      bgcolor: isCompleted ? 'success.lighter' : 'action.hover',
                    },
                  }}
                  secondaryAction={
                    !isCompleted && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAction(step.action)}
                      >
                        {step.actionLabel}
                      </Button>
                    )
                  }
                >
                  <ListItemIcon>
                    {isCompleted ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <UncheckedIcon color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemIcon>
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
                  />
                </ListItem>
              );
            })}
          </List>

          {isComplete && (
            <Box mt={2} textAlign="center">
              <Button
                variant="contained"
                color="success"
                onClick={handleDismiss}
                startIcon={<CheckCircleIcon />}
              >
                Dismiss Checklist
              </Button>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}
