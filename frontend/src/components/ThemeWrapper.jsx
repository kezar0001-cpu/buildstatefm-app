import { useMemo } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme, responsiveFontSizes } from '@mui/material';
import { useTheme } from '../context/ThemeContext';

const ThemeWrapper = ({ children }) => {
  const { theme } = useTheme();

  const muiTheme = useMemo(() => {
    let newTheme = createTheme({
      palette: {
        mode: theme,
        // You can define your light and dark palettes here
        ...(theme === 'light'
          ? {
              // Light mode palette
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
            }
          : {
              // Dark mode palette
              primary: {
                main: '#f87171',
                light: '#b91c1c',
                dark: '#7f1d1d',
                contrastText: '#ffffff',
              },
              secondary: {
                main: '#fb923c',
                light: '#f97316',
                dark: '#c2410c',
                contrastText: '#0f172a',
              },
              background: {
                default: '#1f2937',
                paper: '#111827',
              },
              text: {
                primary: '#ffffff',
                secondary: '#d1d5db',
              },
            }),
      },
      shape: {
        borderRadius: 16,
      },
      // ... other theme customizations
    });
    newTheme = responsiveFontSizes(newTheme);
    return newTheme;
  }, [theme]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

export default ThemeWrapper;
