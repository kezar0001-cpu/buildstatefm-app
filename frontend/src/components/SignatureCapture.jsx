import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  Box,
  Button,
  Paper,
  Typography,
  Stack,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';

/**
 * SignatureCapture Component
 *
 * Provides a canvas for capturing tenant signatures for move-in/move-out inspections
 *
 * @param {Function} onSave - Callback function when signature is saved, receives signature data URL
 * @param {Function} onCancel - Optional callback when user cancels
 * @param {string} title - Title to display above signature pad
 */
const SignatureCapture = ({ onSave, onCancel, title = 'Tenant Signature' }) => {
  const sigCanvas = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [error, setError] = useState(null);

  const handleClear = () => {
    sigCanvas.current.clear();
    setIsEmpty(true);
    setError(null);
  };

  const handleSave = () => {
    if (sigCanvas.current.isEmpty()) {
      setError('Please provide a signature before saving');
      return;
    }

    try {
      // Get signature as data URL (PNG format)
      const signatureDataURL = sigCanvas.current.toDataURL('image/png');

      // Convert data URL to blob for upload
      fetch(signatureDataURL)
        .then(res => res.blob())
        .then(blob => {
          onSave(blob, signatureDataURL);
        })
        .catch(err => {
          console.error('Error converting signature:', err);
          setError('Failed to process signature. Please try again.');
        });
    } catch (err) {
      console.error('Error saving signature:', err);
      setError('Failed to save signature. Please try again.');
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
    setError(null);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Please sign in the box below using your mouse or touchscreen
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            border: '2px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            backgroundColor: '#fff',
            cursor: 'crosshair',
            touchAction: 'none',
          }}
        >
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              width: 500,
              height: 200,
              className: 'signature-canvas',
              style: { width: '100%', height: '200px' },
            }}
            backgroundColor="white"
            penColor="black"
            onBegin={handleBegin}
          />
        </Box>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DeleteIcon />}
            onClick={handleClear}
            disabled={isEmpty}
          >
            Clear
          </Button>

          {onCancel && (
            <Button
              variant="outlined"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}

          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckIcon />}
            onClick={handleSave}
            disabled={isEmpty}
          >
            Save Signature
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          By signing this document, you acknowledge that you have reviewed and agree with the inspection findings.
        </Typography>
      </Stack>
    </Paper>
  );
};

export default SignatureCapture;
