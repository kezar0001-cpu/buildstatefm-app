import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from '@mui/material';
import {
  Home as HomeIcon,
  Build as BuildIcon,
  Assessment as AssessmentIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import { format } from 'date-fns';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import Breadcrumbs from '../components/Breadcrumbs';
import PageShell from '../components/PageShell';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  // Fetch properties owned by user
  const { data: properties = [], isLoading: propertiesLoading, error: propertiesError } = useQuery({
    queryKey: queryKeys.dashboard.ownerProperties(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return ensureArray(response.data, ['items', 'data.items', 'properties']);
    },
  });

  // Fetch jobs for owned properties
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: queryKeys.jobs.owner(),
    queryFn: async () => {
      const response = await apiClient.get('/jobs');
      return ensureArray(response.data, ['items', 'data.items', 'jobs']);
    },
  });

  // Fetch inspections for owned properties
  const { data: inspections = [], isLoading: inspectionsLoading } = useQuery({
    queryKey: queryKeys.inspections.owner(),
    queryFn: async () => {
      const response = await apiClient.get('/inspections');
      return ensureArray(response.data, ['items', 'data.items', 'inspections']);
    },
  });

  const totalProperties = properties.length;
  const totalUnits = properties.reduce((sum, p) => sum + (p.totalUnits || 0), 0);
  const activeJobs = jobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length;
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs
        labelOverrides={{
          '/owner/dashboard': 'Owner Dashboard',
        }}
      />
      <PageShell
        title="Owner Dashboard"
        subtitle="View your properties, jobs, and inspections"
        contentSpacing={{ xs: 3, md: 3 }}
      >

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <HomeIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{totalProperties}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Properties
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <HomeIcon color="info" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{totalUnits}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Units
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BuildIcon color="warning" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{activeJobs}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Jobs
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <AssessmentIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{completedJobs}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed Jobs
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Properties" />
            <Tab label="Jobs" />
            <Tab label="Inspections" />
          </Tabs>
        </Box>

        {/* Properties Tab */}
        <TabPanel value={tabValue} index={0}>
          <DataState
            data={properties}
            isLoading={propertiesLoading}
            error={propertiesError}
            emptyMessage="No properties found"
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Property Name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Units</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {properties.map((property) => (
                    <TableRow key={property.id}>
                      <TableCell>{property.name}</TableCell>
                      <TableCell>
                        {property.city}, {property.state}
                      </TableCell>
                      <TableCell>{property.propertyType}</TableCell>
                      <TableCell>{property.totalUnits || 0}</TableCell>
                      <TableCell>
                        <Chip 
                          label={property.status} 
                          color={property.status === 'ACTIVE' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/properties/${property.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DataState>
        </TabPanel>

        {/* Jobs Tab */}
        <TabPanel value={tabValue} index={1}>
          <DataState
            data={jobs}
            isLoading={jobsLoading}
            emptyMessage="No jobs found"
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Scheduled Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{job.title}</TableCell>
                      <TableCell>{job.property?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={job.priority} 
                          color={job.priority === 'URGENT' ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.status} 
                          color={job.status === 'COMPLETED' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {job.scheduledDate 
                          ? format(new Date(job.scheduledDate), 'MMM dd, yyyy')
                          : 'Not scheduled'
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/jobs/${job.id}`, { state: { from: '/owner/dashboard' } })}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DataState>
        </TabPanel>

        {/* Inspections Tab */}
        <TabPanel value={tabValue} index={2}>
          <DataState
            data={inspections}
            isLoading={inspectionsLoading}
            emptyMessage="No inspections found"
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Scheduled Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inspections.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell>{inspection.title}</TableCell>
                      <TableCell>{inspection.property?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip label={inspection.type} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={inspection.status} 
                          color={inspection.status === 'COMPLETED' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {format(new Date(inspection.scheduledDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/inspections/${inspection.id}/report`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DataState>
        </TabPanel>
      </Card>
      </PageShell>
    </Container>
  );
}
