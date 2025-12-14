import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../context/UserContext';

/**
 * RoleRouter - Redirects users to their role-specific dashboard
 * when they land on /dashboard
 */
export default function RoleRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useCurrentUser();

  useEffect(() => {
    // Don't redirect while loading or if not on dashboard
    if (isLoading || location.pathname !== '/dashboard') {
      return;
    }

    if (!user) {
      navigate('/signin');
      return;
    }

    // Route based on role
    switch (user.role) {
      case 'TENANT':
        navigate('/tenant/home', { replace: true });
        break;
      case 'OWNER':
        navigate('/owner/dashboard', { replace: true });
        break;
      case 'TECHNICIAN':
        navigate('/technician/dashboard', { replace: true });
        break;
      case 'PROPERTY_MANAGER':
      case 'ADMIN':
        // Property managers and admins stay on main dashboard
        break;
      default:
        // Unknown role, stay on main dashboard
        break;
    }
  }, [user, isLoading, location.pathname, navigate]);

  return null;
}
