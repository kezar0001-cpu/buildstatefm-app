/**
 * EXAMPLE USAGE OF DASHBOARD HIERARCHY COMPONENTS
 * 
 * This file demonstrates how to structure a dashboard with proper information hierarchy
 * using DashboardSection, PriorityWidget, and MetricsSummary components
 */

import { Stack, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DashboardSection from './DashboardSection';
import PriorityWidget from './PriorityWidget';
import MetricsSummary from './MetricsSummary';
import {
  Warning as WarningIcon,
  Home as HomeIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

export function DashboardHierarchyExample() {
  const navigate = useNavigate();

  // Example: Critical Issues Section (Highest Priority)
  const criticalIssues = (
    <DashboardSection
      title="Critical Issues"
      subtitle="Items requiring immediate attention"
      priority="critical"
      icon={<WarningIcon />}
      badge={3}
      badgeColor="error"
      collapsible={false}
    >
      <Stack spacing={2}>
        <PriorityWidget
          type="error"
          title="Overdue Inspections"
          message="3 inspections are past their scheduled date"
          count={3}
          items={[
            {
              label: 'Move-out inspection - Unit 204 (5 days overdue)',
              badge: '5d',
              onClick: () => navigate('/inspections/123'),
            },
            {
              label: 'Routine inspection - Property A (3 days overdue)',
              badge: '3d',
              onClick: () => navigate('/inspections/124'),
            },
            {
              label: 'Move-in inspection - Unit 101 (2 days overdue)',
              badge: '2d',
              onClick: () => navigate('/inspections/125'),
            },
          ]}
          onAction={() => navigate('/inspections?filter=overdue')}
          actionLabel="View All Overdue"
        />

        <PriorityWidget
          type="warning"
          title="Urgent Jobs"
          message="2 high-priority jobs need assignment"
          count={2}
          items={[
            {
              label: 'Water leak - Unit 305',
              badge: 'URGENT',
              onClick: () => navigate('/jobs/456'),
            },
            {
              label: 'Heating failure - Unit 102',
              badge: 'HIGH',
              onClick: () => navigate('/jobs/457'),
            },
          ]}
          onAction={() => navigate('/jobs?priority=urgent')}
          actionLabel="Assign Jobs"
        />
      </Stack>
    </DashboardSection>
  );

  // Example: Key Metrics Section (High Priority)
  const keyMetrics = (
    <DashboardSection
      title="Key Metrics"
      subtitle="Overview of your portfolio performance"
      priority="high"
      icon={<TrendingUpIcon />}
      collapsible={true}
      defaultExpanded={true}
    >
      <MetricsSummary
        columns={4}
        metrics={[
          {
            label: 'Occupancy Rate',
            value: 94,
            unit: '%',
            trend: 5,
            trendLabel: 'vs last month',
            color: 'success',
            icon: <HomeIcon />,
            progress: 94,
          },
          {
            label: 'Active Jobs',
            value: 12,
            trend: -15,
            trendLabel: 'vs last month',
            color: 'warning',
            icon: <BuildIcon />,
            subtitle: '3 urgent, 9 normal',
          },
          {
            label: 'Inspections This Month',
            value: 28,
            trend: 12,
            trendLabel: 'vs last month',
            color: 'info',
            icon: <AssignmentIcon />,
            subtitle: '15 completed, 13 scheduled',
          },
          {
            label: 'Revenue',
            value: '45.2K',
            unit: '$',
            trend: 8,
            trendLabel: 'vs last month',
            color: 'primary',
            subtitle: 'Monthly recurring',
          },
        ]}
      />
    </DashboardSection>
  );

  // Example: Properties Overview (Medium Priority)
  const propertiesOverview = (
    <DashboardSection
      title="Properties Overview"
      subtitle="Quick access to your properties"
      priority="medium"
      icon={<HomeIcon />}
      collapsible={true}
      defaultExpanded={true}
      actions={
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate('/properties')}
        >
          View All
        </Button>
      }
    >
      <MetricsSummary
        columns={3}
        metrics={[
          {
            label: 'Total Properties',
            value: 8,
            color: 'primary',
            onClick: () => navigate('/properties'),
          },
          {
            label: 'Total Units',
            value: 124,
            subtitle: '117 occupied, 7 available',
            color: 'info',
            onClick: () => navigate('/properties'),
          },
          {
            label: 'Avg Occupancy',
            value: 94,
            unit: '%',
            color: 'success',
            progress: 94,
          },
        ]}
      />
    </DashboardSection>
  );

  // Example: Recent Activity (Low Priority)
  const recentActivity = (
    <DashboardSection
      title="Recent Activity"
      subtitle="Latest updates across your portfolio"
      priority="low"
      collapsible={true}
      defaultExpanded={false}
    >
      <Stack spacing={1}>
        {/* Activity items would go here */}
        <PriorityWidget
          type="info"
          title="New Service Request"
          message="Tenant submitted a maintenance request"
          items={[
            {
              label: 'Leaky faucet - Unit 204',
              onClick: () => navigate('/service-requests/789'),
            },
          ]}
        />
      </Stack>
    </DashboardSection>
  );

  // Example: Complete Dashboard Layout with Hierarchy
  return (
    <Stack spacing={3}>
      {/* LEVEL 1: Critical Issues - Always visible, cannot collapse */}
      {criticalIssues}

      {/* LEVEL 2: Key Metrics - High priority, expanded by default */}
      {keyMetrics}

      {/* LEVEL 3: Properties Overview - Medium priority, collapsible */}
      {propertiesOverview}

      {/* LEVEL 4: Recent Activity - Low priority, collapsed by default */}
      {recentActivity}
    </Stack>
  );
}

/**
 * HIERARCHY GUIDELINES:
 * 
 * 1. CRITICAL (priority="critical")
 *    - Overdue items
 *    - Urgent issues requiring immediate action
 *    - System alerts
 *    - Cannot be collapsed
 *    - Red/Error color scheme
 * 
 * 2. HIGH (priority="high")
 *    - Key metrics and KPIs
 *    - Important notifications
 *    - High-priority tasks
 *    - Expanded by default, can collapse
 *    - Orange/Warning color scheme
 * 
 * 3. MEDIUM (priority="medium")
 *    - Regular content sections
 *    - Overview widgets
 *    - Standard information
 *    - Collapsible, expanded by default
 *    - Blue/Primary color scheme
 * 
 * 4. LOW (priority="low")
 *    - Supplementary information
 *    - Historical data
 *    - Less frequently accessed content
 *    - Collapsed by default
 *    - Gray/Secondary color scheme
 */
