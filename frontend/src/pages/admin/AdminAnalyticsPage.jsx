import { Box, Typography, Card, CardContent, Alert } from '@mui/material';
import { Construction } from '@mui/icons-material';

export default function AdminAnalyticsPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Analytics
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Detailed analytics and insights
      </Typography>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Construction sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Coming Soon
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Advanced analytics dashboard is under development.
          </Typography>
          <Alert severity="info" sx={{ mt: 3, maxWidth: 600, mx: 'auto' }}>
            This page will provide detailed analytics including user growth charts, revenue metrics,
            subscription conversion funnels, and custom date range analysis.
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}
