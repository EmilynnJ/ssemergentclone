import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Auth Provider & Hook
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AboutPage from './pages/AboutPage'; // New
import ClientDashboard from './pages/ClientDashboard'; // New
import ReaderDashboard from './pages/ReaderDashboard'; // New
import AdminDashboard from './pages/AdminDashboard'; // New
// Placeholder for a generic public Home Page if needed, or RootRedirect handles it.
// const PublicHomePage = () => <div className="text-white p-4">Welcome to SoulSeer - Please Login or Explore!</div>;

// Components
import ProtectedRoute from './components/ProtectedRoute';
import RootRedirect from './components/RootRedirect'; // New
// Import other existing components as needed
// import { QuickAddFundsButton } from './components/PaymentUI';
// import SessionManager from './components/SessionManager'; // This might need to be integrated carefully with AuthContext

// API Configuration
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Axios instance (can be in a separate api.js file)
export const createAuthenticatedAxios = () => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
  });

  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  return instance;
};

// Navigation Component (Refactored for React Router and AuthContext)
function Navigation() {
  const { isAuthenticated, userRole, logout, userId } = useAuth(); // Assuming userId is available in AuthContext

  // Navigation items can be dynamic based on role
  // Ensure paths here match the Route paths defined below
  const baseNavItems = [
    // Home link now points to RootRedirect which handles logic
    { path: '/', label: 'Home', icon: '🏠' },
    // The following are examples, actual pages for these need to be created or defined
    // For now, they might just redirect or show a placeholder if not part of this task's scope
    // { path: '/readings', label: 'Readings', icon: '🔮' },
    // { path: '/live', label: 'Live Streams', icon: '📺' },
    // { path: '/messages', label: 'Messages', icon: '💌' },
    // { path: '/community', label: 'Community', icon: '👥' },
    { path: '/about', label: 'About', icon: 'ℹ️' } // Added About link
  ];

  let roleSpecificNav = [];
  if (isAuthenticated) {
    if (userRole === 'client') {
      // Path changed to match the route definition for ClientDashboard
      roleSpecificNav.push({ path: '/client', label: 'My Dashboard', icon: '👤'});
    } else if (userRole === 'reader') {
      // Path changed to match the route definition for ReaderDashboard
      roleSpecificNav.push({ path: '/reader', label: 'Reader Hub', icon: '✨'});
    } else if (userRole === 'admin') {
      // Path changed to match the route definition for AdminDashboard
      roleSpecificNav.push({ path: '/admin', label: 'Admin Panel', icon: '⚙️'});
    }
    // Example: { path: `/my-profile`, label: 'Profile', icon: '👤'}
  }

  const navigationItems = [...baseNavItems, ...roleSpecificNav];

  const additionalItems = [
    // { path: '/help', label: 'Help', icon: '❓' }, // Placeholder route
    // { path: '/policies', label: 'Policies', icon: '📋' }, // Placeholder route
    // { path: '/apply', label: 'Apply to be Reader', icon: '✨', requiresGuest: true } // Placeholder
  ];


  return (
    <nav className="bg-black/20 backdrop-blur-sm border-b border-pink-500/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-3xl font-alex-brush text-pink-400 py-4">
            SoulSeer
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg font-playfair text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
             <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg font-playfair text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors">
                <span>⋯</span>
                <span>More</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 backdrop-blur-sm rounded-lg border border-pink-500/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {additionalItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="w-full text-left flex items-center space-x-2 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <span className="text-white font-playfair hidden md:block">
                  {/* Welcome, {userRole} (ID: {userId}) Can fetch user name later */}
                   Welcome!
                </span>
                <button
                  onClick={logout}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Link to="/login" className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-playfair transition-colors">
                  Sign In
                </Link>
                <Link to="/signup" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
        {/* Mobile Navigation can be refactored similarly if needed */}
      </div>
    </nav>
  );
}


// --- Old Components (to be removed or refactored into pages/routes) ---
// HomePage, ReadingsPage, ReaderDashboard, ClientDashboard, etc.
// For this step, we'll define placeholders above and focus on routing.
// The existing complex components (HomePage, Dashboard, ReadingsPage, etc.)
// would need to be refactored to work as routed components and use useAuth hook.

// Placeholder for old HomePage component functionality
// const HomePage = ({ availableReaders, userProfile, api }) => {
// This component would fetch its own data or receive it via props from a layout component
// For now, just a simple placeholder.
// It would use useAuth() to check isAuthenticated for conditional rendering
//   const { isAuthenticated } = useAuth();
//   return (
//     <div className="text-white">
//       <h1 className="text-3xl font-alex-brush text-pink-400">Welcome to SoulSeer</h1>
//       <p>This is the public home page.</p>
//       {isAuthenticated ? <p>You are logged in.</p> : <p>Please log in or sign up.</p>}
//       {/* Display availableReaders etc. */}
//     </div>
//   );
// };


function App() {
  // The old state management from App component (currentPage, userProfile, etc.)
  // will be handled by AuthContext and individual page components.

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900">
          <Navigation />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/about" element={<AboutPage />} />
              {/* Placeholder for other public pages like /help, /policies - create actual components for these */}
              {/* <Route path="/help" element={<HelpPage />} /> */}
              {/* <Route path="/policies" element={<PoliciesPage />} /> */}

              {/* Protected Routes */}
              <Route
                path="/client"
                element={
                  <ProtectedRoute allowedRoles={['client', 'admin']}>
                    <ClientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reader"
                element={
                  <ProtectedRoute allowedRoles={['reader', 'admin']}>
                    <ReaderDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Example of a generic authenticated route, e.g., a user profile page accessible by anyone logged in */}
              {/* <Route
                path="/my-profile"
                element={
                  <ProtectedRoute allowedRoles={['client', 'reader', 'admin']}>
                    <div>My Profile Page (Protected for any authenticated user)</div>
                  </ProtectedRoute>
                }
              /> */}

              {/* Fallback for non-matched routes */}
              {/* Consider a specific 404 component here for a better UX */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          {/* Modals and SessionManager would be integrated into specific pages or layouts as needed if they are global */}
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
    { id: 'live', label: 'Live Streams', icon: '📺' },
    { id: 'messages', label: 'Messages', icon: '💌' },
    { id: 'community', label: 'Community', icon: '👥' },
    { id: 'help', label: 'Help', icon: '❓' }
  ];

  const additionalItems = [
    { id: 'policies', label: 'Policies', icon: '📋' },
    { id: 'apply', label: 'Apply to be Reader', icon: '✨', hideForReaders: true }
  ];

  if (userRole === 'admin') {
    additionalItems.push({ id: 'admin', label: 'Admin', icon: '⚙️' });
  }

  return (
    <nav className="bg-black/20 backdrop-blur-sm border-b border-pink-500/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => onPageChange('home')}
            className="text-3xl font-alex-brush text-pink-400 py-4"
          >
            SoulSeer
          </button>

          {/* Main Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-playfair transition-colors ${
                  currentPage === item.id
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            
            {/* Dropdown for additional items */}
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg font-playfair text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors">
                <span>⋯</span>
                <span>More</span>
              </button>
              
              <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 backdrop-blur-sm rounded-lg border border-pink-500/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {additionalItems.map((item) => (
                  !(item.hideForReaders && userRole === 'reader') && (
                    <button
                      key={item.id}
                      onClick={() => onPageChange(item.id)}
                      className="w-full text-left flex items-center space-x-2 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>

          {/* User Menu - This will be updated with AuthContext */}
          <div className="flex items-center space-x-4">
            {/* Placeholder for new auth buttons/user info */}
            {/* Example: if auth.isAuthenticated */}
            {/* <span className="text-white font-playfair hidden md:block">Welcome, User</span> */}
            {/* <button className="text-white">Logout</button> */}
            {/* else */}
            <div className="flex space-x-2">
              <a href="/login" className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-playfair transition-colors">
                Sign In
              </a>
              <a href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors">
                Sign Up
              </a>
            </div>
            {/* End Placeholder */}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden py-4">
          <div className="grid grid-cols-3 gap-2">
            {navigationItems.slice(0, 6).map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg font-playfair transition-colors ${
                  currentPage === item.id
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

// HomePage Component
function HomePage({ availableReaders, userProfile, isSignedIn, onRequestSession, onBalanceUpdate, onAuthAction, api }) {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-6xl">🔮</span>
        </div>
        
        <h1 className="text-5xl font-alex-brush text-pink-400">
          Welcome to SoulSeer
        </h1>
        
        <p className="text-xl font-playfair text-white max-w-2xl mx-auto">
          Connect with gifted psychics for spiritual guidance through chat, phone, and video readings. 
          Join our community of seekers and discover your path.
        </p>
      </div>

      {/* User Balance (if signed in) */}
      {isSignedIn && userProfile && (
        <QuickAddFundsButton
          currentBalance={userProfile?.balance}
          onBalanceUpdate={onBalanceUpdate}
          api={api}
        />
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 text-center reader-card">
          <div className="text-4xl mb-4">🔮</div>
          <h3 className="text-white font-playfair font-bold mb-2">Get a Reading</h3>
          <p className="text-gray-300 text-sm mb-4">Connect with our gifted readers</p>
          <div className="text-green-400 font-bold">{availableReaders.length} readers online</div>
          <button
            onClick={() => onAuthAction('reading') && window.location.hash !== '#readings' ? window.location.hash = '#readings' : null}
            className="mt-4 w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors"
          >
            Browse Readers
          </button>
        </div>
        
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 text-center reader-card">
          <div className="text-4xl mb-4">📺</div>
          <h3 className="text-white font-playfair font-bold mb-2">Live Streams</h3>
          <p className="text-gray-300 text-sm mb-4">Watch live spiritual guidance</p>
          <div className="text-pink-400 font-bold">Free to watch</div>
          <button
            onClick={() => window.location.hash = '#live'}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors"
          >
            Watch Streams
          </button>
        </div>
        
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 text-center reader-card">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-white font-playfair font-bold mb-2">Community</h3>
          <p className="text-gray-300 text-sm mb-4">Join spiritual discussions</p>
          <div className="text-blue-400 font-bold">Free to participate</div>
          <button
            onClick={() => window.location.hash = '#community'}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors"
          >
            Join Community
          </button>
        </div>
      </div>

      {/* Featured Readers */}
      <div>
        <h3 className="text-2xl font-alex-brush text-pink-400 mb-6 text-center">
          Featured Readers
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableReaders.slice(0, 6).map((reader) => (
            <div key={reader.id} className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 reader-card">
              <div className="text-center mb-4">
                <h4 className="text-xl font-playfair text-white">
                  {reader.first_name} {reader.last_name}
                </h4>
                <div className="flex items-center justify-center mt-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-green-400 font-playfair">Online</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {reader.chat_rate_per_minute > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Chat:</span>
                    <span className="text-white">${reader.chat_rate_per_minute}/min</span>
                  </div>
                )}
                {reader.phone_rate_per_minute > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Phone:</span>
                    <span className="text-white">${reader.phone_rate_per_minute}/min</span>
                  </div>
                )}
                {reader.video_rate_per_minute > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Video:</span>
                    <span className="text-white">${reader.video_rate_per_minute}/min</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => onRequestSession(reader)}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors mystical-glow"
              >
                {isSignedIn ? 'Connect Now' : 'Sign In to Connect'}
              </button>
            </div>
          ))}
        </div>

        {availableReaders.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
              <span className="text-4xl">🌙</span>
            </div>
            <p className="text-xl font-playfair">No readers are currently available.</p>
            <p>Our gifted psychics will return soon. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// AuthRequiredPage, AuthPromptModal, WelcomeScreen removed as they were Clerk-specific

function Dashboard() {
  // const { user } = useUser(); // Removed Clerk hook
  // const { getToken } = useAuth(); // Removed Clerk hook
  // Will use AuthContext later
  const [currentPage, setCurrentPage] = useState('home');
  const [userProfile, setUserProfile] = useState(null); // This will be set from AuthContext or API call
  const [availableReaders, setAvailableReaders] = useState([]);
  const [readerProfile, setReaderProfile] = useState(null);
  const [loading, setLoading] = useState(true); // Will be managed by AuthContext or local state
  const [error, setError] = useState(null);
  
  // Modal states
  const [selectedReader, setSelectedReader] = useState(null);
  const [showSessionRequest, setShowSessionRequest] = useState(false);
  const [showScheduledReading, setShowScheduledReading] = useState(false);
  const [showStartConversation, setShowStartConversation] = useState(false);

  // useEffect will be updated to use AuthContext for user changes
  useEffect(() => {
    // Simulate loading user data for now, will be replaced by AuthContext
    // if (auth.isAuthenticated) {
    //   loadUserData(auth.token);
    // }
    loadAvailableReaders(); // This can remain public or be authenticated

    // Refresh readers every 30 seconds
    const interval = setInterval(loadAvailableReaders, 30000);
    return () => clearInterval(interval);
  }, [/* auth.isAuthenticated */]); // Dependency will be auth state

  const loadUserData = async (/* token */) => { // Token will come from AuthContext
    try {
      const api = createAuthenticatedAxios(/* pass token or get from localStorage */);
      const response = await api.get('/api/user/profile');
      setUserProfile(response.data);
      
      if (response.data.role === 'reader') {
        try {
          const readerResponse = await api.get('/api/reader/profile');
          setReaderProfile(readerResponse.data);
        } catch (err) {
          console.log('No reader profile found');
        }
      }
    } catch (err) {
      setError('Failed to load user profile');
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableReaders = async () => {
    try {
      const api = createAuthenticatedAxios(); // Uses localStorage token
      const response = await api.get('/api/readers/available'); // Assuming this can be public or uses token if available
      setAvailableReaders(response.data);
    } catch (err) {
      console.error('Error loading available readers:', err);
    }
  };

  const handleRequestSession = (reader, type = 'instant') => {
    // Will check auth.isAuthenticated from AuthContext
    setSelectedReader(reader);
    if (type === 'scheduled') {
      setShowScheduledReading(true);
    } else {
      setShowSessionRequest(true);
    }
  };

  const handleBalanceUpdate = (newBalance) => {
    setUserProfile(prev => ({ ...prev, balance: newBalance }));
  };

  // Loading state will be handled differently with AuthContext
  // if (loading && !auth.isAuthenticated) {
  //   return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>;
  // }

  const renderPage = () => {
    const api = createAuthenticatedAxios(); // Uses localStorage token
    
    switch (currentPage) {
      case 'home':
        // Placeholder for userProfile checks, will use AuthContext
        return userProfile?.role === 'reader' ? ( // This check will use AuthContext state
          <ReaderDashboard 
            readerProfile={readerProfile} 
            userProfile={userProfile} // Pass from AuthContext or fetched data
            onProfileUpdate={loadUserData}
            api={api}
          />
        ) : (
          <ClientDashboard 
            availableReaders={availableReaders}
            userProfile={userProfile} // Pass from AuthContext or fetched data
            onRequestSession={handleRequestSession}
            onBalanceUpdate={handleBalanceUpdate}
            api={api}
          />
        );
      
      case 'readings':
        return (
          <ReadingsPage
            availableReaders={availableReaders}
            userProfile={userProfile} // Pass from AuthContext
            // isSignedIn={auth.isAuthenticated} // From AuthContext
            onRequestSession={handleRequestSession}
            onBalanceUpdate={handleBalanceUpdate}
            // onAuthAction={handleAuthAction} // Will use AuthContext
            api={api}
          />
        );
      
      case 'live':
        // Placeholder for userProfile checks
        return userProfile?.role === 'reader' ? ( // This check will use AuthContext state
          <ReaderStreamDashboard api={api} />
        ) : (
          <LiveStreamsList api={api} /> // This might need auth for specific streams
        );
      
      case 'messages':
        // if (!auth.isAuthenticated) return <AuthRequiredPage />; // Replaced by ProtectedRoute
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-alex-brush text-pink-400">Messages</h2>
              {userProfile?.role === 'client' && ( // This check will use AuthContext state
                <button
                  onClick={() => setShowStartConversation(true)}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors"
                >
                  New Conversation
                </button>
              )}
            </div>
            <MessagingInterface api={api} />
          </div>
        );
      
      case 'community':
        return <ForumInterface api={api} />; // May need auth for posting
      
      case 'help':
        return <HelpCenter />;
      
      case 'policies':
        return <PoliciesPage />;
      
      case 'apply':
        return <ApplyReaderPage api={api} />; // May need auth
      
      case 'admin':
        // if (!auth.isAuthenticated || userProfile?.role !== 'admin') return <AuthRequiredPage />; // Replaced by ProtectedRoute + role check
        return <AdminDashboard api={api} />;
      
      default:
        return <div className="text-white">Page not found</div>; // Or redirect to home
    }
  };

  return (
    // AuthProvider will wrap this in index.js or here
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900">
      {/* Navigation */}
      <Navigation 
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        userRole={userProfile?.role} // This will use AuthContext
        // isSignedIn={auth.isAuthenticated} // From AuthContext
        // user={userProfile} // From AuthContext
      />

      {/* Main Content - Routes will be set up here with React Router */}
      <main className="container mx-auto px-4 py-8">
        {renderPage()}
      </main>

      {/* Modals - Conditionally render based on AuthContext and local state */}
      {/* {auth.isAuthenticated && ( */}
      <>
        <SessionRequestModal
          isOpen={showSessionRequest}
          onClose={() => setShowSessionRequest(false)}
          reader={selectedReader}
          api={createAuthenticatedAxios()}
        />

        <ScheduledReadingModal
          isOpen={showScheduledReading}
          onClose={() => setShowScheduledReading(false)}
          reader={selectedReader}
          api={createAuthenticatedAxios()}
        />

        <StartConversationModal
          isOpen={showStartConversation}
          onClose={() => setShowStartConversation(false)}
          readers={availableReaders}
          api={createAuthenticatedAxios()}
        />
        <SessionManager api={createAuthenticatedAxios()} />
      </>
      {/* )} */}
    </div>
  );
}

// ReadingsPage, ReaderDashboard, ClientDashboard components are large and mostly UI logic.
// We'll assume their internal API calls will use the updated createAuthenticatedAxios.
// For brevity, their detailed code is omitted from this diff, but they exist in the original.

function ReadingsPage({ availableReaders, userProfile, isSignedIn, onRequestSession, onBalanceUpdate, onAuthAction, api }) {
  const [viewMode, setViewMode] = useState('available'); // available, scheduled

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-alex-brush text-pink-400 mb-4">
          Spiritual Readings
        </h1>
        <p className="text-gray-300 font-playfair">
          Connect with gifted psychics for guidance and insight
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => setViewMode('available')}
          className={`px-6 py-2 rounded-lg font-playfair transition-colors ${
            viewMode === 'available'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Available Now
        </button>
        <button
          onClick={() => setViewMode('scheduled')}
          className={`px-6 py-2 rounded-lg font-playfair transition-colors ${
            viewMode === 'scheduled'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          My Scheduled Sessions
        </button>
      </div>

      {viewMode === 'available' ? (
        <>
          {/* User Balance - Conditionally render if userProfile exists */}
          {userProfile && (
            <QuickAddFundsButton
              currentBalance={userProfile?.balance}
              onBalanceUpdate={onBalanceUpdate}
              api={api}
            />
          )}

          {/* Available Readers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableReaders.map((reader) => (
              <div key={reader.id} className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 reader-card">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-playfair text-white">
                    {reader.first_name} {reader.last_name}
                  </h3>
                  <div className="flex items-center justify-center mt-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-green-400 font-playfair">Online</span>
                  </div>
                </div>

                {/* Rates */}
                <div className="space-y-2 mb-4">
                  {reader.chat_rate_per_minute > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Chat:</span>
                      <span className="text-white">${reader.chat_rate_per_minute}/min</span>
                    </div>
                  )}
                  {reader.phone_rate_per_minute > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Phone:</span>
                      <span className="text-white">${reader.phone_rate_per_minute}/min</span>
                    </div>
                  )}
                  {reader.video_rate_per_minute > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Video:</span>
                      <span className="text-white">${reader.video_rate_per_minute}/min</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => onRequestSession(reader, 'instant')}
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors mystical-glow"
                  >
                    Read Now
                  </button>
                  <button
                    onClick={() => onRequestSession(reader, 'scheduled')}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors"
                  >
                    Schedule Reading
                  </button>
                </div>
              </div>
            ))}
          </div>

          {availableReaders.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
                <span className="text-4xl">🌙</span>
              </div>
              <p className="text-xl font-playfair">No readers are currently available.</p>
              <p>Our gifted psychics will return soon. Please check back later.</p>
            </div>
          )}
        </>
      ) : (
        <ScheduledSessionsList 
          sessions={[]} // Would load from API
          onJoinSession={() => {}}
        />
      )}
    </div>
  );
}

function ReaderDashboard({ readerProfile, userProfile, onProfileUpdate, api }) {
  // Ensure readerProfile is checked before accessing its properties
  const [status, setStatus] = useState(readerProfile?.availability_status || 'offline');
  const [rates, setRates] = useState({
    chat: readerProfile?.chat_rate_per_minute || 0,
    phone: readerProfile?.phone_rate_per_minute || 0,
    video: readerProfile?.video_rate_per_minute || 0
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Update local state if readerProfile prop changes
    if (readerProfile) {
      setStatus(readerProfile.availability_status || 'offline');
      setRates({
        chat: readerProfile.chat_rate_per_minute || 0,
        phone: readerProfile.phone_rate_per_minute || 0,
        video: readerProfile.video_rate_per_minute || 0
      });
    }
  }, [readerProfile]);

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await api.put('/api/reader/status', {
        availability_status: newStatus,
        chat_rate_per_minute: rates.chat,
        phone_rate_per_minute: rates.phone,
        video_rate_per_minute: rates.video
      });
      setStatus(newStatus);
      if (onProfileUpdate) onProfileUpdate();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const updateRates = async () => {
    setUpdating(true);
    try {
      await api.put('/api/reader/status', {
        availability_status: status,
        chat_rate_per_minute: rates.chat,
        phone_rate_per_minute: rates.phone,
        video_rate_per_minute: rates.video
      });
      if (onProfileUpdate) onProfileUpdate();
      alert('Rates updated successfully!');
    } catch (err) {
      console.error('Error updating rates:', err);
      alert('Failed to update rates');
    } finally {
      setUpdating(false);
    }
  };

  // Conditional rendering if readerProfile is not yet loaded
  if (!readerProfile) {
    return (
      <div className="text-center text-white py-10">
        <h2 className="text-2xl font-playfair mb-4">Loading Reader Profile...</h2>
        {/* Or a more specific message if it's known they are a reader but profile is missing */}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-alex-brush text-pink-400 text-center">
        Reader Dashboard
      </h2>

      {/* Status Control */}
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
        <h3 className="text-xl font-playfair text-white mb-4">Availability Status</h3>
        <div className="flex flex-wrap gap-4 mb-4">
          {['offline', 'online', 'busy'].map((statusOption) => (
            <button
              key={statusOption}
              onClick={() => updateStatus(statusOption)}
              disabled={updating}
              className={`px-6 py-2 rounded-lg font-playfair transition-colors ${
                status === statusOption
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
            status === 'online' ? 'bg-green-500' : 
            status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></span>
          <span className="text-white font-playfair">
            Currently {status}
          </span>
        </div>
      </div>

      {/* Rate Settings */}
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
        <h3 className="text-xl font-playfair text-white mb-4">Per-Minute Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['chat', 'phone', 'video'].map((type) => (
            <div key={type}>
              <label className="block text-white font-playfair mb-2 capitalize">
                {type} Rate ($/min)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  value={rates[type]}
                  onChange={(e) => setRates({...rates, [type]: parseFloat(e.target.value) || 0})}
                  className="w-full pl-8 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={updateRates}
          disabled={updating}
          className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-playfair transition-colors disabled:opacity-50"
        >
          {updating ? 'Updating...' : 'Update Rates'}
        </button>
      </div>

      {/* Earnings Summary */}
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
        <h3 className="text-xl font-playfair text-white mb-4">Today's Earnings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-alex-brush text-pink-400">$0.00</div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-alex-brush text-green-400">0</div>
            <div className="text-sm text-gray-400">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-alex-brush text-blue-400">0 min</div>
            <div className="text-sm text-gray-400">Total Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-alex-brush text-purple-400">$0.00</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientDashboard({ availableReaders, userProfile, onRequestSession, onBalanceUpdate, api }) {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-alex-brush text-pink-400 text-center">
        Welcome to SoulSeer
      </h2>

      {/* User Balance */}
      <QuickAddFundsButton
        currentBalance={userProfile?.balance}
        onBalanceUpdate={onBalanceUpdate}
        api={api}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 text-center">
          <div className="text-4xl mb-4">🔮</div>
          <h3 className="text-white font-playfair font-bold mb-2">Get a Reading</h3>
          <p className="text-gray-300 text-sm mb-4">Connect with our gifted readers</p>
          <div className="text-green-400 font-bold">{availableReaders.length} readers online</div>
        </div>
        
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 text-center">
          <div className="text-4xl mb-4">📺</div>
          <h3 className="text-white font-playfair font-bold mb-2">Live Streams</h3>
          <p className="text-gray-300 text-sm mb-4">Watch live spiritual guidance</p>
          <div className="text-pink-400 font-bold">Now streaming</div>
        </div>
        
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-white font-playfair font-bold mb-2">Community</h3>
          <p className="text-gray-300 text-sm mb-4">Join spiritual discussions</p>
          <div className="text-blue-400 font-bold">Join the conversation</div>
        </div>
      </div>

      {/* Featured Readers */}
      <div>
        <h3 className="text-2xl font-alex-brush text-pink-400 mb-6 text-center">
          Featured Readers
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableReaders.slice(0, 3).map((reader) => (
            <div key={reader.id} className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 reader-card">
              <div className="text-center mb-4">
                <h4 className="text-xl font-playfair text-white">
                  {reader.first_name} {reader.last_name}
                </h4>
                <div className="flex items-center justify-center mt-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-green-400 font-playfair">Online</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {reader.chat_rate_per_minute > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Chat:</span>
                    <span className="text-white">${reader.chat_rate_per_minute}/min</span>
                  </div>
                )}
                {reader.phone_rate_per_minute > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Phone:</span>
                    <span className="text-white">${reader.phone_rate_per_minute}/min</span>
                  </div>
                )}
                {reader.video_rate_per_minute > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Video:</span>
                    <span className="text-white">${reader.video_rate_per_minute}/min</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => onRequestSession(reader)}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors mystical-glow"
              >
                Connect Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// App component will be simplified and use React Router for page rendering.
// State management for userProfile, loading, etc., will largely move to AuthContext
// or be handled by individual pages.

function App() {
  // const { user, isSignedIn } = useUser(); // Removed Clerk hooks
  // For now, App will be a placeholder. Routing will be added later.
  // The main logic of page switching and data loading will be refactored
  // to work with React Router and the new AuthContext.

  // Placeholder state for current page - will be replaced by React Router
  const [currentPage, setCurrentPage] = useState('home');
  const [userProfile, setUserProfile] = useState(null); // Will come from AuthContext
  const [availableReaders, setAvailableReaders] = useState([]);
  // const [readerProfile, setReaderProfile] = useState(null); // Example, may not be needed in App directly

  // Simplified useEffect for now
  useEffect(() => {
    const fetchReaders = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/readers/available`);
        setAvailableReaders(response.data);
      } catch (error) {
        console.error("Error fetching available readers:", error);
      }
    };
    fetchReaders();
  }, []);


  // Simplified renderPage logic - this will be replaced by React Router <Routes>
  const renderPage = () => {
    const api = createAuthenticatedAxios(); // Now uses localStorage
    
    // This switch will be replaced by React Router's <Route> components
    switch (currentPage) {
      case 'home':
        return <HomePage availableReaders={availableReaders} userProfile={userProfile} api={api} /* other props tbd by AuthContext */ />;
      case 'readings':
        return <ReadingsPage availableReaders={availableReaders} userProfile={userProfile} api={api} /* ... */ />;
      // ... other cases will be handled by routes
      default:
        return <HomePage availableReaders={availableReaders} userProfile={userProfile} api={api} />;
    }
  };

  // The actual App component will look more like:
  // return (
  //   <AuthProvider>
  //     <Router>
  //       <Navigation /> {/* Navigation will use useAuth hook */}
  //       <Routes>
  //         <Route path="/" element={<HomePage />} />
  //         <Route path="/login" element={<LoginPage />} />
  //         <Route path="/signup" element={<SignupPage />} />
  //         <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
  //         {/* ... other routes */}
  //       </Routes>
  //     </Router>
  //   </AuthProvider>
  // );

  // For now, returning a simplified structure:
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900">
      <Navigation 
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        // userRole, isSignedIn, user will come from AuthContext via useAuth() in Navigation itself
      />
      <main className="container mx-auto px-4 py-8">
        {renderPage()} {/* This will be replaced by <Routes> from React Router */}
      </main>
      {/* Modals will be managed by their respective pages or a global modal context if needed */}
    </div>
  );
}

export default App;
