import { ThemeProvider } from '../context/ThemeContext.jsx';
import ThemeWrapper from './ThemeWrapper.jsx';
import Layout from './Layout';

/**
 * ProtectedLayout wraps the Layout component with dark mode support.
 * This ensures dark mode is ONLY available on authenticated/protected routes.
 * Public pages (signin, signup, landing, etc.) will NOT have dark mode.
 */
function ProtectedLayout({ children }) {
  return (
    <ThemeProvider>
      <ThemeWrapper>
        <Layout>{children}</Layout>
      </ThemeWrapper>
    </ThemeProvider>
  );
}

export default ProtectedLayout;
