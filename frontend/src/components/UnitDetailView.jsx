import { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Chip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
} from '@mui/material';
import {
  Person as PersonIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  RequestPage as RequestIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import DrillDownNav from './DrillDownNav';
import { RelatedEntities } from './EntityLink';
import MetricsSummary from './MetricsSummary';
import DashboardSection from './DashboardSection';

/**
 * Unit Detail View Component
 * Consolidates all unit-related information in a comprehensive view
 * 
 * @param {Object} props
 * @param {Object} props.unit - Unit data
 * @param {Object} props.property - Parent property data
 * @param {Array} props.tenants - Current tenants
 * @param {Array} props.jobs - Related jobs
 * @param {Array} props.inspections - Related inspections
 * @param {Array} props.serviceRequests - Related service requests
 * @param {Object} props.leaseInfo - Current lease information
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMoveIn - Move-in handler
 * @param {Function} props.onMoveOut - Move-out handler
 */
export default function UnitDetailView({
  unit,
  property,
  tenants = [],
  jobs = [],
  inspections = [],
  serviceRequests = [],
  leaseInfo,
  onEdit,
  onMoveIn,
  onMoveOut,
}) {
  const [activeTab, setActiveTab] = useState(0);

  // Determine unit status
  const isOccupied = unit?.status === 'OCCUPIED';
  const isAvailable = unit?.status === 'AVAILABLE';
  const isMaintenance = unit?.status === 'MAINTENANCE';

  // Calculate metrics
  const activeJobs = jobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const pendingRequests = serviceRequests.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW');
  const upcomingInspections = inspections.filter((i) => i.status === 'SCHEDULED');

  // Breadcrumb path
  const path = [
    { type: 'property', id: 'all', label: 'Properties' },
    { type: 'property', id: property?.id, label: property?.name || 'Property' },
  ];

  const current = {
    label: `Unit ${unit?.unitNumber || ''}`,
    subtitle: `${unit?.bedrooms || 0} Bed, ${unit?.bathrooms || 0} Bath • ${unit?.squareFeet || 0} sq ft`,
  };

  const relatedEntities = [
    ...(property ? [{ type: 'property', id: property.id, label: property.name }] : []),
    ...tenants.map((t) => ({ type: 'tenant', id: t.id, label: `${t.firstName} ${t.lastName}` })),
  ];

  const actions = (
    <>
      {onEdit && (
        <Button variant="outlined" onClick={onEdit}>
          Edit Unit
        </Button>
      )}
      {isAvailable && onMoveIn && (
        <Button variant="contained" onClick={onMoveIn}>
          Move In Tenant
        </Button>
      )}
      {isOccupied && onMoveOut && (
        <Button variant="outlined" color="warning" onClick={onMoveOut}>
          Move Out Tenant
        </Button>
      )}
    </>
  );

  return (
    <Box>
      {/* Navigation and Header */}
      <DrillDownNav
        path={path}
        current={current}
        relatedEntities={relatedEntities}
        actions={actions}
      />

      {/* Key Metrics */}
      <Box sx={{ mb: 3 }}>
        <MetricsSummary
          columns={4}
          metrics={[
            {
              label: 'Status',
              value: unit?.status || 'Unknown',
              color: isOccupied ? 'success' : isAvailable ? 'info' : 'warning',
              icon: <HomeIcon />,
            },
            {
              label: 'Monthly Rent',
              value: leaseInfo?.monthlyRent || unit?.monthlyRent || 0,
              unit: '$',
              color: 'primary',
              icon: <MoneyIcon />,
              subtitle: isOccupied ? 'Current lease' : 'Market rate',
            },
            {
              label: 'Active Jobs',
              value: activeJobs.length,
              color: activeJobs.length > 0 ? 'warning' : 'success',
              icon: <BuildIcon />,
              onClick: () => setActiveTab(1),
            },
            {
              label: 'Pending Requests',
              value: pendingRequests.length,
              color: pendingRequests.length > 0 ? 'error' : 'success',
              icon: <RequestIcon />,
              onClick: () => setActiveTab(3),
            },
          ]}
        />
      </Box>

      {/* Tabbed Content */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 2,
          }}
        >
          <Tab label="Overview" />
          <Tab label={`Jobs (${jobs.length})`} />
          <Tab label={`Inspections (${inspections.length})`} />
          <Tab label={`Requests (${serviceRequests.length})`} />
          <Tab label="Details" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              {/* Current Tenants */}
              <Grid item xs={12} md={6}>
                <DashboardSection
                  title="Current Tenants"
                  subtitle={isOccupied ? `${tenants.length} tenant(s)` : 'No current tenants'}
                  priority={isOccupied ? 'medium' : 'low'}
                  icon={<PersonIcon />}
                  badge={tenants.length}
                >
                  {tenants.length > 0 ? (
                    <List>
                      {tenants.map((tenant) => (
                        <ListItem key={tenant.id} sx={{ px: 0 }}>
                          <ListItemIcon>
                            <Avatar>{tenant.firstName?.[0]}{tenant.lastName?.[0]}</Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={`${tenant.firstName} ${tenant.lastName}`}
                            secondary={
                              <Stack spacing={0.5}>
                                <Typography variant="caption">{tenant.email}</Typography>
                                <Typography variant="caption">{tenant.phone}</Typography>
                              </Stack>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Unit is currently vacant
                    </Typography>
                  )}
                </DashboardSection>
              </Grid>

              {/* Lease Information */}
              <Grid item xs={12} md={6}>
                <DashboardSection
                  title="Lease Information"
                  subtitle={leaseInfo ? 'Active lease' : 'No active lease'}
                  priority={leaseInfo ? 'medium' : 'low'}
                  icon={<CalendarIcon />}
                >
                  {leaseInfo ? (
                    <Stack spacing={2}>
                      <InfoRow label="Start Date" value={new Date(leaseInfo.startDate).toLocaleDateString()} />
                      <InfoRow label="End Date" value={new Date(leaseInfo.endDate).toLocaleDateString()} />
                      <InfoRow label="Monthly Rent" value={`$${leaseInfo.monthlyRent}`} />
                      <InfoRow label="Security Deposit" value={`$${leaseInfo.securityDeposit || 0}`} />
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No active lease
                    </Typography>
                  )}
                </DashboardSection>
              </Grid>

              {/* Recent Activity */}
              <Grid item xs={12}>
                <DashboardSection
                  title="Recent Activity"
                  subtitle="Latest updates for this unit"
                  priority="low"
                  collapsible
                  defaultExpanded={false}
                >
                  <Stack spacing={1.5}>
                    {activeJobs.length > 0 && (
                      <ActivityItem
                        icon={<BuildIcon color="warning" />}
                        title={`${activeJobs.length} active job(s)`}
                        subtitle="Maintenance in progress"
                      />
                    )}
                    {pendingRequests.length > 0 && (
                      <ActivityItem
                        icon={<RequestIcon color="error" />}
                        title={`${pendingRequests.length} pending request(s)`}
                        subtitle="Awaiting review"
                      />
                    )}
                    {upcomingInspections.length > 0 && (
                      <ActivityItem
                        icon={<AssignmentIcon color="info" />}
                        title={`${upcomingInspections.length} upcoming inspection(s)`}
                        subtitle="Scheduled"
                      />
                    )}
                    {activeJobs.length === 0 && pendingRequests.length === 0 && upcomingInspections.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No recent activity
                      </Typography>
                    )}
                  </Stack>
                </DashboardSection>
              </Grid>
            </Grid>
          )}

          {/* Jobs Tab */}
          {activeTab === 1 && (
            <RelatedEntities
              entities={jobs.map((job) => ({
                type: 'job',
                id: job.id,
                label: job.title,
                metadata: {
                  subtitle: `${job.status} • ${job.priority || 'Normal'} priority`,
                },
              }))}
              emptyMessage="No jobs for this unit"
            />
          )}

          {/* Inspections Tab */}
          {activeTab === 2 && (
            <RelatedEntities
              entities={inspections.map((inspection) => ({
                type: 'inspection',
                id: inspection.id,
                label: inspection.title,
                metadata: {
                  subtitle: `${inspection.status} • ${new Date(inspection.scheduledDate).toLocaleDateString()}`,
                },
              }))}
              emptyMessage="No inspections for this unit"
            />
          )}

          {/* Service Requests Tab */}
          {activeTab === 3 && (
            <RelatedEntities
              entities={serviceRequests.map((request) => ({
                type: 'service-request',
                id: request.id,
                label: request.title,
                metadata: {
                  subtitle: `${request.status} • ${request.category || 'General'}`,
                },
              }))}
              emptyMessage="No service requests for this unit"
            />
          )}

          {/* Details Tab */}
          {activeTab === 4 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Unit Specifications
                </Typography>
                <Stack spacing={2}>
                  <InfoRow label="Unit Number" value={unit?.unitNumber} />
                  <InfoRow label="Bedrooms" value={unit?.bedrooms} />
                  <InfoRow label="Bathrooms" value={unit?.bathrooms} />
                  <InfoRow label="Square Feet" value={unit?.squareFeet} />
                  <InfoRow label="Floor" value={unit?.floor} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Amenities
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                  {unit?.amenities?.map((amenity, index) => (
                    <Chip key={index} label={amenity} size="small" />
                  )) || <Typography variant="body2" color="text.secondary">No amenities listed</Typography>}
                </Stack>
              </Grid>
              {unit?.description && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Description
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {unit.description}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

/**
 * Info Row Component
 */
function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}:
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value || 'N/A'}
      </Typography>
    </Box>
  );
}

/**
 * Activity Item Component
 */
function ActivityItem({ icon, title, subtitle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 1, bgcolor: 'background.default' }}>
      {icon}
      <Box>
        <Typography variant="body2" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
