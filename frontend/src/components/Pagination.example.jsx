/**
 * EXAMPLE USAGE OF PAGINATION COMPONENTS
 * 
 * This file demonstrates how to implement pagination in entity lists
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Grid, Card, CardContent, Typography } from '@mui/material';
import { usePagination } from '../hooks/usePagination';
import PaginationControls, { PaginationInfo } from './PaginationControls';
import { apiClient } from '../api/client';

/**
 * Example 1: Client-Side Pagination (data fetched once, paginated in frontend)
 */
export function ClientSidePaginationExample() {
  // Fetch all data
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return response.data?.properties || [];
    },
  });

  // Pagination hook
  const {
    page,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    changePageSize,
  } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
    totalItems: allItems.length,
  });

  // Slice data for current page
  const paginatedItems = allItems.slice(startIndex, endIndex);

  if (isLoading) return <div>Loading...</div>;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Properties ({allItems.length})
      </Typography>

      {/* Display items */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {paginatedItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.address}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination controls */}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalItems={allItems.length}
        totalPages={totalPages}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        variant="standard"
      />
    </Box>
  );
}

/**
 * Example 2: Server-Side Pagination (backend handles pagination)
 */
export function ServerSidePaginationExample() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch paginated data from server
  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, pageSize],
    queryFn: async () => {
      const response = await apiClient.get(`/jobs?page=${page}&limit=${pageSize}`);
      return response.data;
    },
    keepPreviousData: true, // Keep showing old data while fetching new page
  });

  const items = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Jobs
      </Typography>

      {/* Display items */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              items.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.title}</TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>{job.priority}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Table variant pagination */}
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          variant="table"
        />
      </TableContainer>
    </Box>
  );
}

/**
 * Example 3: Compact Pagination (minimal UI)
 */
export function CompactPaginationExample() {
  const { data: allItems = [] } = useQuery({
    queryKey: ['inspections'],
    queryFn: async () => {
      const response = await apiClient.get('/inspections');
      return response.data?.inspections || [];
    },
  });

  const {
    page,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
  } = usePagination({
    initialPage: 1,
    initialPageSize: 5,
    totalItems: allItems.length,
  });

  const paginatedItems = allItems.slice(startIndex, endIndex);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Recent Inspections
      </Typography>

      {/* Items list */}
      {paginatedItems.map((item) => (
        <Box key={item.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2">{item.title}</Typography>
        </Box>
      ))}

      {/* Compact pagination */}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalItems={allItems.length}
        totalPages={totalPages}
        onPageChange={goToPage}
        onPageSizeChange={() => {}} // Not changeable in compact mode
        variant="compact"
      />
    </Paper>
  );
}

/**
 * Example 4: Using Pagination with Filters
 */
export function PaginationWithFiltersExample() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('');

  // Fetch filtered and paginated data
  const { data } = useQuery({
    queryKey: ['service-requests', page, pageSize, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(status && { status }),
      });
      const response = await apiClient.get(`/service-requests?${params}`);
      return response.data;
    },
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const handleFilterChange = (newStatus) => {
    setStatus(newStatus);
    setPage(1); // Reset to first page when filter changes
  };

  return (
    <Box>
      {/* Filter controls */}
      <Box sx={{ mb: 2 }}>
        <button onClick={() => handleFilterChange('')}>All</button>
        <button onClick={() => handleFilterChange('SUBMITTED')}>Submitted</button>
        <button onClick={() => handleFilterChange('APPROVED')}>Approved</button>
      </Box>

      {/* Items */}
      <Box sx={{ mb: 2 }}>
        {items.map((item) => (
          <div key={item.id}>{item.title}</div>
        ))}
      </Box>

      {/* Pagination */}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />
    </Box>
  );
}

/**
 * Example 5: Just showing pagination info (no controls)
 */
export function PaginationInfoExample() {
  const startIndex = 0;
  const endIndex = 10;
  const totalItems = 156;

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      <PaginationInfo
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
      />
    </Box>
  );
}

/**
 * INTEGRATION GUIDELINES:
 * 
 * 1. CLIENT-SIDE PAGINATION
 *    - Use when total data is small (<1000 items)
 *    - Fetch all data once
 *    - Use usePagination hook to slice data
 *    - Fast page changes (no API calls)
 * 
 * 2. SERVER-SIDE PAGINATION
 *    - Use for large datasets (>1000 items)
 *    - Backend returns: { items: [], total: number, page: number }
 *    - Pass page and limit to API
 *    - Use keepPreviousData in React Query
 * 
 * 3. VARIANT SELECTION
 *    - 'standard': Full-featured, use for main list pages
 *    - 'table': Use with Material-UI Table components
 *    - 'compact': Use in sidebars or small spaces
 * 
 * 4. WITH FILTERS
 *    - Reset to page 1 when filters change
 *    - Include filter params in query key
 *    - Use keepPreviousData for smooth transitions
 * 
 * 5. PAGE SIZE OPTIONS
 *    - Default: [10, 25, 50, 100]
 *    - Customize based on content type
 *    - Smaller for cards, larger for tables
 */
