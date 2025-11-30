import { Box, Stack, Typography } from '@mui/material';

const gradientTextSx = {
  fontSize: { xs: '1.75rem', md: '2.125rem' },
  fontWeight: 800,
  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '-0.02em',
};

/**
 * Reusable page header for consistent layout and branding across screens.
 */
const PageHeader = ({ title, subtitle, actionSlot, disableAnimation = false, sx = {} }) => {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 2, md: 0 }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
      sx={{
        mb: 3,
        gap: { xs: 2, md: 0 },
        animation: disableAnimation ? undefined : 'fade-in-down 0.5s ease-out',
        ...sx,
      }}
    >
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={gradientTextSx}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {actionSlot ? (
        <Box
          sx={{
            width: { xs: '100%', md: 'auto' },
            display: 'flex',
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
          }}
        >
          {actionSlot}
        </Box>
      ) : null}
    </Stack>
  );
};

export default PageHeader;
