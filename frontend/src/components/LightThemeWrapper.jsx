import { useMemo } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme, responsiveFontSizes } from '@mui/material';

/**
 * LightThemeWrapper provides ONLY the light theme for public pages.
 * This ensures consistent branding (red/orange colors) across all public pages
 * without providing dark mode functionality.
 */
const LightThemeWrapper = ({ children }) => {
  const muiTheme = useMemo(() => {
    let newTheme = createTheme({
      palette: {
        mode: 'light',
        // Light mode palette matching the app's brand colors
        primary: {
          main: '#b91c1c',
          light: '#f87171',
          dark: '#7f1d1d',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#f97316',
          light: '#fb923c',
          dark: '#c2410c',
          contrastText: '#0f172a',
        },
        background: {
          default: '#fff5f5',
          paper: '#ffffff',
        },
        text: {
          primary: '#1f2937',
          secondary: '#4b5563',
        },
      },
      shape: {
        borderRadius: 16,
      },
    });
    newTheme = responsiveFontSizes(newTheme);
    return newTheme;
  }, []);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

export default LightThemeWrapper;
