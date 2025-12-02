import { Button, CircularProgress } from '@mui/material';

/**
 * Enhanced Button component that shows loading state with spinner
 *
 * @param {Object} props - Button props
 * @param {boolean} props.loading - Whether button is in loading state
 * @param {string} props.loadingText - Text to show during loading (optional)
 * @param {React.ReactNode} props.children - Button label
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {Object} props.loadingIndicatorProps - Props for CircularProgress component
 * @param {Object} props.sx - MUI sx prop for styling
 * @param {...any} props - Other Button props
 *
 * @example
 * <LoadingButton
 *   loading={mutation.isPending}
 *   loadingText="Saving..."
 *   onClick={handleSubmit}
 *   variant="contained"
 * >
 *   Save Changes
 * </LoadingButton>
 */
export default function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  loadingIndicatorProps = {},
  startIcon,
  sx,
  ...otherProps
}) {
  const isDisabled = disabled || loading;

  // Default loading indicator size based on button size
  const getIndicatorSize = () => {
    if (otherProps.size === 'small') return 16;
    if (otherProps.size === 'large') return 24;
    return 20;
  };

  return (
    <Button
      {...otherProps}
      disabled={isDisabled}
      startIcon={loading ? null : startIcon}
      sx={{
        position: 'relative',
        ...sx,
      }}
    >
      {loading && (
        <CircularProgress
          size={getIndicatorSize()}
          sx={{
            position: 'absolute',
            left: '50%',
            marginLeft: `-${getIndicatorSize() / 2}px`,
            color: 'inherit',
            ...loadingIndicatorProps.sx,
          }}
          {...loadingIndicatorProps}
        />
      )}
      <span style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {loading && loadingText ? loadingText : children}
      </span>
    </Button>
  );
}
