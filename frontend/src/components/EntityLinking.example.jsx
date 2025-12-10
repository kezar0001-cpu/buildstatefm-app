/**
 * EXAMPLE USAGE OF ENTITY LINKING AND DRILL-DOWN COMPONENTS
 * 
 * This file demonstrates how to implement seamless navigation between related entities
 */

import { Button, Stack, Box, Typography } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import EntityLink, { EntityBreadcrumb, RelatedEntities, QuickLinks } from './EntityLink';
import DrillDownNav, { EntityContextPanel } from './DrillDownNav';

/**
 * Example 1: Property Detail Page with Drill-Down Navigation
 */
export function PropertyDetailExample() {
  // Breadcrumb path showing hierarchy
  const path = [
    { type: 'property', id: '1', label: 'All Properties' },
  ];

  const current = {
    label: 'Sunset Apartments',
    subtitle: '123 Main St, Los Angeles, CA 90001',
  };

  // Related entities for quick navigation
  const relatedEntities = [
    { type: 'unit', id: '101', label: 'Unit 101' },
    { type: 'unit', id: '102', label: 'Unit 102' },
    { type: 'inspection', id: '1', label: 'Recent Inspection' },
  ];

  const actions = (
    <>
      <Button variant="outlined" startIcon={<EditIcon />}>
        Edit
      </Button>
      <Button variant="outlined" color="error" startIcon={<DeleteIcon />}>
        Delete
      </Button>
    </>
  );

  return (
    <Box>
      <DrillDownNav
        path={path}
        current={current}
        relatedEntities={relatedEntities}
        actions={actions}
      />

      {/* Property content here */}
    </Box>
  );
}

/**
 * Example 2: Unit Detail Page with Full Context
 */
export function UnitDetailExample() {
  // Breadcrumb showing: Properties → Sunset Apartments → Unit 204
  const path = [
    { type: 'property', id: 'all', label: 'Properties' },
    { type: 'property', id: '1', label: 'Sunset Apartments' },
  ];

  const current = {
    label: 'Unit 204',
    subtitle: '2 Bed, 1 Bath • Occupied',
  };

  const relatedEntities = [
    { type: 'tenant', id: '5', label: 'John Smith' },
    { type: 'job', id: '12', label: '2 Active Jobs' },
  ];

  return (
    <Box>
      <DrillDownNav
        path={path}
        current={current}
        relatedEntities={relatedEntities}
      />

      {/* Unit details content */}
    </Box>
  );
}

/**
 * Example 3: Job Detail with Related Entities Panel
 */
export function JobDetailExample() {
  const path = [
    { type: 'property', id: '1', label: 'Sunset Apartments' },
    { type: 'unit', id: '204', label: 'Unit 204' },
  ];

  const current = {
    label: 'Fix Leaky Faucet',
    subtitle: 'Job #12 • In Progress',
  };

  // Context panel showing all related entities
  const contextSections = [
    {
      label: 'Property',
      type: 'links',
      items: [
        {
          type: 'property',
          id: '1',
          label: 'Sunset Apartments',
          metadata: { subtitle: '123 Main St' },
        },
      ],
    },
    {
      label: 'Unit',
      type: 'links',
      items: [
        {
          type: 'unit',
          id: '204',
          label: 'Unit 204',
          metadata: { subtitle: '2 Bed, 1 Bath' },
        },
      ],
    },
    {
      label: 'Tenant',
      type: 'links',
      items: [
        {
          type: 'tenant',
          id: '5',
          label: 'John Smith',
          metadata: { subtitle: 'john@example.com' },
        },
      ],
    },
    {
      label: 'Related',
      type: 'chips',
      items: [
        { type: 'service-request', id: '8', label: 'Original Request' },
        { type: 'inspection', id: '3', label: 'Follow-up Inspection' },
      ],
    },
  ];

  return (
    <Box>
      <DrillDownNav path={path} current={current} />

      <Stack direction="row" spacing={3} sx={{ mt: 3 }}>
        {/* Main content */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">Job Details</Typography>
          {/* Job content here */}
        </Box>

        {/* Context panel */}
        <Box sx={{ width: 300 }}>
          <EntityContextPanel title="Related Entities" sections={contextSections} />
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Example 4: Dashboard with Quick Links
 */
export function DashboardQuickLinksExample() {
  const recentProperties = [
    { type: 'property', id: '1', label: 'Sunset Apartments' },
    { type: 'property', id: '2', label: 'Ocean View Complex' },
    { type: 'property', id: '3', label: 'Downtown Lofts' },
  ];

  const urgentJobs = [
    { type: 'job', id: '12', label: 'Leaky Faucet - Unit 204' },
    { type: 'job', id: '13', label: 'HVAC Repair - Unit 101' },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Recent Properties
        </Typography>
        <QuickLinks links={recentProperties} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Urgent Jobs
        </Typography>
        <QuickLinks links={urgentJobs} />
      </Box>
    </Stack>
  );
}

/**
 * Example 5: Service Request with Full Entity Context
 */
export function ServiceRequestDetailExample() {
  const path = [
    { type: 'property', id: '1', label: 'Sunset Apartments' },
    { type: 'unit', id: '204', label: 'Unit 204' },
  ];

  const current = {
    label: 'Leaky Kitchen Faucet',
    subtitle: 'Request #8 • Submitted 2 days ago',
  };

  const relatedEntities = [
    { type: 'tenant', id: '5', label: 'John Smith (Requester)' },
    { type: 'job', id: '12', label: 'Converted to Job #12' },
  ];

  return (
    <Box>
      <DrillDownNav
        path={path}
        current={current}
        relatedEntities={relatedEntities}
      />
    </Box>
  );
}

/**
 * Example 6: Inspection with Related Entities List
 */
export function InspectionDetailExample() {
  const relatedEntities = [
    {
      type: 'property',
      id: '1',
      label: 'Sunset Apartments',
      metadata: { subtitle: '123 Main St' },
    },
    {
      type: 'unit',
      id: '204',
      label: 'Unit 204',
      metadata: { subtitle: '2 Bed, 1 Bath' },
    },
    {
      type: 'tenant',
      id: '5',
      label: 'John Smith',
      metadata: { subtitle: 'Current Tenant' },
    },
  ];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Move-In Inspection
      </Typography>

      <RelatedEntities
        title="Related Entities"
        entities={relatedEntities}
        emptyMessage="No related entities found"
      />
    </Box>
  );
}

/**
 * Example 7: Simple Entity Links in Lists
 */
export function EntityLinksInListExample() {
  const jobs = [
    {
      id: '12',
      title: 'Fix Leaky Faucet',
      property: { id: '1', name: 'Sunset Apartments' },
      unit: { id: '204', number: '204' },
      tenant: { id: '5', name: 'John Smith' },
    },
    {
      id: '13',
      title: 'HVAC Repair',
      property: { id: '1', name: 'Sunset Apartments' },
      unit: { id: '101', number: '101' },
      tenant: { id: '3', name: 'Jane Doe' },
    },
  ];

  return (
    <Stack spacing={2}>
      {jobs.map((job) => (
        <Box
          key={job.id}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {job.title}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <EntityLink
              type="property"
              id={job.property.id}
              label={job.property.name}
              variant="chip"
            />
            <EntityLink
              type="unit"
              id={job.unit.id}
              label={`Unit ${job.unit.number}`}
              variant="chip"
            />
            <EntityLink
              type="tenant"
              id={job.tenant.id}
              label={job.tenant.name}
              variant="chip"
            />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * USAGE PATTERNS:
 * 
 * 1. BREADCRUMB NAVIGATION
 *    - Show hierarchy: Properties → Property → Unit
 *    - Each level is clickable
 *    - Current page shown as text
 * 
 * 2. QUICK LINKS
 *    - Horizontal chip list for fast navigation
 *    - Use on dashboards and summaries
 *    - Color-coded by entity type
 * 
 * 3. RELATED ENTITIES
 *    - Vertical card list with full context
 *    - Shows relationships clearly
 *    - Includes metadata (subtitles)
 * 
 * 4. CONTEXT PANELS
 *    - Sidebar showing all related entities
 *    - Grouped by relationship type
 *    - Multiple display formats (links, chips, text)
 * 
 * 5. INLINE LINKS
 *    - Simple text links in content
 *    - Use in descriptions and lists
 *    - Consistent styling across app
 */
