import React from 'react';
import { Button } from '@mui/material';

/**
 * GradientButton Component
 *
 * A reusable button component with a gradient effect matching the app's color scheme.
 * Provides consistent styling across all pages with customizable size options.
 *
 * @param {object} props - Button props
 * @param {string} props.size - Button size: 'small', 'medium', or 'large' (default: 'medium')
 * @param {boolean} props.variant - MUI Button variant (default: 'contained')
 * @param {React.ReactNode} props.children - Button content
 * @param {object} props.sx - Additional styles to merge
 * @param {...any} rest - All other MUI Button props
 */
const GradientButton = ({
  size = 'medium',
  variant = 'contained',
  children,
  sx = {},
  ...rest
}) => {
  // Size configurations
  const sizeStyles = {
    small: {
      minHeight: 32,
      fontSize: '0.813rem',
      px: 2,
      py: 0.75,
    },
    medium: {
      minHeight: 36,
      fontSize: '0.875rem',
      px: 2.5,
      py: 1,
    },
    large: {
      minHeight: 44,
      fontSize: '0.938rem',
      px: 3,
      py: 1.25,
    },
  };

  const currentSize = sizeStyles[size] || sizeStyles.medium;

  return (
    <Button
      variant={variant}
      size={size}
      {...rest}
      sx={{
        ...currentSize,
        background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
        boxShadow: '0 4px 14px 0 rgb(185 28 28 / 0.3)',
        color: 'white',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'none',
        transition: 'all 0.2s ease-in-out',
        overflow: 'hidden',
        borderRadius: '8px',
        '&:hover': {
          background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
          boxShadow: '0 6px 20px 0 rgb(185 28 28 / 0.4)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
        '&:disabled': {
          background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
          boxShadow: 'none',
          color: 'rgba(255, 255, 255, 0.6)',
        },
        ...sx,
      }}
    >
      {children}
    </Button>
  );
};

export default GradientButton;
