import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RouteGuard = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      const currentPath = location.pathname;
      
      // Define role-based dashboard paths
      const roleRedirects = {
        customer: '/customer/dashboard',
        staff: '/staff/dashboard',
        admin: '/admin/dashboard',
        technician: '/technician/dashboard'
      };

      const targetDashboard = roleRedirects[user.role];
      
      // Define allowed cross-role routes for each role
      const allowedCrossRoleRoutes = {
        technician: ['/staff/invoices/create'], // Technicians can access invoice creation
        staff: [], // Staff can access their own routes
        admin: [], // Admin can access all routes
        customer: [] // Customer can access their own routes
      };
      
      const userAllowedRoutes = allowedCrossRoleRoutes[user.role] || [];
      const isAllowedCrossRoleRoute = userAllowedRoutes.some(route => currentPath.startsWith(route));
      
      // Only handle cross-role protection if not an allowed cross-role route
      if (!isAllowedCrossRoleRoute) {
        const userRolePrefix = `/${user.role}`;
        if (!currentPath.startsWith(userRolePrefix) && targetDashboard) {
          // Check if they're in another role's area (not public pages)
          const otherRoleAreas = ['/customer', '/staff', '/admin', '/technician'];
          const inOtherRoleArea = otherRoleAreas.some(area => 
            currentPath.startsWith(area) && area !== userRolePrefix
          );
          
          if (inOtherRoleArea) {
            navigate(targetDashboard, { replace: true });
          }
        }
      }
    }
  }, [user, loading, location.pathname, navigate]);

  return children;
};

export default RouteGuard;