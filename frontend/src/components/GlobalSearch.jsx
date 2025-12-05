import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys.js';

const TYPE_ICONS = {
  property: <HomeIcon fontSize="small" />,
  job: <BuildIcon fontSize="small" />,
  inspection: <AssignmentIcon fontSize="small" />,
  service_request: <RequestPageIcon fontSize="small" />,
};

const TYPE_LABELS = {
  property: 'Property',
  job: 'Job',
  inspection: 'Inspection',
  service_request: 'Service Request',
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
  const navigate = useNavigate();

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
    onClose();
  }, [onClose]);

  const handleResultClick = (result) => {
    handleClose();
    navigate(result.link);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  // Extract results from response, handling different response structures
  const results = React.useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  }, [data]);

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
          fullWidth
          placeholder="Search properties, jobs, inspections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
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
              Start typing to search across properties, jobs, inspections, and service requests
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
          </Box>
        )}

        {results.length > 0 && (
          <List sx={{ p: 0 }}>
            {results.map((result, index) => (
              <Box key={`${result.type}-${result.id}`}>
                {index > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleResultClick(result)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: 'primary.main',
                      }}
                    >
                      {TYPE_ICONS[result.type]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2" component="span">
                            {result.title}
                          </Typography>
                          <Chip
                            label={TYPE_LABELS[result.type]}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
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
