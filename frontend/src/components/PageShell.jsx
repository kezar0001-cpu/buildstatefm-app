import { Box, Stack, Typography, Breadcrumbs, Link as MuiLink } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

/**
 * PageShell standardises page headers, spacing, and action layout so that
 * feature areas feel consistent across the app. It assumes Layout already
 * constrains width and padding.
 */
function PageShell({
  title,
  subtitle,
  overline,
  actions,
  breadcrumbs,
  children,
  contentSpacing = { xs: 2.5, md: 3 },
}) {
  const hasBreadcrumbs = Array.isArray(breadcrumbs) && breadcrumbs.length > 0;

  return (
    <Box sx={{ width: '100%', py: { xs: 2, md: 3 } }}>
      <Stack spacing={{ xs: 2, md: 3 }} sx={{ width: '100%' }}>
        {hasBreadcrumbs && (
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
            sx={{ color: 'text.secondary' }}
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              if (crumb.href && !isLast) {
                return (
                  <MuiLink
                    key={crumb.label}
                    underline="hover"
                    color="inherit"
                    href={crumb.href}
                    sx={{ fontWeight: 500 }}
                  >
                    {crumb.label}
                  </MuiLink>
                );
              }

              return (
                <Typography key={crumb.label} color={isLast ? 'text.primary' : 'text.secondary'} fontWeight={600}>
                  {crumb.label}
                </Typography>
              );
            })}
          </Breadcrumbs>
        )}

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 1.5, md: 2 }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {overline && (
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                {overline}
              </Typography>
            )}
            <Typography
              variant="h4"
              sx={(theme) => ({
                fontWeight: 800,
                letterSpacing: '-0.02em',
                ...(theme.palette.mode === 'dark'
                  ? { color: 'primary.main' }
                  : {
                      background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }),
              })}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {actions && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
              alignItems="center"
            >
              {actions}
            </Stack>
          )}
        </Stack>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: contentSpacing }}>{children}</Box>
      </Stack>
    </Box>
  );
}

export default PageShell;
