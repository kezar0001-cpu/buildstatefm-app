/**
 * EXAMPLE USAGE OF SIMPLIFIED WIZARD COMPONENT
 * 
 * This file demonstrates how to create multi-step forms using the Wizard component
 */

import { useState } from 'react';
import Wizard from './Wizard';
import WizardField, { WizardFieldGroup } from './WizardField';
import { Stack, Typography, Box, Chip } from '@mui/material';

/**
 * Example 1: Property Creation Wizard
 */
export function PropertyCreationWizardExample() {
  const steps = [
    {
      label: 'Basic Information',
      description: 'Enter the basic details about your property',
      content: ({ data = {}, onChange }) => (
        <WizardFieldGroup title="Property Details">
          <WizardField
            type="text"
            name="name"
            label="Property Name"
            value={data.name}
            onChange={onChange}
            required
            helperText="A descriptive name for your property"
          />
          <WizardField
            type="select"
            name="type"
            label="Property Type"
            value={data.type}
            onChange={onChange}
            required
            options={[
              { value: 'APARTMENT', label: 'Apartment Complex' },
              { value: 'HOUSE', label: 'Single Family Home' },
              { value: 'CONDO', label: 'Condominium' },
              { value: 'COMMERCIAL', label: 'Commercial Building' },
            ]}
          />
          <WizardField
            type="number"
            name="units"
            label="Number of Units"
            value={data.units}
            onChange={onChange}
            required
            inputProps={{ min: 1 }}
          />
        </WizardFieldGroup>
      ),
      validate: (data) => {
        if (!data?.name) return 'Property name is required';
        if (!data?.type) return 'Property type is required';
        if (!data?.units || data.units < 1) return 'Number of units must be at least 1';
        return null;
      },
    },
    {
      label: 'Address',
      description: 'Provide the property address',
      content: ({ data = {}, onChange }) => (
        <WizardFieldGroup title="Location Details">
          <WizardField
            type="text"
            name="street"
            label="Street Address"
            value={data.street}
            onChange={onChange}
            required
          />
          <Stack direction="row" spacing={2}>
            <WizardField
              type="text"
              name="city"
              label="City"
              value={data.city}
              onChange={onChange}
              required
            />
            <WizardField
              type="text"
              name="state"
              label="State"
              value={data.state}
              onChange={onChange}
              required
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <WizardField
              type="text"
              name="zip"
              label="ZIP Code"
              value={data.zip}
              onChange={onChange}
              required
            />
            <WizardField
              type="text"
              name="country"
              label="Country"
              value={data.country}
              onChange={onChange}
              required
            />
          </Stack>
        </WizardFieldGroup>
      ),
      validate: (data) => {
        if (!data?.street) return 'Street address is required';
        if (!data?.city) return 'City is required';
        if (!data?.state) return 'State is required';
        if (!data?.zip) return 'ZIP code is required';
        return null;
      },
    },
    {
      label: 'Additional Details',
      description: 'Optional information about your property',
      optional: true,
      content: ({ data = {}, onChange }) => (
        <WizardFieldGroup title="Property Features">
          <WizardField
            type="textarea"
            name="description"
            label="Description"
            value={data.description}
            onChange={onChange}
            helperText="Describe the property and its amenities"
          />
          <WizardField
            type="number"
            name="yearBuilt"
            label="Year Built"
            value={data.yearBuilt}
            onChange={onChange}
            inputProps={{ min: 1800, max: new Date().getFullYear() }}
          />
          <WizardField
            type="checkbox"
            name="hasParking"
            label="Has Parking"
            value={data.hasParking}
            onChange={onChange}
          />
          <WizardField
            type="checkbox"
            name="hasElevator"
            label="Has Elevator"
            value={data.hasElevator}
            onChange={onChange}
          />
        </WizardFieldGroup>
      ),
    },
    {
      label: 'Review',
      description: 'Review your property details before submitting',
      content: ({ allData }) => (
        <Box>
          <Typography variant="h6" gutterBottom>
            Review Property Information
          </Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <ReviewItem label="Property Name" value={allData[0]?.name} />
            <ReviewItem label="Type" value={allData[0]?.type} />
            <ReviewItem label="Units" value={allData[0]?.units} />
            <ReviewItem
              label="Address"
              value={`${allData[1]?.street}, ${allData[1]?.city}, ${allData[1]?.state} ${allData[1]?.zip}`}
            />
            {allData[2]?.description && (
              <ReviewItem label="Description" value={allData[2]?.description} />
            )}
            {allData[2]?.yearBuilt && (
              <ReviewItem label="Year Built" value={allData[2]?.yearBuilt} />
            )}
          </Stack>
        </Box>
      ),
    },
  ];

  const handleComplete = async (data) => {
    console.log('Property creation completed:', data);
    // Submit to API
  };

  return (
    <Wizard
      title="Create New Property"
      subtitle="Follow these steps to add a new property to your portfolio"
      steps={steps}
      onComplete={handleComplete}
      showProgress={true}
      orientation="vertical"
    />
  );
}

/**
 * Example 2: Move-In Wizard (Simplified)
 */
export function MoveInWizardExample() {
  const steps = [
    {
      label: 'Tenant Information',
      description: 'Enter tenant details',
      content: ({ data = {}, onChange }) => (
        <Stack spacing={2.5}>
          <WizardField
            type="text"
            name="firstName"
            label="First Name"
            value={data.firstName}
            onChange={onChange}
            required
          />
          <WizardField
            type="text"
            name="lastName"
            label="Last Name"
            value={data.lastName}
            onChange={onChange}
            required
          />
          <WizardField
            type="email"
            name="email"
            label="Email"
            value={data.email}
            onChange={onChange}
            required
          />
          <WizardField
            type="tel"
            name="phone"
            label="Phone"
            value={data.phone}
            onChange={onChange}
            required
          />
        </Stack>
      ),
      validate: (data) => {
        if (!data?.firstName || !data?.lastName) return 'Name is required';
        if (!data?.email) return 'Email is required';
        if (!data?.phone) return 'Phone is required';
        return null;
      },
    },
    {
      label: 'Lease Details',
      description: 'Set up the lease agreement',
      content: ({ data = {}, onChange }) => (
        <Stack spacing={2.5}>
          <WizardField
            type="date"
            name="startDate"
            label="Lease Start Date"
            value={data.startDate}
            onChange={onChange}
            required
          />
          <WizardField
            type="date"
            name="endDate"
            label="Lease End Date"
            value={data.endDate}
            onChange={onChange}
            required
          />
          <WizardField
            type="number"
            name="rent"
            label="Monthly Rent"
            value={data.rent}
            onChange={onChange}
            required
            inputProps={{ min: 0, step: 0.01 }}
          />
          <WizardField
            type="number"
            name="deposit"
            label="Security Deposit"
            value={data.deposit}
            onChange={onChange}
            required
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Stack>
      ),
      validate: (data) => {
        if (!data?.startDate || !data?.endDate) return 'Lease dates are required';
        if (!data?.rent || data.rent <= 0) return 'Monthly rent must be greater than 0';
        return null;
      },
    },
    {
      label: 'Schedule Inspection',
      description: 'Optional move-in inspection',
      optional: true,
      content: ({ data = {}, onChange }) => (
        <Stack spacing={2.5}>
          <WizardField
            type="switch"
            name="scheduleInspection"
            label="Schedule Move-In Inspection"
            value={data.scheduleInspection}
            onChange={onChange}
          />
          {data.scheduleInspection && (
            <>
              <WizardField
                type="date"
                name="inspectionDate"
                label="Inspection Date"
                value={data.inspectionDate}
                onChange={onChange}
                required
              />
              <WizardField
                type="textarea"
                name="inspectionNotes"
                label="Notes"
                value={data.inspectionNotes}
                onChange={onChange}
              />
            </>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Wizard
      title="Move-In Wizard"
      subtitle="Complete the tenant move-in process"
      steps={steps}
      onComplete={(data) => console.log('Move-in completed:', data)}
      orientation="horizontal"
    />
  );
}

/**
 * Helper component for review step
 */
function ReviewItem({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}:
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value || 'Not provided'}
      </Typography>
    </Box>
  );
}
