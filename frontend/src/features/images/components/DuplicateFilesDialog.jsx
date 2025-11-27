import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Dialog for handling duplicate file uploads
 *
 * Shows when duplicate files are detected (based on file hash)
 * and allows user to skip duplicates or replace existing files
 */
export function DuplicateFilesDialog({
  open = false,
  duplicates = [],
  onSkip,
  onReplace,
  onCancel,
}) {
  const duplicateCount = duplicates.length;

  if (duplicateCount === 0) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        Duplicate Files Detected
      </DialogTitle>
      <DialogContent>
        <DialogContentText gutterBottom>
          {duplicateCount} file{duplicateCount !== 1 ? 's' : ''} already uploaded:
        </DialogContentText>

        <Box sx={{ mt: 2, mb: 2, maxHeight: 200, overflow: 'auto' }}>
          <List dense disablePadding>
            {duplicates.map((dup, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  mb: 0.5,
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" noWrap>
                      {dup.file.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      Already exists as: {dup.existingFileName}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          Choose to skip these files and upload only new ones, or replace the existing files
          with the new uploads.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onCancel}
          startIcon={<CloseIcon />}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={onSkip}
          startIcon={<SkipNextIcon />}
          variant="outlined"
        >
          Skip Duplicates
        </Button>
        <Button
          onClick={onReplace}
          startIcon={<SwapHorizIcon />}
          variant="contained"
          color="warning"
        >
          Replace Existing
        </Button>
      </DialogActions>
    </Dialog>
  );
}
