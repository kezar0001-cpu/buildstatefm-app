import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import NavBar from './NavBar';
import TrialBanner from './TrialBanner';
import RotaryFooter from './RotaryFooter';

function Layout({ children }) {
  const [footerCollapsed, setFooterCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ui:rotaryFooterCollapsed');
      setFooterCollapsed(stored === '1');
    } catch {
      // ignore
    }
  }, []);

  const handleFooterCollapsedChange = (next) => {
    setFooterCollapsed(next);
    try {
      localStorage.setItem('ui:rotaryFooterCollapsed', next ? '1' : '0');
    } catch {
      // ignore
    }
  };

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
      <TrialBanner footerCollapsed={footerCollapsed} />
      <NavBar />
      <Box
        component="main"
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: '100vw',
          py: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3, md: 4 },
          pb: { xs: footerCollapsed ? 5 : 12, md: 3 },
        }}
      >
        <Box sx={{ maxWidth: 1240, mx: 'auto', width: '100%' }}>{children}</Box>
      </Box>
      <RotaryFooter collapsed={footerCollapsed} onCollapsedChange={handleFooterCollapsedChange} />
    </Box>
  );
}

export default Layout;