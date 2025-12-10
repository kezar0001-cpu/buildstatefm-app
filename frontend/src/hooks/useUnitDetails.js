import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';

/**
 * Custom hook to fetch and consolidate all unit-related data
 * 
 * @param {string} unitId - Unit ID
 * @returns {Object} Consolidated unit data and loading states
 */
export function useUnitDetails(unitId) {
  // Fetch unit data
  const {
    data: unit,
    isLoading: unitLoading,
    error: unitError,
    refetch: refetchUnit,
  } = useQuery({
    queryKey: queryKeys.units.detail(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/units/${unitId}`);
      return response.data?.unit || response.data;
    },
    enabled: !!unitId,
  });

  // Fetch property data
  const {
    data: property,
    isLoading: propertyLoading,
  } = useQuery({
    queryKey: queryKeys.properties.detail(unit?.propertyId),
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${unit.propertyId}`);
      return response.data?.property || response.data;
    },
    enabled: !!unit?.propertyId,
  });

  // Fetch current tenants
  const {
    data: tenants = [],
    isLoading: tenantsLoading,
    refetch: refetchTenants,
  } = useQuery({
    queryKey: queryKeys.units.tenants(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/units/${unitId}/tenants`);
      return response.data?.tenants || response.data || [];
    },
    enabled: !!unitId,
  });

  // Fetch related jobs
  const {
    data: jobs = [],
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: queryKeys.jobs.byUnit(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/jobs?unitId=${unitId}`);
      return response.data?.jobs || response.data?.items || response.data || [];
    },
    enabled: !!unitId,
  });

  // Fetch related inspections
  const {
    data: inspections = [],
    isLoading: inspectionsLoading,
    refetch: refetchInspections,
  } = useQuery({
    queryKey: queryKeys.inspections.byUnit(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections?unitId=${unitId}`);
      return response.data?.inspections || response.data?.items || response.data || [];
    },
    enabled: !!unitId,
  });

  // Fetch related service requests
  const {
    data: serviceRequests = [],
    isLoading: serviceRequestsLoading,
    refetch: refetchServiceRequests,
  } = useQuery({
    queryKey: queryKeys.serviceRequests.byUnit(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/service-requests?unitId=${unitId}`);
      return response.data?.serviceRequests || response.data?.items || response.data || [];
    },
    enabled: !!unitId,
  });

  // Get current lease info from active tenant
  const leaseInfo = tenants.find((t) => t.isActive)?.lease || null;

  // Aggregate loading state
  const isLoading =
    unitLoading ||
    propertyLoading ||
    tenantsLoading ||
    jobsLoading ||
    inspectionsLoading ||
    serviceRequestsLoading;

  // Refetch all data
  const refetchAll = () => {
    refetchUnit();
    refetchTenants();
    refetchJobs();
    refetchInspections();
    refetchServiceRequests();
  };

  return {
    // Data
    unit,
    property,
    tenants,
    jobs,
    inspections,
    serviceRequests,
    leaseInfo,

    // Loading states
    isLoading,
    unitLoading,
    propertyLoading,
    tenantsLoading,
    jobsLoading,
    inspectionsLoading,
    serviceRequestsLoading,

    // Error
    error: unitError,

    // Refetch functions
    refetchAll,
    refetchUnit,
    refetchTenants,
    refetchJobs,
    refetchInspections,
    refetchServiceRequests,
  };
}

/**
 * Custom hook to fetch unit summary statistics
 * 
 * @param {string} unitId - Unit ID
 * @returns {Object} Unit statistics
 */
export function useUnitStats(unitId) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.units.stats(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/units/${unitId}/stats`);
      return response.data?.stats || response.data;
    },
    enabled: !!unitId,
  });

  return {
    stats: data,
    isLoading,
    error,
  };
}
