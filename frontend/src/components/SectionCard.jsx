import { Paper, Stack, Typography, Divider, Box, useTheme } from '@mui/material';

/**
 * SectionCard provides a consistent surface for feature blocks with
 * aligned padding, borders, and optional headers.
 */
function SectionCard({ title, subtitle, action, children, spacing = { xs: 2, md: 2.5 } }) {
  const theme = useTheme();
  const hasHeader = title || subtitle || action;

  return (
    <Paper
      elevation={0}
      sx={{
        p: spacing,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(180deg, #1f2937 0%, #111827 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
      }}
    >
      {hasHeader && (
        <Box sx={{ mb: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: subtitle ? 1 : 0 }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>
              {title}
            </Typography>
            {action}
          </Stack>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          <Divider sx={{ mt: 2 }} />
        </Box>
      )}

      {children}
    </Paper>
  );
}

export default SectionCard;
