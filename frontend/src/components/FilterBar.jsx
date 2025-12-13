import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Checkbox,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
  ViewKanban as ViewKanbanIcon,
} from '@mui/icons-material';

/**
 * FilterBar Component
 *
 * A reusable, responsive filter bar component for list pages.
 * Handles search, filters, view mode toggle, and mobile responsiveness.
 *
 * @component
 * @param {Object} props
 * @param {string} props.searchValue - Current search input value
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {Function} props.onSearchClear - Callback to clear search
 * @param {Array} props.filters - Array of filter configurations
 * @param {Object} props.filterValues - Current filter values
 * @param {Function} props.onFilterChange - Callback when filter changes
 * @param {Function} props.onClearFilters - Callback to clear all filters
 * @param {string} props.viewMode - Current view mode ('grid', 'list', 'table', 'kanban')
 * @param {Function} props.onViewModeChange - Callback when view mode changes
 * @param {string} props.searchPlaceholder - Placeholder text for search input
 * @param {boolean} props.showViewToggle - Whether to show view mode toggle (default: true)
 * @param {Array} props.viewModes - Available view modes (default: ['grid', 'list', 'table'])
 * @param {Object} props.viewModeIcons - Custom icons for view modes
 * @param {boolean} props.showMobileFilters - Whether to show filters on mobile (default: true)
 *
 * @example
 * const [filters, setFilters] = useState({ status: '', priority: '' });
 * const [searchTerm, setSearchTerm] = useState('');
 * const [viewMode, setViewMode] = useState('grid');
 *
 * const filterConfig = [
 *   {
 *     key: 'status',
 *     label: 'Status',
 *     type: 'select',
 *     options: [
 *       { value: '', label: 'All Statuses' },
 *       { value: 'ACTIVE', label: 'Active' },
 *       { value: 'INACTIVE', label: 'Inactive' },
 *     ],
 *   },
 *   {
 *     key: 'priority',
 *     label: 'Priority',
 *     type: 'select',
 *     options: [
 *       { value: '', label: 'All' },
 *       { value: 'HIGH', label: 'High' },
 *       { value: 'LOW', label: 'Low' },
 *     ],
 *   },
 *   {
 *     key: 'archived',
 *     label: 'Show Archived',
 *     type: 'checkbox',
 *   },
 * ];
 *
 * <FilterBar
 *   searchValue={searchTerm}
 *   onSearchChange={(e) => setSearchTerm(e.target.value)}
 *   onSearchClear={() => setSearchTerm('')}
 *   filters={filterConfig}
 *   filterValues={filters}
 *   onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
 *   onClearFilters={() => setFilters({ status: '', priority: '' })}
 *   viewMode={viewMode}
 *   onViewModeChange={(_, newMode) => newMode && setViewMode(newMode)}
 *   searchPlaceholder="Search properties..."
 * />
 */
const FilterBar = ({
  searchValue = '',
  onSearchChange,
  onSearchClear,
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,
  viewMode = 'grid',
  onViewModeChange,
  searchPlaceholder = 'Search...',
  showViewToggle = true,
  viewModes = ['grid', 'list', 'table'],
  viewModeIcons = {},
  showMobileFilters = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    filters.forEach((filter) => {
      const value = filterValues[filter.key];
      if (filter.type === 'checkbox') {
        if (value) count += 1;
      } else if (value && value !== '' && value !== 'all') {
        count += 1;
      }
    });
    return count;
  }, [filters, filterValues]);

  const hasFilters = !!searchValue || activeFilterCount > 0;

  // Default view mode icons
  const defaultIcons = {
    grid: <ViewModuleIcon fontSize="small" />,
    list: <ViewListIcon fontSize="small" />,
    table: <TableChartIcon fontSize="small" />,
    kanban: <ViewKanbanIcon fontSize="small" />,
  };

  const icons = { ...defaultIcons, ...viewModeIcons };

  const [filtersExpanded, setFiltersExpanded] = React.useState(false);

  const renderFilterControl = (filter) => {
    const value = filterValues[filter.key] || '';

    if (filter.type === 'checkbox') {
      return (
        <FormControlLabel
          key={filter.key}
          control={
            <Checkbox
              checked={!!value}
              onChange={(e) => onFilterChange(filter.key, e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" sx={{ userSelect: 'none' }}>
              {filter.label}
            </Typography>
          }
          sx={{ ml: 0, flexShrink: 0 }}
        />
      );
    }

    if (filter.type === 'select' || filter.type === 'dropdown') {
      return (
        <FormControl key={filter.key} size="small" sx={{ minWidth: filter.minWidth || 150, flexShrink: 0 }}>
          <InputLabel>{filter.label}</InputLabel>
          <Select
            value={value}
            label={filter.label}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
          >
            {filter.options?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (filter.type === 'text') {
      return (
        <TextField
          key={filter.key}
          label={filter.label}
          size="small"
          value={value}
          placeholder={filter.placeholder || 'Any'}
          onChange={(e) => onFilterChange(filter.key, e.target.value)}
          sx={{ minWidth: filter.minWidth || 140, flexShrink: 0 }}
        />
      );
    }

    if (filter.type === 'date') {
      return (
        <TextField
          key={filter.key}
          label={filter.label}
          type="date"
          value={value}
          onChange={(e) => onFilterChange(filter.key, e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: filter.minWidth || 140, flexShrink: 0 }}
        />
      );
    }

    return null;
  };

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5, md: 3.5 },
        borderRadius: { xs: 2, md: 2 },
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        animation: 'fade-in-up 0.6s ease-out',
      }}
    >
      <Stack spacing={{ xs: 1.5, md: 0 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ gap: { xs: 1.5, lg: 2 }, flexWrap: { md: 'wrap' } }}
        >
          {/* Search Input */}
          <TextField
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                  <SearchIcon />
                </Box>
              ),
              endAdornment: searchValue && (
                <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                  <IconButton
                    aria-label="clear search"
                    onClick={onSearchClear}
                    edge="end"
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ),
            }}
            size="small"
            sx={{
              width: { xs: '100%', md: 'auto' },
              flex: { md: '1 0 260px' },
              minWidth: { md: 260 },
              maxWidth: { md: 420 },
            }}
          />

          {/* Mobile Filter Toggle */}
          {isMobile && showMobileFilters && filters.length > 0 ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterListIcon />}
                onClick={() => setFiltersExpanded((prev) => !prev)}
                sx={{ textTransform: 'none', flex: 1 }}
              >
                Filters
                {activeFilterCount > 0 && (
                  <Chip
                    label={activeFilterCount}
                    size="small"
                    color="primary"
                    sx={{ ml: 1, height: 20, minWidth: 20 }}
                  />
                )}
              </Button>

              {hasFilters && (
                <Button
                  variant="text"
                  color="inherit"
                  size="small"
                  onClick={onClearFilters}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                  startIcon={<CloseIcon />}
                >
                  Clear
                </Button>
              )}
            </Stack>
          ) : (
            // Desktop Filters
            !isMobile && filters.length > 0 && (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  flexWrap: 'wrap',
                  gap: 1.5,
                  width: 'auto',
                  flexShrink: 0,
                  overflow: 'visible',
                  whiteSpace: 'normal',
                  alignItems: 'center',
                }}
              >
                {filters.map((filter) => renderFilterControl(filter))}

                {hasFilters && (
                  <Button
                    variant="text"
                    color="inherit"
                    size="small"
                    onClick={onClearFilters}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    startIcon={<CloseIcon />}
                  >
                    Clear
                  </Button>
                )}
              </Stack>
            )
          )}

          {!isMobile && <Box sx={{ flexGrow: 1, minWidth: 0 }} />}

          {/* View Mode Toggle */}
          {showViewToggle && !isMobile && (
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={onViewModeChange}
              aria-label="View mode toggle"
              size="small"
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                '& .MuiToggleButtonGroup-grouped': {
                  minWidth: 40,
                  border: 'none',
                  '&:not(:first-of-type)': {
                    borderRadius: 2,
                  },
                  '&:first-of-type': {
                    borderRadius: 2,
                  },
                },
                '& .MuiToggleButton-root': {
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                },
                '& .Mui-selected': {
                  color: 'error.main',
                  backgroundColor: 'transparent !important',
                  '&:hover': {
                    backgroundColor: 'action.hover !important',
                  },
                },
              }}
            >
              {viewModes.map((mode) => (
                <ToggleButton key={mode} value={mode} aria-label={`${mode} view`}>
                  <Tooltip title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}>
                    {icons[mode]}
                  </Tooltip>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Stack>

        {/* Mobile Filters Collapse */}
        {isMobile && showMobileFilters && filters.length > 0 && (
          <Collapse in={filtersExpanded} timeout="auto" unmountOnExit>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {filters.map((filter) => renderFilterControl(filter))}
            </Stack>
          </Collapse>
        )}

        {/* Mobile View Toggle */}
        {isMobile && showViewToggle && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={onViewModeChange}
              aria-label="View mode toggle"
              size="small"
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                '& .MuiToggleButtonGroup-grouped': {
                  minWidth: 40,
                  border: 'none',
                  '&:not(:first-of-type)': {
                    borderRadius: 2,
                  },
                  '&:first-of-type': {
                    borderRadius: 2,
                  },
                },
                '& .MuiToggleButton-root': {
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                },
                '& .Mui-selected': {
                  color: 'error.main',
                  backgroundColor: 'transparent !important',
                  '&:hover': {
                    backgroundColor: 'action.hover !important',
                  },
                },
              }}
            >
              {viewModes.map((mode) => (
                <ToggleButton key={mode} value={mode} aria-label={`${mode} view`}>
                  <Tooltip title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}>
                    {icons[mode]}
                  </Tooltip>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default FilterBar;
