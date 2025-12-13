import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Dialog,
  DialogContent,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  Close as CloseIcon,
  RequestPage as RequestPageIcon,
  EventNote as EventNoteIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys.js';

const TYPE_ICONS = {
  property: <HomeIcon fontSize="small" />,
  job: <BuildIcon fontSize="small" />,
  inspection: <AssignmentIcon fontSize="small" />,
  service_request: <RequestPageIcon fontSize="small" />,
  recommendation: <LightbulbIcon fontSize="small" />,
  plan: <EventNoteIcon fontSize="small" />,
};

const TYPE_LABELS = {
  property: 'Property',
  job: 'Job',
  inspection: 'Inspection',
  service_request: 'Service Request',
  recommendation: 'Recommendation',
  plan: 'Plan',
};

const STATUS_COLORS = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  SCHEDULED: 'info',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
};

export default function GlobalSearch({ open, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const listboxId = 'global-search-results';
  const inputRef = useRef(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search query
  const { data, isLoading, error: searchError } = useQuery({
    queryKey: queryKeys.globalSearch.results(debouncedTerm),
    queryFn: async () => {
      if (!debouncedTerm.trim()) return { success: true, results: [] };
      try {
        const response = await apiClient.get(`/search?q=${encodeURIComponent(debouncedTerm)}&limit=20`);
        // Handle both response structures
        if (response.data && typeof response.data === 'object') {
          // If response has success and results, use it directly
          if (response.data.success !== undefined && Array.isArray(response.data.results)) {
            return response.data;
          }
          // If response is just results array, wrap it
          if (Array.isArray(response.data.results)) {
            return { success: true, results: response.data.results };
          }
          // If response.data itself is an array (unlikely but handle it)
          if (Array.isArray(response.data)) {
            return { success: true, results: response.data };
          }
        }
        return { success: true, results: [] };
      } catch (err) {
        console.error('Global search error:', err);
        throw err;
      }
    },
    enabled: debouncedTerm.length > 0,
    staleTime: 30000, // 30 seconds
    initialData: { success: true, results: [] },
    retry: 1,
  });

  const handleClose = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  const handleResultClick = (result) => {
    handleClose();
    navigate(result.link);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
      return;
    }

    if (!flatResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      const selected = flatResults[activeIndex];
      if (selected) {
        e.preventDefault();
        handleResultClick(selected);
      }
    }
  };

  // Extract results from response, handling different response structures
  const results = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  }, [data]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const r of results) {
      const type = r?.type || 'other';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(r);
    }

    const order = ['property', 'job', 'inspection', 'service_request', 'recommendation', 'plan', 'other'];
    return order
      .filter((key) => groups.has(key))
      .map((key) => ({
        type: key,
        label: TYPE_LABELS[key] || key,
        items: groups.get(key),
      }));
  }, [results]);

  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    if (!open) return;
    // Reset selection when a new search runs.
    setActiveIndex(0);
  }, [open, debouncedTerm]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: 80,
          m: 0,
          maxHeight: 'calc(100vh - 120px)',
        },
      }}
    >
      <Box sx={{ p: 2, pb: 0 }}>
        <TextField
          autoFocus
          inputRef={inputRef}
          fullWidth
          placeholder="Search properties, jobs, inspections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          inputProps={{
            role: 'combobox',
            'aria-expanded': Boolean(flatResults.length),
            'aria-controls': listboxId,
            'aria-activedescendant': flatResults.length ? `global-search-result-${activeIndex}` : undefined,
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {isLoading && <CircularProgress size={20} />}
                {searchTerm && (
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '1rem',
            },
          }}
        />
      </Box>

      <DialogContent sx={{ p: 0, mt: 1 }}>
        {!searchTerm && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Start typing to search across properties, jobs, inspections, service requests, and plans
            </Typography>
          </Box>
        )}

        {searchError && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {searchError.response?.data?.message || searchError.message || 'Failed to search. Please try again.'}
            </Alert>
          </Box>
        )}

        {searchTerm && !isLoading && !searchError && results.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No results found for &quot;{searchTerm}&quot;
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Try searching by property name, job title, or an address.
            </Typography>
          </Box>
        )}

        {results.length > 0 && (
          <List id={listboxId} role="listbox" sx={{ p: 0 }}>
            {grouped.map((group, groupIndex) => (
              <Box key={group.type}>
                {groupIndex > 0 && <Divider />}
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: 'background.default',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.04em' }}>
                    {group.label.toUpperCase()}
                  </Typography>
                  <Chip label={group.items.length} size="small" variant="outlined" sx={{ height: 20 }} />
                </Box>

                {group.items.map((result) => {
                  const globalIndex = flatResults.findIndex((r) => r.type === result.type && r.id === result.id);
                  const selected = globalIndex === activeIndex;
                  return (
                    <ListItem key={`${result.type}-${result.id}`} disablePadding>
                      <ListItemButton
                        id={`global-search-result-${globalIndex}`}
                        role="option"
                        aria-selected={selected}
                        selected={selected}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        onClick={() => handleResultClick(result)}
                        sx={{
                          py: 1.25,
                          px: 2,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                          {TYPE_ICONS[result.type]}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, minWidth: 0 }}>
                              <Typography variant="subtitle2" component="span" sx={{ minWidth: 0 }} noWrap>
                                {result.title}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  mb: 0.5,
                                }}
                              >
                                {result.description}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {result.subtitle}
                                </Typography>
                                {result.status && (
                                  <Chip
                                    label={result.status.replace(/_/g, ' ')}
                                    size="small"
                                    color={STATUS_COLORS[result.status] || 'default'}
                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                  />
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </Box>
            ))}
          </List>
        )}

        {results.length > 0 && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
