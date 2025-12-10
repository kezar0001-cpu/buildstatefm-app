import {
  Box,
  TablePagination,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  Typography,
  IconButton,
  Stack,
} from '@mui/material';
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { PAGE_SIZE_OPTIONS, getPaginationText } from '../hooks/usePagination';

/**
 * Pagination Controls Component
 * Provides consistent pagination UI across all entity lists
 * 
 * @param {Object} props
 * @param {number} props.page - Current page (1-indexed)
 * @param {number} props.pageSize - Items per page
 * @param {number} props.totalItems - Total number of items
 * @param {number} props.totalPages - Total number of pages
 * @param {Function} props.onPageChange - Page change handler
 * @param {Function} props.onPageSizeChange - Page size change handler
 * @param {string} props.variant - Display variant: 'standard', 'compact', 'table'
 * @param {boolean} props.showFirstLast - Show first/last page buttons
 * @param {Array} props.pageSizeOptions - Available page size options
 */
export default function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  variant = 'standard',
  showFirstLast = true,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Table variant (Material-UI TablePagination)
  if (variant === 'table') {
    return (
      <TablePagination
        component="div"
        count={totalItems}
        page={page - 1} // TablePagination uses 0-indexed pages
        onPageChange={(e, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={pageSizeOptions}
        labelRowsPerPage="Items per page:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          '.MuiTablePagination-toolbar': {
            px: 2,
          },
        }}
      />
    );
  }

  // Compact variant (minimal controls)
  if (variant === 'compact') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {getPaginationText(startIndex, endIndex, totalItems)}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <NavigateBeforeIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            <NavigateNextIcon />
          </IconButton>
        </Stack>
      </Box>
    );
  }

  // Standard variant (full controls)
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        py: 2,
        px: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Items info and page size selector */}
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ flexWrap: 'wrap', gap: 1 }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {getPaginationText(startIndex, endIndex, totalItems)}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            sx={{
              '& .MuiSelect-select': {
                py: 0.75,
                fontSize: '0.875rem',
              },
            }}
          >
            {pageSizeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option} per page
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Pagination controls */}
      <Stack direction="row" spacing={1} alignItems="center">
        {showFirstLast && (
          <IconButton
            size="small"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <FirstPageIcon fontSize="small" />
          </IconButton>
        )}
        <Pagination
          count={totalPages}
          page={page}
          onChange={(e, newPage) => onPageChange(newPage)}
          color="primary"
          shape="rounded"
          siblingCount={1}
          boundaryCount={1}
          showFirstButton={false}
          showLastButton={false}
          sx={{
            '& .MuiPaginationItem-root': {
              borderRadius: 1,
            },
          }}
        />
        {showFirstLast && (
          <IconButton
            size="small"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <LastPageIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}

/**
 * Simple Pagination Info Component
 * Shows just the pagination text without controls
 */
export function PaginationInfo({ startIndex, endIndex, totalItems }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {getPaginationText(startIndex, endIndex, totalItems)}
    </Typography>
  );
}
