import React from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import GradientButton from './GradientButton';

const PageHeader = ({
  title,
  description,
  actionLabel,
  actionIcon,
  onActionClick,
  actionComponent,
  actionProps = {},
  sx = {},
}) => {
  const renderAction = () => {
    if (actionComponent) return actionComponent;
    if (!actionLabel) return null;

    return (
      <GradientButton
        startIcon={actionIcon}
        onClick={onActionClick}
        size={actionProps.size || 'medium'}
        sx={{ maxWidth: { xs: '100%', md: 'auto' }, ...actionProps.sx }}
        {...actionProps}
      >
        {actionLabel}
      </GradientButton>
    );
  };

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 2, md: 0 }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
      sx={{
        mb: { xs: 3, md: 4 },
        gap: { xs: 2, md: 0 },
        animation: 'fade-in-down 0.5s ease-out',
        ...sx,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.75rem', md: '2.125rem' },
            background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>
            {description}
          </Typography>
        )}
      </Box>
      {renderAction()}
    </Stack>
  );
};

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  actionLabel: PropTypes.node,
  actionIcon: PropTypes.node,
  onActionClick: PropTypes.func,
  actionComponent: PropTypes.node,
  actionProps: PropTypes.object,
  sx: PropTypes.object,
};

export default PageHeader;
