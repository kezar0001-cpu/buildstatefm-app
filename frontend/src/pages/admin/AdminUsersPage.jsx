import { Box, Typography, Card, CardContent, Alert } from '@mui/material';
import { Construction } from '@mui/icons-material';

export default function AdminUsersPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        User Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage all users across the platform
      </Typography>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Construction sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Coming Soon
          </Typography>
          <Typography variant="body2" color="text.secondary">
            User management interface is under development.
          </Typography>
          <Alert severity="info" sx={{ mt: 3, maxWidth: 600, mx: 'auto' }}>
            This page will allow you to view, search, filter, and manage all users on the platform.
            Features will include user details, subscription management, and activity logs.
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}
