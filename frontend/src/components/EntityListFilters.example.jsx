/**
 * EXAMPLE USAGE OF EntityListFilters COMPONENT
 * 
 * This file demonstrates how to integrate the unified filter component
 * into your entity list pages (Properties, Jobs, Inspections, etc.)
 */

import { useState } from 'react';
import EntityListFilters from './EntityListFilters';

// Example for Jobs Page
export function JobsPageExample() {
  const [searchValue, setSearchValue] = useState('');
  const [filterValues, setFilterValues] = useState({
    status: '',
    priority: '',
    assignedTo: '',
    scheduledAfter: '',
    scheduledBefore: '',
  });

  // Define filter configurations
  const jobFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'OPEN', label: 'Open' },
        { value: 'ASSIGNED', label: 'Assigned' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'URGENT', label: 'Urgent' },
      ],
    },
    {
      key: 'scheduledAfter',
      label: 'Scheduled After',
      type: 'date',
    },
    {
      key: 'scheduledBefore',
      label: 'Scheduled Before',
      type: 'date',
    },
  ];

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setFilterValues({
      status: '',
      priority: '',
      assignedTo: '',
      scheduledAfter: '',
      scheduledBefore: '',
    });
  };

  return (
    <EntityListFilters
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filters={jobFilters}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      onClearFilters={handleClearFilters}
      searchPlaceholder="Search jobs by title, description, or property..."
    />
  );
}

// Example for Properties Page
export function PropertiesPageExample() {
  const [searchValue, setSearchValue] = useState('');
  const [filterValues, setFilterValues] = useState({
    status: '',
    city: '',
    minUnits: '',
    maxUnits: '',
  });

  const propertyFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' },
        { value: 'MAINTENANCE', label: 'Under Maintenance' },
      ],
    },
    {
      key: 'minUnits',
      label: 'Min Units',
      type: 'number',
      inputProps: {
        min: 0,
      },
    },
    {
      key: 'maxUnits',
      label: 'Max Units',
      type: 'number',
      inputProps: {
        min: 0,
      },
    },
  ];

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setFilterValues({
      status: '',
      city: '',
      minUnits: '',
      maxUnits: '',
    });
  };

  return (
    <EntityListFilters
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filters={propertyFilters}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      onClearFilters={handleClearFilters}
      searchPlaceholder="Search properties by name, address, or city..."
    />
  );
}

// Example for Service Requests Page
export function ServiceRequestsPageExample() {
  const [searchValue, setSearchValue] = useState('');
  const [filterValues, setFilterValues] = useState({
    status: '',
    category: '',
    priority: '',
    submittedAfter: '',
  });

  const serviceRequestFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'SUBMITTED', label: 'Submitted' },
        { value: 'UNDER_REVIEW', label: 'Under Review' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'CONVERTED_TO_JOB', label: 'Converted to Job' },
        { value: 'COMPLETED', label: 'Completed' },
      ],
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'PLUMBING', label: 'Plumbing' },
        { value: 'ELECTRICAL', label: 'Electrical' },
        { value: 'HVAC', label: 'HVAC' },
        { value: 'APPLIANCE', label: 'Appliance' },
        { value: 'STRUCTURAL', label: 'Structural' },
        { value: 'PEST_CONTROL', label: 'Pest Control' },
        { value: 'LANDSCAPING', label: 'Landscaping' },
        { value: 'GENERAL', label: 'General' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'URGENT', label: 'Urgent' },
      ],
    },
    {
      key: 'submittedAfter',
      label: 'Submitted After',
      type: 'date',
    },
  ];

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setFilterValues({
      status: '',
      category: '',
      priority: '',
      submittedAfter: '',
    });
  };

  return (
    <EntityListFilters
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filters={serviceRequestFilters}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      onClearFilters={handleClearFilters}
      searchPlaceholder="Search service requests by title or description..."
    />
  );
}

// Example for Inspections Page
export function InspectionsPageExample() {
  const [searchValue, setSearchValue] = useState('');
  const [filterValues, setFilterValues] = useState({
    status: '',
    type: '',
    scheduledAfter: '',
    scheduledBefore: '',
  });

  const inspectionFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'SCHEDULED', label: 'Scheduled' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'MOVE_IN', label: 'Move-in' },
        { value: 'MOVE_OUT', label: 'Move-out' },
        { value: 'ROUTINE', label: 'Routine' },
        { value: 'EMERGENCY', label: 'Emergency' },
      ],
    },
    {
      key: 'scheduledAfter',
      label: 'Scheduled After',
      type: 'date',
    },
    {
      key: 'scheduledBefore',
      label: 'Scheduled Before',
      type: 'date',
    },
  ];

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setFilterValues({
      status: '',
      type: '',
      scheduledAfter: '',
      scheduledBefore: '',
    });
  };

  return (
    <EntityListFilters
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filters={inspectionFilters}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      onClearFilters={handleClearFilters}
      searchPlaceholder="Search inspections by title or property..."
    />
  );
}
