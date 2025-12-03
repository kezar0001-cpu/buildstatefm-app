import { Box } from '@mui/material';
import NavBar from './NavBar';
import TrialBanner from './TrialBanner';
import MobileBottomNav from './MobileBottomNav';

function Layout({ children }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        maxWidth: '100vw',
        overflowX: 'hidden',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TrialBanner />
      <NavBar />
      <Box
        component="main"
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: '100vw',
          py: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3, md: 4 },
          pb: { xs: 10, md: 3 }, // Add bottom padding on mobile for bottom nav
        }}
      >
        <Box sx={{ maxWidth: 1240, mx: 'auto', width: '100%' }}>{children}</Box>
      </Box>
      <MobileBottomNav />
    </Box>
  );
}

export default Layout;