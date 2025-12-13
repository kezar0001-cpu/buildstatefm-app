import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
  ViewKanban as ViewKanbanIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import type { FilterFieldConfig, FilterValueMap } from './filterTypes';

/**
 * FilterBar (standardized)
 *
 * Desktop rules
 * - Always single-line.
 * - Never wrap.
 * - Search grows and shrinks (minWidth: 0) to prevent overflow.
 * - Only a small set of primary filters render inline.
 * - Remaining filters live in a "More filters" Popover.
 *
 * Mobile rules
 * - Row 1: search (full width).
 * - Row 2: Filters button (with active count badge) + optional Clear.
 * - Filters open in a Drawer with Apply + Reset.
 *
 * Overflow rules
 * - Inline desktop controls are limited by config (primary + max count).
 * - Secondary filters always go to Popover/Drawer.
 * - No horizontal scrolling; no element may exceed the Paper width.
 */

export type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchClear?: () => void;
  searchPlaceholder?: string;

  filters?: FilterFieldConfig[];
  filterValues?: FilterValueMap;
  onFilterChange?: (key: string, value: any) => void;
  onClearFilters?: () => void;

  viewMode?: string;
  onViewModeChange?: (event: React.MouseEvent<HTMLElement>, newMode: string | null) => void;
  showViewToggle?: boolean;
  viewModes?: string[];
  viewModeIcons?: Record<string, React.ReactNode>;

  /** Maximum number of inline filters on desktop (excluding search). */
  maxDesktopInlineFilters?: number;

  /** Optional right-side actions (e.g. Refresh, Export). */
  rightActions?: React.ReactNode;
};

function isActiveFilterValue(value: any) {
  if (value === undefined || value === null) return false;
  if (value === '' || value === 'all') return false;
  if (value === false) return false;
  return true;
}

export default function FilterBar({
  searchValue = '',
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search...',

  filters = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,

  viewMode = 'grid',
  onViewModeChange,
  showViewToggle = true,
  viewModes = ['grid', 'list', 'table'],
  viewModeIcons,

  maxDesktopInlineFilters = 3,
  rightActions,
}: FilterBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const defaultIcons: Record<string, React.ReactNode> = useMemo(
    () => ({
      grid: <ViewModuleIcon fontSize="small" />,
      list: <ViewListIcon fontSize="small" />,
      table: <TableChartIcon fontSize="small" />,
      kanban: <ViewKanbanIcon fontSize="small" />,
    }),
    []
  );

  const icons = useMemo(() => ({ ...defaultIcons, ...(viewModeIcons || {}) }), [defaultIcons, viewModeIcons]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const f of filters) {
      const value = (filterValues as any)[f.key];
      if (f.type === 'checkbox') {
        if (value) count += 1;
      } else if (isActiveFilterValue(value)) {
        count += 1;
      }
    }
    return count;
  }, [filters, filterValues]);

  const hasAny = Boolean(searchValue) || activeFilterCount > 0;

  const { inlineFilters, overflowFilters } = useMemo(() => {
    const primary = filters.filter((f) => f.primary);
    const secondary = filters.filter((f) => !f.primary);

    const inline = primary.slice(0, Math.max(0, maxDesktopInlineFilters));
    const overflow = [...primary.slice(Math.max(0, maxDesktopInlineFilters)), ...secondary];

    return { inlineFilters: inline, overflowFilters: overflow };
  }, [filters, maxDesktopInlineFilters]);

  const renderField = useCallback(
    (field: FilterFieldConfig, valueOverride?: any, onChangeOverride?: (next: any) => void) => {
      const value = valueOverride ?? (filterValues as any)[field.key] ?? '';

      if (field.type === 'checkbox') {
        return (
          <FormControlLabel
            key={field.key}
            control={
              <Checkbox
                checked={Boolean(value)}
                onChange={(e) => {
                  const next = e.target.checked;
                  if (onChangeOverride) onChangeOverride(next);
                  else onFilterChange?.(field.key, next);
                }}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ userSelect: 'none' }}>
                {field.label}
              </Typography>
            }
            sx={{ ml: 0, flexShrink: 0 }}
          />
        );
      }

      if (field.type === 'select') {
        return (
          <FormControl
            key={field.key}
            size="small"
            sx={{
              minWidth: field.minWidth ?? 150,
              maxWidth: field.maxWidth,
              flexShrink: 0,
            }}
          >
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value}
              label={field.label}
              onChange={(e) => {
                const next = e.target.value;
                if (onChangeOverride) onChangeOverride(next);
                else onFilterChange?.(field.key, next);
              }}
            >
              {field.options?.map((opt) => (
                <MenuItem key={String(opt.value)} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }

      if (field.type === 'date') {
        return (
          <TextField
            key={field.key}
            label={field.label}
            type="date"
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              if (onChangeOverride) onChangeOverride(next);
              else onFilterChange?.(field.key, next);
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{
              minWidth: field.minWidth ?? 140,
              maxWidth: field.maxWidth,
              flexShrink: 0,
            }}
          />
        );
      }

      return (
        <TextField
          key={field.key}
          label={field.label}
          size="small"
          value={value}
          placeholder={field.placeholder ?? 'Any'}
          onChange={(e) => {
            const next = e.target.value;
            if (onChangeOverride) onChangeOverride(next);
            else onFilterChange?.(field.key, next);
          }}
          sx={{
            minWidth: field.minWidth ?? 140,
            maxWidth: field.maxWidth,
            flexShrink: 0,
          }}
        />
      );
    },
    [filterValues, onFilterChange]
  );

  const [moreAnchorEl, setMoreAnchorEl] = useState<HTMLElement | null>(null);
  const moreOpen = Boolean(moreAnchorEl);
  const openMore = (e: React.MouseEvent<HTMLElement>) => setMoreAnchorEl(e.currentTarget);
  const closeMore = () => setMoreAnchorEl(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  const lastFocusRef = useRef<HTMLElement | null>(null);

  const [draftFilters, setDraftFilters] = useState<FilterValueMap>(filterValues);

  const syncDraftFromProps = useCallback(() => {
    setDraftFilters(filterValues);
  }, [filterValues]);

  const handleOpenDrawer = (event: React.MouseEvent<HTMLElement>) => {
    lastFocusRef.current = event.currentTarget;
    syncDraftFromProps();
    openDrawer();
  };

  const handleCloseDrawer = () => {
    closeDrawer();
    window.setTimeout(() => {
      lastFocusRef.current?.focus?.();
    }, 0);
  };

  const handleApplyDrawer = () => {
    for (const f of filters) {
      const next = (draftFilters as any)[f.key];
      const current = (filterValues as any)[f.key];
      if (next !== current) {
        onFilterChange?.(f.key, next);
      }
    }
    handleCloseDrawer();
  };

  const handleResetDrawer = () => {
    onClearFilters?.();
    setDraftFilters({});
  };

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5, md: 3.5 },
        borderRadius: { xs: 2, md: 2 },
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      }}
    >
      <Stack spacing={1.5}>
        {/* Desktop: single line */}
        {!isMobile && (
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              gap: 1.5,
              flexWrap: 'nowrap',
              minWidth: 0,
            }}
          >
            <TextField
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              size="small"
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <SearchIcon />
                  </Box>
                ),
                endAdornment: searchValue ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                    <IconButton aria-label="clear search" onClick={onSearchClear} edge="end" size="small">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : null,
              }}
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                maxWidth: 520,
              }}
            />

            {inlineFilters.map((f) => renderField(f))}

            {overflowFilters.length > 0 && (
              <Badge
                color="primary"
                badgeContent={activeFilterCount}
                invisible={activeFilterCount === 0}
                sx={{ flexShrink: 0 }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TuneIcon />}
                  onClick={openMore}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  More filters
                </Button>
              </Badge>
            )}

            {hasAny && (
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={onClearFilters}
                startIcon={<CloseIcon />}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Clear
              </Button>
            )}

            <Box sx={{ flexGrow: 1, minWidth: 0 }} />

            {rightActions ? <Box sx={{ flexShrink: 0 }}>{rightActions}</Box> : null}

            {showViewToggle && (
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
                      <span>{icons[mode]}</span>
                    </Tooltip>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Stack>
        )}

        {/* Mobile */}
        {isMobile && (
          <Stack spacing={1.5}>
            <TextField
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <SearchIcon />
                  </Box>
                ),
                endAdornment: searchValue ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                    <IconButton aria-label="clear search" onClick={onSearchClear} edge="end" size="small">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : null,
              }}
            />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {filters.length > 0 && (
                <Badge
                  color="primary"
                  badgeContent={activeFilterCount}
                  invisible={activeFilterCount === 0}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FilterListIcon />}
                    onClick={handleOpenDrawer}
                    sx={{ textTransform: 'none', width: '100%' }}
                  >
                    Filters
                  </Button>
                </Badge>
              )}

              {hasAny && (
                <Button
                  variant="text"
                  color="inherit"
                  size="small"
                  onClick={onClearFilters}
                  startIcon={<CloseIcon />}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Clear
                </Button>
              )}
            </Stack>

            {rightActions ? (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{rightActions}</Box>
            ) : null}
          </Stack>
        )}
      </Stack>

      <Popover
        open={moreOpen}
        anchorEl={moreAnchorEl}
        onClose={closeMore}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            p: 2,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
          },
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="subtitle2" fontWeight={600}>
              More filters
            </Typography>
            <IconButton size="small" onClick={closeMore} aria-label="Close filters">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Divider />

          {overflowFilters.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No additional filters.
            </Typography>
          ) : (
            overflowFilters.map((f) => (
              <Box key={f.key} sx={{ '& .MuiFormControl-root, & .MuiTextField-root': { width: '100%' } }}>
                {renderField(f)}
              </Box>
            ))
          )}

          {hasAny && (
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => {
                onClearFilters?.();
              }}
              startIcon={<CloseIcon />}
              sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
            >
              Clear
            </Button>
          )}
        </Stack>
      </Popover>

      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85vh',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                Filters
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {activeFilterCount > 0 ? `${activeFilterCount} active` : 'No active filters'}
              </Typography>
            </Stack>
            <IconButton onClick={handleCloseDrawer} aria-label="Close filters">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1.5} sx={{ pb: 2 }}>
            {filters.map((f) => (
              <Box key={f.key} sx={{ '& .MuiFormControl-root, & .MuiTextField-root': { width: '100%' } }}>
                {renderField(f, (draftFilters as any)[f.key], (next) => {
                  setDraftFilters((prev) => ({ ...prev, [f.key]: next }));
                })}
              </Box>
            ))}
          </Stack>

          <Divider />

          <Stack direction="row" spacing={1} sx={{ pt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleResetDrawer}
              sx={{ textTransform: 'none', flex: 1 }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              onClick={handleApplyDrawer}
              sx={{ textTransform: 'none', flex: 1 }}
            >
              Apply
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Paper>
  );
}
