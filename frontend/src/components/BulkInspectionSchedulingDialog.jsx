import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import useApiMutation from '../hooks/useApiMutation';
import useApiQuery from '../hooks/useApiQuery';
import { queryKeys } from '../utils/queryKeys';

const INSPECTION_TYPES = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'MOVE_IN', label: 'Move In' },
  { value: 'MOVE_OUT', label: 'Move Out' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'COMPLIANCE', label: 'Compliance' },
];

export default function BulkInspectionSchedulingDialog({ open, onClose, units, propertyId }) {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [inspectionType, setInspectionType] = useState('ROUTINE');
  const [scheduledDate, setScheduledDate] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  // Fetch templates
  const templatesQuery = useApiQuery({
    queryKey: queryKeys.inspections.templates(),
    url: `/inspection-templates?type=${inspectionType}&propertyId=${propertyId}`,
    enabled: open && !!inspectionType,
  });

  // Fetch technicians for round-robin assignment preview
  const techniciansQuery = useApiQuery({
    queryKey: queryKeys.users.technicians(),
    url: '/users?role=TECHNICIAN',
    enabled: open,
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedUnits([]);
      setInspectionType('ROUTINE');
      setScheduledDate('');
      setTemplateId('');
      setNotes('');
      setErrors({});
    }
  }, [open]);

  // Bulk scheduling mutation
  const bulkScheduleMutation = useApiMutation({
    method: 'post',
    invalidateKeys: [
      queryKeys.inspections.list(),
      queryKeys.properties.detail(propertyId),
    ],
  });

  const templates = templatesQuery.data?.items || templatesQuery.data?.templates || [];
  const technicians = techniciansQuery.data?.items || techniciansQuery.data?.users || [];

  const handleToggleUnit = (unitId) => {
    setSelectedUnits((prev) =>
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId]
    );
  };

  const handleToggleAll = () => {
    if (selectedUnits.length === units.length) {
      setSelectedUnits([]);
    } else {
      setSelectedUnits(units.map((u) => u.id));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (selectedUnits.length === 0) {
      newErrors.units = 'Please select at least one unit';
    }

    if (!inspectionType) {
      newErrors.inspectionType = 'Please select an inspection type';
    }

    if (!scheduledDate) {
      newErrors.scheduledDate = 'Please select a scheduled date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      await bulkScheduleMutation.mutateAsync({
        url: '/inspections/bulk',
        data: {
          unitIds: selectedUnits,
          propertyId,
          inspectionType,
          scheduledDate,
          templateId: templateId || null,
          notes: notes || null,
        },
      });

      onClose(true); // Pass success flag
    } catch (error) {
      console.error('Failed to schedule inspections:', error);
    }
  };

  const getAssignmentPreview = () => {
    if (technicians.length === 0) {
      return 'No technicians available';
    }

    if (selectedUnits.length === 0) {
      return 'Select units to see assignment preview';
    }

    const assignmentCount = Math.ceil(selectedUnits.length / technicians.length);
    return `${technicians.length} technician(s) will be assigned ~${assignmentCount} inspection(s) each (round-robin)`;
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarIcon />
          <Typography variant="h6" component="span">
            Bulk Schedule Inspections
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Info Alert */}
          <Alert severity="info">
            Select multiple units to schedule inspections in bulk. Technicians will be assigned automatically using round-robin distribution.
          </Alert>

          {/* Inspection Configuration */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Inspection Details
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth error={!!errors.inspectionType}>
                <InputLabel>Inspection Type *</InputLabel>
                <Select
                  value={inspectionType}
                  onChange={(e) => {
                    setInspectionType(e.target.value);
                    setTemplateId(''); // Reset template when type changes
                  }}
                  label="Inspection Type *"
                >
                  {INSPECTION_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.inspectionType && (
                  <FormHelperText>{errors.inspectionType}</FormHelperText>
                )}
              </FormControl>

              <TextField
                label="Scheduled Date *"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                error={!!errors.scheduledDate}
                helperText={errors.scheduledDate}
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />

              <FormControl fullWidth>
                <InputLabel>Template (Optional)</InputLabel>
                <Select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  label="Template (Optional)"
                  disabled={templatesQuery.isLoading || templates.length === 0}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
                {templatesQuery.isLoading && (
                  <FormHelperText>Loading templates...</FormHelperText>
                )}
                {!templatesQuery.isLoading && templates.length === 0 && (
                  <FormHelperText>No templates available for this type</FormHelperText>
                )}
              </FormControl>

              <TextField
                label="Notes (Optional)"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
              />
            </Stack>
          </Box>

          {/* Assignment Preview */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <AssignmentIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Technician Assignment Preview
              </Typography>
            </Stack>
            <Alert severity="info" icon={false}>
              {getAssignmentPreview()}
            </Alert>
          </Box>

          {/* Unit Selection */}
          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Select Units *
              </Typography>
              <Button size="small" onClick={handleToggleAll}>
                {selectedUnits.length === units.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Stack>

            {errors.units && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.units}
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedUnits.length === units.length && units.length > 0}
                        indeterminate={
                          selectedUnits.length > 0 && selectedUnits.length < units.length
                        }
                        onChange={handleToggleAll}
                      />
                    </TableCell>
                    <TableCell>Unit Number</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow
                      key={unit.id}
                      hover
                      onClick={() => handleToggleUnit(unit.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedUnits.includes(unit.id)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Unit {unit.unitNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={unit.status?.replace(/_/g, ' ')}
                          size="small"
                          color={unit.status === 'OCCUPIED' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {unit.bedrooms && unit.bathrooms
                            ? `${unit.bedrooms} bed • ${unit.bathrooms} bath`
                            : 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {selectedUnits.length} of {units.length} unit(s) selected
            </Typography>
          </Box>

          {/* Error Alert */}
          {bulkScheduleMutation.isError && (
            <Alert severity="error">
              {bulkScheduleMutation.error?.message ||
                'Failed to schedule inspections. Please try again.'}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={bulkScheduleMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={bulkScheduleMutation.isPending}
        >
          {bulkScheduleMutation.isPending
            ? 'Scheduling...'
            : `Schedule ${selectedUnits.length} Inspection${selectedUnits.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
