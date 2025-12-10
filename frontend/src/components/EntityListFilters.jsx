import { useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Button,
  Collapse,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

/**
 * Unified filter and search component for entity lists
 * 
 * @param {Object} props
 * @param {string} props.searchValue - Current search value
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {Array} props.filters - Array of filter configurations
 * @param {Object} props.filterValues - Current filter values
 * @param {Function} props.onFilterChange - Callback when filter changes
 * @param {Function} props.onClearFilters - Callback to clear all filters
 * @param {string} props.searchPlaceholder - Placeholder text for search input
 * @param {boolean} props.showExpandedFilters - Whether to show expanded filters by default
 */
export default function EntityListFilters({
  searchValue = '',
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,
  searchPlaceholder = 'Search...',
  showExpandedFilters = false,
}) {
  const [expanded, setExpanded] = useState(showExpandedFilters);

  const handleSearchChange = (event) => {
    if (onSearchChange) {
      onSearchChange(event.target.value);
    }
  };

  const handleFilterChange = (filterKey, value) => {
    if (onFilterChange) {
      onFilterChange(filterKey, value);
    }
  };

  const handleClearAll = () => {
    if (onClearFilters) {
      onClearFilters();
    }
  };

  // Count active filters
  const activeFilterCount = Object.values(filterValues).filter(
    (value) => value !== '' && value !== null && value !== undefined
  ).length;

  const hasActiveFilters = activeFilterCount > 0 || searchValue;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        {/* Search and Filter Toggle Row */}
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Search Input */}
          <TextField
            fullWidth
            size="small"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchValue && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => onSearchChange && onSearchChange('')}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.default',
              },
            }}
          />

          {/* Filter Toggle Button */}
          {filters.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setExpanded(!expanded)}
              sx={{
                minWidth: 120,
                whiteSpace: 'nowrap',
              }}
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
          )}

          {/* Clear All Button */}
          {hasActiveFilters && (
            <Button
              variant="text"
              startIcon={<ClearIcon />}
              onClick={handleClearAll}
              size="small"
              sx={{ minWidth: 100 }}
            >
              Clear All
            </Button>
          )}
        </Stack>

        {/* Expanded Filters */}
        {filters.length > 0 && (
          <Collapse in={expanded}>
            <Box
              sx={{
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
                Filter Options
              </Typography>
              
              <Stack
                direction="row"
                spacing={2}
                flexWrap="wrap"
                sx={{
                  '& > *': {
                    minWidth: { xs: '100%', sm: 200 },
                    flex: { xs: '1 1 100%', sm: '1 1 200px' },
                  },
                }}
              >
                {filters.map((filter) => {
                  const currentValue = filterValues[filter.key] || '';

                  if (filter.type === 'select') {
                    return (
                      <FormControl key={filter.key} size="small" fullWidth>
                        <InputLabel>{filter.label}</InputLabel>
                        <Select
                          value={currentValue}
                          label={filter.label}
                          onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                          sx={{
                            bgcolor: 'background.default',
                          }}
                        >
                          <MenuItem value="">
                            <em>All</em>
                          </MenuItem>
                          {filter.options?.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  }

                  if (filter.type === 'date') {
                    return (
                      <TextField
                        key={filter.key}
                        size="small"
                        label={filter.label}
                        type="date"
                        value={currentValue}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'background.default',
                          },
                        }}
                      />
                    );
                  }

                  if (filter.type === 'number') {
                    return (
                      <TextField
                        key={filter.key}
                        size="small"
                        label={filter.label}
                        type="number"
                        value={currentValue}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                        InputProps={filter.inputProps}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'background.default',
                          },
                        }}
                      />
                    );
                  }

                  // Default to text input
                  return (
                    <TextField
                      key={filter.key}
                      size="small"
                      label={filter.label}
                      value={currentValue}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'background.default',
                        },
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
          </Collapse>
        )}

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {searchValue && (
              <Chip
                label={`Search: "${searchValue}"`}
                onDelete={() => onSearchChange && onSearchChange('')}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {filters.map((filter) => {
              const value = filterValues[filter.key];
              if (!value) return null;

              let displayValue = value;
              if (filter.type === 'select') {
                const option = filter.options?.find((opt) => opt.value === value);
                displayValue = option?.label || value;
              }

              return (
                <Chip
                  key={filter.key}
                  label={`${filter.label}: ${displayValue}`}
                  onDelete={() => handleFilterChange(filter.key, '')}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
