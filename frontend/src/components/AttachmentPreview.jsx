
import React from 'react';
import {
  Box,
  CardMedia,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  PlayCircle as PlayCircleIcon,
} from '@mui/icons-material';
import { resolveFileUrl } from '../utils/fileUtils';

function isImageAttachment(attachment) {
  return attachment.mimeType?.startsWith('image/');
}

function isVideoAttachment(attachment) {
  return attachment.mimeType?.startsWith('video/');
}

const AttachmentPreview = ({ attachment }) => {
  if (isImageAttachment(attachment)) {
    return (
      <CardMedia
        component="img"
        height="160"
        image={resolveFileUrl(attachment.url)}
        alt={attachment.name}
        sx={{ objectFit: 'cover' }}
      />
    );
  }

  if (isVideoAttachment(attachment)) {
    return (
      <Box sx={{ position: 'relative', height: 160, bgcolor: 'grey.900', color: 'common.white' }}>
        <PlayCircleIcon sx={{ fontSize: 48, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 160,
        bgcolor: 'grey.100',
      }}
    >
      <DescriptionIcon color="action" sx={{ fontSize: 48 }} />
    </Box>
  );
};

export default AttachmentPreview;
