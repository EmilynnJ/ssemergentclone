import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // You can render a loading spinner here if you have one
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-pink-900">
        <p className="text-white text-xl">Loading authentication status...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If allowedRoles is provided, check if the user's role is in the allowedRoles array
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // User is authenticated but does not have the required role
    // Redirect to an unauthorized page or home page
    // For now, redirecting to home, but an <Unauthorized /> page would be better.
    return <Navigate to="/" state={{ unauthorized: true }} replace />;
  }

  return children;
};

export default ProtectedRoute;
