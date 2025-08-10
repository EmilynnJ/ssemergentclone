import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ReadingsPage from './pages/ReadingsPage';
import LivePage from './pages/LivePage';
import LiveStreamPage from './pages/LiveStreamPage';
import ShopPage from './pages/ShopPage';
import CommunityPage from './pages/CommunityPage';
import TopicPage from './pages/TopicPage';
import MessagesPage from './pages/MessagesPage';
import DashboardPage from './pages/DashboardPage';
import HelpCenterPage from './pages/HelpCenterPage';
import ProfilePage from './pages/ProfilePage';
import PoliciesPage from './pages/PoliciesPage';
import CallPage from './pages/CallPage';

/**
 * Root application component.
 *
 * Sets up a simple navigation bar and defines routes for the
 * SoulSeer website. Currently routes both the home and about pages
 * to the AboutPage component as a placeholder until additional pages
 * are implemented.
 */
function App() {
  const { user } = useUser();
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation bar */}
      <nav className="p-4 flex flex-col md:flex-row md:justify-between md:items-center bg-soul-black bg-opacity-80 backdrop-blur-md shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="font-alex-brush text-soul-pink text-4xl drop-shadow-glow-pink mr-4">SoulSeer</h1>
          <div className="md:hidden">
            {/* Mobile toggle can be implemented here if needed */}
          </div>
        </div>
        <ul className="flex flex-wrap space-x-4 text-lg font-playfair mt-2 md:mt-0">
          <li><Link to="/" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Home</Link></li>
          <li><Link to="/readings" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Readings</Link></li>
          <li><Link to="/live" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Live</Link></li>
          <li><Link to="/shop" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Shop</Link></li>
          <li><Link to="/community" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Community</Link></li>
          <li><Link to="/messages" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Messages</Link></li>
          <li><Link to="/dashboard" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Dashboard</Link></li>
          <li><Link to="/help" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Help</Link></li>
          <li><Link to="/about" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">About</Link></li>
          <li><Link to="/policies" className="hover:text-soul-pink-light mystical-glow-hover transition-colors duration-200">Policies</Link></li>
        </ul>
        {/* Authentication buttons */}
        <div className="mt-2 md:mt-0 flex items-center space-x-4">
          <SignedOut>
            <SignInButton mode="modal">
              <span className="cursor-pointer bg-soul-pink hover:bg-soul-pink-light text-soul-black px-3 py-1 rounded">Sign In</span>
            </SignInButton>
            <SignUpButton mode="modal">
              <span className="cursor-pointer bg-soul-pink hover:bg-soul-pink-light text-soul-black px-3 py-1 rounded">Sign Up</span>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link to="/profile" className="mr-2 hover:text-soul-pink-light">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </nav>
      {/* Main content */}
      <div className="flex-grow overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/readings" element={<ReadingsPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/live/:id" element={<LiveStreamPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/:id" element={<TopicPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/call/:sessionId" element={<CallPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;