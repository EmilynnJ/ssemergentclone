import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'; // Fallback for local dev

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole'));
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // WebSocket state
  const [ws, setWs] = useState(null);
  const [lastWsMessage, setLastWsMessage] = useState(null); // Store the last message
  const wsRef = useRef(null); // Using ref for ws instance to avoid issues with stale closures in callbacks

  const connectWebSocket = (uid, authToken) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected.");
      return;
    }
    // Construct WebSocket URL carefully based on your backend's actual URL
    // Ensure REACT_APP_BACKEND_URL is defined and correct (e.g., http://localhost:8001)
    // For WSS (secure WebSocket), your backend server must support HTTPS.
    const backendUrl = process.env.REACT_APP_BACKEND_URL || API_BASE_URL; // API_BASE_URL is defined in AuthContext
    const wsUrl = backendUrl.replace(/^http/, 'ws'); // Replace http with ws or https with wss

    const fullWsUrl = `${wsUrl}/api/ws/${uid}?token=${authToken}`;
    console.log("Attempting to connect WebSocket:", fullWsUrl);

    const socket = new WebSocket(fullWsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected successfully.");
      setWs(socket); // Update state if needed, though ref is primary for instance
    };

    socket.onmessage = (event) => {
      console.log("WebSocket message received:", event.data);
      try {
        const parsedMessage = JSON.parse(event.data);
        setLastWsMessage({ ...parsedMessage, receivedAt: new Date() }); // Add a timestamp for uniqueness
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      // Potentially attempt to reconnect or notify user
    };

    socket.onclose = (event) => {
      console.log("WebSocket disconnected:", event.reason, event.code);
      if (wsRef.current === socket) { // Only clear if this is the ref'd socket
        wsRef.current = null;
        setWs(null);
      }
      // Optional: Reconnection logic here, e.g., if not a clean logout
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      console.log("Disconnecting WebSocket.");
      wsRef.current.close(1000, "User logout"); // Clean close
      wsRef.current = null;
      setWs(null);
    }
  };

  useEffect(() => {
    // Initial load: if token exists, assume authenticated.
    // A more robust solution would validate the token with the backend here.
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    const storedUserId = localStorage.getItem('userId');

    if (storedToken && storedUserId) {
      setToken(storedToken);
      setUserRole(storedRole);
      setUserId(storedUserId);
      setIsAuthenticated(true);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      connectWebSocket(storedUserId, storedToken); // Connect WebSocket on initial load if authenticated
    }
    setIsLoading(false);

    // Cleanup WebSocket on component unmount if still connected (e.g. browser close)
    return () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/signin`, { email, password });
      if (response.data && response.data.access_token) {
        const { access_token, role, user_id } = response.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userId', user_id);
        setToken(access_token);
        setUserRole(role);
        setUserId(user_id);
        setIsAuthenticated(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        connectWebSocket(user_id, access_token); // Connect WebSocket on login

        // Navigate based on role
        if (role === 'admin') navigate('/admin');
        else if (role === 'reader') navigate('/reader');
        else navigate('/client');
      } else {
        setError('Login failed: No token received.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, { email, password });
      if (response.data && response.data.access_token) {
        // Optionally, log them in directly or redirect to login
        // For now, redirecting to login page after signup
        navigate('/login');
        // Or log in directly:
        // const { access_token, role, user_id } = response.data;
        // localStorage.setItem('token', access_token);
        // localStorage.setItem('userRole', role);
        // localStorage.setItem('userId', user_id);
        // setToken(access_token);
        // setUserRole(role);
        // setUserId(user_id);
        // setIsAuthenticated(true);
        // axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        // navigate(role === 'admin' ? '/admin' : role === 'reader' ? '/reader-dashboard' : '/client-dashboard');
      } else {
        setError('Signup failed: No token received.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    setToken(null);
    setUserRole(null);
    setUserId(null);
    setIsAuthenticated(false);
    delete axios.defaults.headers.common['Authorization'];
    disconnectWebSocket(); // Disconnect WebSocket on logout
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ token, userRole, userId, isAuthenticated, isLoading, error, login, signup, logout, setError, ws: wsRef.current, lastWsMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
