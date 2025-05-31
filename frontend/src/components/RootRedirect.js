import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed

const RootRedirect = () => {
  const { isAuthenticated, userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-pink-900">
        <p className="text-white text-xl">Loading authentication status...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    if (userRole === 'client') return <Navigate to="/client" replace />;
    if (userRole === 'reader') return <Navigate to="/reader" replace />;
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    // Fallback if role is unknown or not set, redirect to login to be safe or a generic dashboard
    console.warn('Authenticated user with unknown or missing role:', userRole);
    return <Navigate to="/login" replace />;
  } else {
    // If not authenticated, redirect to login page.
    // Later, this could be a dedicated public landing page instead of /login.
    return <Navigate to="/login" replace />;
  }
};

export default RootRedirect;
