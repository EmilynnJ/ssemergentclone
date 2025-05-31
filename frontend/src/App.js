import React, { useState, useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  useAuth
} from "@clerk/clerk-react";
import axios from "axios";
import "./App.css";

// Import components
import { QuickAddFundsButton } from './components/PaymentUI';
import { SessionRequestModal } from './components/SessionManager';
import SessionManager from './components/SessionManager';
import { ScheduledReadingModal, ScheduledSessionsList } from './components/ScheduledReadings';
import { MessagingInterface, StartConversationModal } from './components/Messaging';
import { LiveStreamsList, LiveStreamViewer, ReaderStreamDashboard } from './components/LiveStreaming';
import ForumInterface from './components/Forum';
import { PoliciesPage, HelpCenter, ApplyReaderPage, AdminDashboard } from './components/AdditionalPages';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// Create axios instance with authentication
const createAuthenticatedAxios = (getToken) => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
  });

  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return instance;
};

// Enhanced Navigation Component
function Navigation({ currentPage, onPageChange, userRole, isSignedIn, user }) {
  const navigationItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'readings', label: 'Readings', icon: '🔮' },
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

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {isSignedIn ? (
              <>
                <span className="text-white font-playfair hidden md:block">
                  Welcome, {user?.firstName || 'User'}
                </span>
                <UserButton />
              </>
            ) : (
              <div className="flex space-x-2">
                <SignInButton>
                  <button className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-playfair transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            )}
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
            onClick={() => onAuthAction('reading') && window.location.hash !== '#readings' ? onPageChange('readings') : null}
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

// Auth Required Page Component
function AuthRequiredPage({ onSignIn }) {
  return (
    <div className="text-center py-16">
      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
        <span className="text-4xl">🔒</span>
      </div>
      
      <h2 className="text-3xl font-alex-brush text-pink-400 mb-4">
        Sign In Required
      </h2>
      
      <p className="text-gray-300 font-playfair mb-8 max-w-md mx-auto">
        Please sign in to access this feature and connect with our spiritual community.
      </p>
      
      <div className="space-x-4">
        <SignInButton>
          <button className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-lg font-playfair transition-colors">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton>
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-playfair transition-colors">
            Create Account
          </button>
        </SignUpButton>
      </div>
    </div>
  );
}

// Auth Prompt Modal Component
function AuthPromptModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-md w-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔮</span>
          </div>
          
          <h3 className="text-xl font-alex-brush text-pink-400 mb-4">
            Join SoulSeer
          </h3>
          
          <p className="text-gray-300 font-playfair mb-6">
            Sign in to book readings, message readers, and access all platform features.
          </p>
          
          <div className="space-y-3">
            <SignInButton>
              <button className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 px-6 rounded-lg font-playfair transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-playfair transition-colors">
                Create Account
              </button>
            </SignUpButton>
            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg font-playfair transition-colors"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function WelcomeScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center">
      <div className="text-center space-y-8 px-4">
        {/* Hero Image Placeholder */}
        <div className="w-64 h-64 mx-auto bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-6xl">🔮</span>
        </div>
        
        {/* Main Header */}
        <h1 className="text-6xl font-alex-brush text-pink-400 mb-4">
          SoulSeer
        </h1>
        
        {/* Tagline */}
        <p className="text-2xl font-playfair text-white mb-8">
          A Community of Gifted Psychics
        </p>
        
        {/* Authentication Buttons */}
        <div className="space-x-4">
          <SignInButton>
            <button className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-lg font-playfair transition-colors">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-playfair transition-colors">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [userProfile, setUserProfile] = useState(null);
  const [availableReaders, setAvailableReaders] = useState([]);
  const [readerProfile, setReaderProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [selectedReader, setSelectedReader] = useState(null);
  const [showSessionRequest, setShowSessionRequest] = useState(false);
  const [showScheduledReading, setShowScheduledReading] = useState(false);
  const [showStartConversation, setShowStartConversation] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadAvailableReaders();
      
      // Refresh readers every 30 seconds
      const interval = setInterval(loadAvailableReaders, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      const api = createAuthenticatedAxios(getToken);
      const response = await api.get('/api/user/profile');
      setUserProfile(response.data);
      
      // Try to load reader profile if user is a reader
      if (response.data.role === 'reader') {
        try {
          const readerResponse = await api.get('/api/reader/profile');
          setReaderProfile(readerResponse.data);
        } catch (err) {
          // Reader profile doesn't exist, that's okay
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
      const api = createAuthenticatedAxios(getToken);
      const response = await api.get('/api/readers/available');
      setAvailableReaders(response.data);
    } catch (err) {
      console.error('Error loading available readers:', err);
    }
  };

  const handleRequestSession = (reader, type = 'instant') => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const renderPage = () => {
    const api = createAuthenticatedAxios(getToken);
    
    switch (currentPage) {
      case 'home':
        return userProfile?.role === 'reader' ? (
          <ReaderDashboard 
            readerProfile={readerProfile} 
            userProfile={userProfile}
            onProfileUpdate={loadUserData}
            api={api}
          />
        ) : (
          <ClientDashboard 
            availableReaders={availableReaders}
            userProfile={userProfile}
            onRequestSession={handleRequestSession}
            onBalanceUpdate={handleBalanceUpdate}
            api={api}
          />
        );
      
      case 'readings':
        return (
          <ReadingsPage
            availableReaders={availableReaders}
            userProfile={userProfile}
            onRequestSession={handleRequestSession}
            onBalanceUpdate={handleBalanceUpdate}
            api={api}
          />
        );
      
      case 'live':
        return userProfile?.role === 'reader' ? (
          <ReaderStreamDashboard api={api} />
        ) : (
          <LiveStreamsList api={api} />
        );
      
      case 'messages':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-alex-brush text-pink-400">Messages</h2>
              {userProfile?.role === 'client' && (
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
        return <ForumInterface api={api} />;
      
      case 'help':
        return <HelpCenter />;
      
      case 'policies':
        return <PoliciesPage />;
      
      case 'apply':
        return <ApplyReaderPage api={api} />;
      
      case 'admin':
        return userProfile?.role === 'admin' ? (
          <AdminDashboard api={api} />
        ) : (
          <div className="text-center text-white">
            <p>Access denied. Admin privileges required.</p>
          </div>
        );
      
      default:
        return <div className="text-white">Page not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900">
      {/* Navigation */}
      <Navigation 
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        userRole={userProfile?.role}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderPage()}
      </main>

      {/* Modals */}
      <SessionRequestModal
        isOpen={showSessionRequest}
        onClose={() => setShowSessionRequest(false)}
        reader={selectedReader}
        api={createAuthenticatedAxios(getToken)}
      />

      <ScheduledReadingModal
        isOpen={showScheduledReading}
        onClose={() => setShowScheduledReading(false)}
        reader={selectedReader}
        api={createAuthenticatedAxios(getToken)}
      />

      <StartConversationModal
        isOpen={showStartConversation}
        onClose={() => setShowStartConversation(false)}
        readers={availableReaders}
        api={createAuthenticatedAxios(getToken)}
      />

      {/* Session Manager for real-time notifications and calls */}
      <SessionManager api={createAuthenticatedAxios(getToken)} />
    </div>
  );
}

function ReadingsPage({ availableReaders, userProfile, onRequestSession, onBalanceUpdate, api }) {
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
          {/* User Balance */}
          <QuickAddFundsButton
            currentBalance={userProfile?.balance}
            onBalanceUpdate={onBalanceUpdate}
            api={api}
          />

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
  const [status, setStatus] = useState(readerProfile?.availability_status || 'offline');
  const [rates, setRates] = useState({
    chat: readerProfile?.chat_rate_per_minute || 0,
    phone: readerProfile?.phone_rate_per_minute || 0,
    video: readerProfile?.video_rate_per_minute || 0
  });
  const [updating, setUpdating] = useState(false);

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
      onProfileUpdate();
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
      onProfileUpdate();
      alert('Rates updated successfully!');
    } catch (err) {
      console.error('Error updating rates:', err);
      alert('Failed to update rates');
    } finally {
      setUpdating(false);
    }
  };

  if (!readerProfile) {
    return (
      <div className="text-center text-white">
        <h2 className="text-2xl font-playfair mb-4">Reader Profile Not Found</h2>
        <p>Please contact an administrator to set up your reader profile.</p>
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

function App() {
  const { user, isSignedIn } = useUser();
  const [currentPage, setCurrentPage] = useState('home');
  const [userProfile, setUserProfile] = useState(null);
  const [availableReaders, setAvailableReaders] = useState([]);
  const [readerProfile, setReaderProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [selectedReader, setSelectedReader] = useState(null);
  const [showSessionRequest, setShowSessionRequest] = useState(false);
  const [showScheduledReading, setShowScheduledReading] = useState(false);
  const [showStartConversation, setShowStartConversation] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    loadAvailableReaders();
    
    // Load user data only if signed in
    if (isSignedIn) {
      loadUserData();
    }
    
    // Refresh readers every 30 seconds
    const interval = setInterval(loadAvailableReaders, 30000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  const loadUserData = async () => {
    if (!isSignedIn) return;
    
    setLoading(true);
    try {
      const api = createAuthenticatedAxios(useAuth().getToken);
      const response = await api.get('/api/user/profile');
      setUserProfile(response.data);
      
      // Try to load reader profile if user is a reader
      if (response.data.role === 'reader') {
        try {
          const readerResponse = await api.get('/api/reader/profile');
          setReaderProfile(readerResponse.data);
        } catch (err) {
          console.log('No reader profile found');
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableReaders = async () => {
    try {
      // This endpoint should be public
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/readers/available`);
      setAvailableReaders(response.data);
    } catch (err) {
      console.error('Error loading available readers:', err);
    }
  };

  const handleRequestSession = (reader, type = 'instant') => {
    if (!isSignedIn) {
      setShowAuthPrompt(true);
      return;
    }
    
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

  const handleAuthAction = (action) => {
    if (!isSignedIn) {
      setShowAuthPrompt(true);
      return false;
    }
    return true;
  };

  const renderPage = () => {
    const api = isSignedIn ? createAuthenticatedAxios(useAuth().getToken) : null;
    
    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            availableReaders={availableReaders}
            userProfile={userProfile}
            isSignedIn={isSignedIn}
            onRequestSession={handleRequestSession}
            onBalanceUpdate={handleBalanceUpdate}
            onAuthAction={handleAuthAction}
            api={api}
          />
        );
      
      case 'readings':
        return (
          <ReadingsPage
            availableReaders={availableReaders}
            userProfile={userProfile}
            isSignedIn={isSignedIn}
            onRequestSession={handleRequestSession}
            onBalanceUpdate={handleBalanceUpdate}
            onAuthAction={handleAuthAction}
            api={api}
          />
        );
      
      case 'live':
        return isSignedIn && userProfile?.role === 'reader' ? (
          <ReaderStreamDashboard api={api} />
        ) : (
          <LiveStreamsList api={api} />
        );
      
      case 'messages':
        if (!isSignedIn) {
          return <AuthRequiredPage onSignIn={() => setShowAuthPrompt(true)} />;
        }
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-alex-brush text-pink-400">Messages</h2>
              {userProfile?.role === 'client' && (
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
        return <ForumInterface api={api} />;
      
      case 'help':
        return <HelpCenter />;
      
      case 'policies':
        return <PoliciesPage />;
      
      case 'apply':
        return <ApplyReaderPage api={api} />;
      
      case 'admin':
        if (!isSignedIn || userProfile?.role !== 'admin') {
          return <AuthRequiredPage onSignIn={() => setShowAuthPrompt(true)} />;
        }
        return <AdminDashboard api={api} />;
      
      default:
        return <HomePage availableReaders={availableReaders} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900">
      {/* Navigation */}
      <Navigation 
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        userRole={userProfile?.role}
        isSignedIn={isSignedIn}
        user={user}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderPage()}
      </main>

      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <AuthPromptModal 
          onClose={() => setShowAuthPrompt(false)}
        />
      )}

      {/* Other Modals - only show if signed in */}
      {isSignedIn && (
        <>
          <SessionRequestModal
            isOpen={showSessionRequest}
            onClose={() => setShowSessionRequest(false)}
            reader={selectedReader}
            api={createAuthenticatedAxios(useAuth().getToken)}
          />

          <ScheduledReadingModal
            isOpen={showScheduledReading}
            onClose={() => setShowScheduledReading(false)}
            reader={selectedReader}
            api={createAuthenticatedAxios(useAuth().getToken)}
          />

          <StartConversationModal
            isOpen={showStartConversation}
            onClose={() => setShowStartConversation(false)}
            readers={availableReaders}
            api={createAuthenticatedAxios(useAuth().getToken)}
          />

          {/* Session Manager for real-time notifications and calls */}
          <SessionManager api={createAuthenticatedAxios(useAuth().getToken)} />
        </>
      )}
    </div>
  );
}

export default App;
