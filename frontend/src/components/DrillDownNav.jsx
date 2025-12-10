import { Box, Breadcrumbs, Typography, Paper, Stack, Chip } from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import EntityLink from './EntityLink';

/**
 * Drill-Down Navigation Component
 * Provides contextual navigation showing entity relationships
 * 
 * @param {Object} props
 * @param {Array} props.path - Navigation path array
 * @param {Object} props.current - Current entity
 * @param {Array} props.relatedEntities - Related entities to show
 * @param {Array} props.actions - Action buttons
 */
export default function DrillDownNav({
  path = [],
  current,
  relatedEntities = [],
  actions,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        {/* Breadcrumb Navigation */}
        {path.length > 0 && (
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            aria-label="breadcrumb"
            sx={{
              '& .MuiBreadcrumbs-separator': {
                mx: 0.5,
              },
            }}
          >
            {path.map((item, index) => (
              <EntityLink
                key={index}
                type={item.type}
                id={item.id}
                label={item.label}
                variant="link"
                showIcon={true}
              />
            ))}
            {current && (
              <Typography
                color="text.primary"
                fontWeight={700}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                {current.label}
              </Typography>
            )}
          </Breadcrumbs>
        )}

        {/* Current Entity Info and Actions */}
        {current && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {current.label}
              </Typography>
              {current.subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {current.subtitle}
                </Typography>
              )}
            </Box>
            {actions && (
              <Stack direction="row" spacing={1}>
                {actions}
              </Stack>
            )}
          </Box>
        )}

        {/* Related Entities Quick Links */}
        {relatedEntities.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Related:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {relatedEntities.map((entity, index) => (
                <EntityLink
                  key={index}
                  type={entity.type}
                  id={entity.id}
                  label={entity.label}
                  variant="chip"
                  showIcon={true}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * Entity Context Panel
 * Shows contextual information about related entities
 * 
 * @param {Object} props
 * @param {string} props.title - Panel title
 * @param {Array} props.sections - Array of section objects
 */
export function EntityContextPanel({ title, sections = [] }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      {title && (
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      <Stack spacing={2.5}>
        {sections.map((section, index) => (
          <Box key={index}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}
            >
              {section.label}
            </Typography>
            {section.type === 'links' && (
              <Stack spacing={1}>
                {section.items.map((item, idx) => (
                  <EntityLink
                    key={idx}
                    type={item.type}
                    id={item.id}
                    label={item.label}
                    variant="card"
                    metadata={item.metadata}
                  />
                ))}
              </Stack>
            )}
            {section.type === 'chips' && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                {section.items.map((item, idx) => (
                  <EntityLink
                    key={idx}
                    type={item.type}
                    id={item.id}
                    label={item.label}
                    variant="chip"
                  />
                ))}
              </Stack>
            )}
            {section.type === 'text' && (
              <Typography variant="body2">{section.content}</Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
