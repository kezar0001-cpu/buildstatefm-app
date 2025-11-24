
import React from 'react';
import { Grid, Typography, Divider, Box } from '@mui/material';
import { FormTextField, FormSelect, FormAreaField } from '../form';
import { PROPERTY_STATUS_OPTIONS } from '../../constants/propertyStatus';

const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Mixed-Use',
  'Industrial',
  'Retail',
  'Office',
];

const PROPERTY_STATUSES = PROPERTY_STATUS_OPTIONS;

const CONSTRUCTION_TYPES = [
  'Wood Frame',
  'Concrete',
  'Steel Frame',
  'Brick',
  'Stone',
  'Mixed',
  'Other',
];

const HEATING_SYSTEMS = [
  'Central Heating',
  'Forced Air',
  'Radiant',
  'Heat Pump',
  'Baseboard',
  'Geothermal',
  'None',
  'Other',
];

const COOLING_SYSTEMS = [
  'Central Air',
  'Window Units',
  'Split System',
  'Heat Pump',
  'Evaporative',
  'Geothermal',
  'None',
  'Other',
];

const PropertyBasicInfo = ({ control }) => (
  <Grid container spacing={2}>
    {/* Basic Information Section */}
    <Grid item xs={12}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Basic Information
      </Typography>
    </Grid>

    <Grid item xs={12}>
      <FormTextField
        name="name"
        control={control}
        label="Property Name"
        required
      />
    </Grid>
    <Grid item xs={12} sm={6}>
      <FormSelect
        name="propertyType"
        control={control}
        label="Property Type"
        options={PROPERTY_TYPES}
        required
      />
    </Grid>
    <Grid item xs={12} sm={6}>
      <FormSelect
        name="status"
        control={control}
        label="Status"
        options={PROPERTY_STATUSES}
      />
    </Grid>
    <Grid item xs={12}>
      <FormTextField
        name="description"
        control={control}
        label="Description"
        multiline
        rows={3}
      />
    </Grid>

    {/* Property Dimensions Section */}
    <Grid item xs={12}>
      <Box sx={{ mt: 2, mb: 1 }}>
        <Divider />
      </Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Property Dimensions
      </Typography>
    </Grid>

    <Grid item xs={12} sm={4}>
      <FormAreaField
        name="totalArea"
        control={control}
        label="Total Area"
        helperText="Total property area"
      />
    </Grid>
    <Grid item xs={12} sm={4}>
      <FormAreaField
        name="lotSize"
        control={control}
        label="Lot Size"
        helperText="Land area"
      />
    </Grid>
    <Grid item xs={12} sm={4}>
      <FormAreaField
        name="buildingSize"
        control={control}
        label="Building Size"
        helperText="Building footprint area"
      />
    </Grid>

    {/* Building Details Section */}
    <Grid item xs={12}>
      <Box sx={{ mt: 2, mb: 1 }}>
        <Divider />
      </Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Building Details
      </Typography>
    </Grid>

    <Grid item xs={12} sm={6}>
      <FormTextField
        name="yearBuilt"
        control={control}
        label="Year Built"
        type="number"
        helperText="Construction year"
      />
    </Grid>
    <Grid item xs={12} sm={6}>
      <FormTextField
        name="numberOfFloors"
        control={control}
        label="Number of Floors"
        type="number"
        helperText="Total floors in building"
      />
    </Grid>

    <Grid item xs={12} sm={4}>
      <FormSelect
        name="constructionType"
        control={control}
        label="Construction Type"
        options={CONSTRUCTION_TYPES}
        helperText="Primary construction material"
      />
    </Grid>
    <Grid item xs={12} sm={4}>
      <FormSelect
        name="heatingSystem"
        control={control}
        label="Heating System"
        options={HEATING_SYSTEMS}
        helperText="Primary heating system"
      />
    </Grid>
    <Grid item xs={12} sm={4}>
      <FormSelect
        name="coolingSystem"
        control={control}
        label="Cooling System"
        options={COOLING_SYSTEMS}
        helperText="Primary cooling system"
      />
    </Grid>
  </Grid>
);

export default PropertyBasicInfo;
