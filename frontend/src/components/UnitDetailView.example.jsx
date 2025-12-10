/**
 * EXAMPLE USAGE OF UNIT DETAIL VIEW COMPONENT
 * 
 * This file demonstrates how to use the consolidated unit detail view
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Container, CircularProgress, Box } from '@mui/material';
import UnitDetailView from './UnitDetailView';
import { useUnitDetails } from '../hooks/useUnitDetails';
import DataState from './DataState';

/**
 * Example 1: Complete Unit Detail Page
 */
export function UnitDetailPageExample() {
  const { unitId } = useParams();
  const navigate = useNavigate();

  // Fetch all unit-related data with a single hook
  const {
    unit,
    property,
    tenants,
    jobs,
    inspections,
    serviceRequests,
    leaseInfo,
    isLoading,
    error,
    refetchAll,
  } = useUnitDetails(unitId);

  // Handlers
  const handleEdit = () => {
    navigate(`/units/${unitId}/edit`);
  };

  const handleMoveIn = () => {
    navigate(`/units/${unitId}/move-in`);
  };

  const handleMoveOut = () => {
    navigate(`/units/${unitId}/move-out`);
  };

  // Loading state
  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState
          type="error"
          message="Failed to load unit details"
          onRetry={refetchAll}
        />
      </Container>
    );
  }

  // Not found state
  if (!unit) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState
          type="empty"
          message="Unit not found"
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <UnitDetailView
        unit={unit}
        property={property}
        tenants={tenants}
        jobs={jobs}
        inspections={inspections}
        serviceRequests={serviceRequests}
        leaseInfo={leaseInfo}
        onEdit={handleEdit}
        onMoveIn={handleMoveIn}
        onMoveOut={handleMoveOut}
      />
    </Container>
  );
}

/**
 * Example 2: Unit Detail with Custom Actions
 */
export function UnitDetailWithCustomActionsExample() {
  const { unitId } = useParams();
  const navigate = useNavigate();

  const {
    unit,
    property,
    tenants,
    jobs,
    inspections,
    serviceRequests,
    leaseInfo,
    isLoading,
  } = useUnitDetails(unitId);

  if (isLoading) return <CircularProgress />;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <UnitDetailView
        unit={unit}
        property={property}
        tenants={tenants}
        jobs={jobs}
        inspections={inspections}
        serviceRequests={serviceRequests}
        leaseInfo={leaseInfo}
        onEdit={() => console.log('Edit unit')}
        onMoveIn={() => console.log('Move in tenant')}
        onMoveOut={() => console.log('Move out tenant')}
      />
    </Container>
  );
}

/**
 * Example 3: Sample Data Structure
 * 
 * This shows what the data should look like when passed to UnitDetailView
 */
export const sampleUnitData = {
  unit: {
    id: '204',
    unitNumber: '204',
    propertyId: '1',
    bedrooms: 2,
    bathrooms: 1,
    squareFeet: 850,
    floor: 2,
    status: 'OCCUPIED',
    monthlyRent: 1500,
    amenities: ['Balcony', 'Dishwasher', 'In-unit Laundry'],
    description: 'Spacious 2-bedroom unit with modern amenities',
  },
  property: {
    id: '1',
    name: 'Sunset Apartments',
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
  },
  tenants: [
    {
      id: '5',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '555-0123',
      isActive: true,
      lease: {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        monthlyRent: 1500,
        securityDeposit: 1500,
      },
    },
  ],
  jobs: [
    {
      id: '12',
      title: 'Fix Leaky Faucet',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      scheduledDate: '2024-12-15',
    },
    {
      id: '13',
      title: 'Replace Air Filter',
      status: 'COMPLETED',
      priority: 'NORMAL',
      completedDate: '2024-12-01',
    },
  ],
  inspections: [
    {
      id: '3',
      title: 'Routine Inspection',
      status: 'SCHEDULED',
      scheduledDate: '2024-12-20',
      type: 'ROUTINE',
    },
  ],
  serviceRequests: [
    {
      id: '8',
      title: 'Leaky Kitchen Faucet',
      status: 'CONVERTED_TO_JOB',
      category: 'PLUMBING',
      submittedDate: '2024-12-10',
    },
  ],
  leaseInfo: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    monthlyRent: 1500,
    securityDeposit: 1500,
  },
};

/**
 * BENEFITS OF CONSOLIDATED VIEW:
 * 
 * 1. SINGLE SOURCE OF TRUTH
 *    - All unit data in one place
 *    - No need to navigate between pages
 *    - Complete context at a glance
 * 
 * 2. EFFICIENT DATA LOADING
 *    - Single hook fetches all related data
 *    - Parallel requests for better performance
 *    - Automatic caching with React Query
 * 
 * 3. BETTER USER EXPERIENCE
 *    - Tabbed interface for organization
 *    - Quick metrics at the top
 *    - Related entities easily accessible
 *    - Breadcrumb navigation for context
 * 
 * 4. ACTIONABLE INSIGHTS
 *    - See active jobs at a glance
 *    - Pending requests highlighted
 *    - Upcoming inspections visible
 *    - Quick actions (Move In/Out, Edit)
 * 
 * 5. CONSISTENT LAYOUT
 *    - Same structure across all units
 *    - Predictable information hierarchy
 *    - Familiar navigation patterns
 */
