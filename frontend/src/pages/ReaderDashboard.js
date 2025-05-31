import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createAuthenticatedAxios } from '../App';
import SessionCallUI from '../components/SessionCallUI'; // Import SessionCallUI

const ReaderDashboard = () => {
  const auth = useAuth();
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createAuthenticatedAxios } from '../App';
import SessionCallUI from '../components/SessionCallUI';

const ReaderDashboard = () => {
  const auth = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [readerProfile, setReaderProfile] = useState(null);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCallSession, setActiveCallSession] = useState(null);

  // For status/rate update form
  const [newAvailabilityStatus, setNewAvailabilityStatus] = useState('');
  const [newChatRate, setNewChatRate] = useState('');
  const [newPhoneRate, setNewPhoneRate] = useState('');
  const [newVideoRate, setNewVideoRate] = useState('');
  const [isUpdatingStatusRates, setIsUpdatingStatusRates] = useState(false);


  const authenticatedAxios = createAuthenticatedAxios();

  const fetchReaderData = async (isInitialLoad = false) => {
    if(isInitialLoad) setLoading(true);
    setError('');
    try {
      const [userRes, readerRes, queueRes, earningsRes] = await Promise.all([
        authenticatedAxios.get('/api/user/profile'),
        authenticatedAxios.get('/api/reader/profile'),
        authenticatedAxios.get('/api/reader/sessions/queue'),
        authenticatedAxios.get('/api/reader/earnings')
      ]);
      setUserProfile(userRes.data);
      setReaderProfile(readerRes.data);
      setSessionQueue(queueRes.data);
      setEarnings(earningsRes.data);

      // Initialize form fields
      if (readerRes.data) {
        setNewAvailabilityStatus(readerRes.data.availability_status || 'offline');
        setNewChatRate(readerRes.data.chat_rate_per_minute?.toFixed(2) || '0.00');
        setNewPhoneRate(readerRes.data.phone_rate_per_minute?.toFixed(2) || '0.00');
        setNewVideoRate(readerRes.data.video_rate_per_minute?.toFixed(2) || '0.00');
      }

    } catch (err) {
      console.error("Error fetching reader dashboard data:", err);
      setError(err.response?.data?.detail || 'Failed to load dashboard data.');
    } finally {
      if(isInitialLoad) setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.userId) {
      fetchReaderData(true);
    }
  }, [auth.userId]);

  // WebSocket listener
  useEffect(() => {
    if (auth.lastWsMessage) {
      const { type, ...data } = auth.lastWsMessage;
      console.log("ReaderDashboard WS Message:", type, data);
      if (type === 'new_session_request' && data.reader_user_id === auth.userId) { // Ensure it's for this reader
        fetchReaderData(); // Re-fetch queue
        alert(`New session request from ${data.client_name}!`); // Simple alert for now
      } else if (type === 'session_cancelled_by_client' && data.session_id) {
        fetchReaderData(); // Re-fetch queue
      } else if (type === 'session_ended' && data.session_id) {
        if (activeCallSession && activeCallSession.id === data.session_id) {
          setActiveCallSession(null);
        }
        fetchReaderData(); // Re-fetch queue and potentially earnings
      }
    }
  }, [auth.lastWsMessage, auth.userId, activeCallSession]);

  const handleSessionAction = async (sessionId, action) => {
    try {
      const response = await authenticatedAxios.post('/api/session/action', { session_id: sessionId, action });
      if (action === 'accept' && (response.data.session_type === 'video' || response.data.session_type === 'phone')) {
        // The backend response for 'accept' should return the full session details needed for SessionCallUI
        setActiveCallSession(response.data);
      }
      fetchReaderData(); // Refresh data
    } catch (err) {
      console.error(`Error ${action}ing session:`, err);
      setError(err.response?.data?.detail || `Failed to ${action} session.`);
    }
  };

  const handleUpdateStatusRates = async (e) => {
    e.preventDefault();
    setIsUpdatingStatusRates(true);
    setError('');
    try {
        await authenticatedAxios.put('/api/reader/status', {
            availability_status: newAvailabilityStatus,
            chat_rate_per_minute: parseFloat(newChatRate) || 0,
            phone_rate_per_minute: parseFloat(newPhoneRate) || 0,
            video_rate_per_minute: parseFloat(newVideoRate) || 0,
        });
        fetchReaderData(); // Refresh data
    } catch (err) {
        console.error("Error updating status/rates:", err);
        setError(err.response?.data?.detail || "Failed to update status/rates.");
    } finally {
        setIsUpdatingStatusRates(false);
    }
  };

  const handleHangUp = async () => {
    if (!activeCallSession) return;
    try {
      await authenticatedAxios.post('/api/session/action', {
        session_id: activeCallSession.id,
        action: 'end',
      });
    } catch (err) {
      console.error('Error ending session:', err);
    } finally {
      setActiveCallSession(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-white text-center">Loading dashboard...</div>;
  }
  if (error) {
    return <div className="p-8 text-red-400 bg-red-900/30 rounded-md text-center">Error: {error}</div>;
  }
  if (activeCallSession) {
    return <SessionCallUI session={activeCallSession} auth={auth} onHangUp={handleHangUp} />;
  }
  if (!readerProfile || !userProfile) {
    return <div className="p-8 text-white text-center">No profile data found.</div>;
  }

  return (
    <div className="p-8 text-white bg-black/30 backdrop-blur-md rounded-lg shadow-xl border border-purple-500/30 space-y-8">
      <h1 className="text-4xl font-alex-brush text-purple-400">
        Welcome, Reader {userProfile?.first_name || userProfile?.email}!
      </h1>

      {/* Status and Rates Update Form */}
      <form onSubmit={handleUpdateStatusRates} className="p-6 bg-gray-800/50 rounded-md">
        <h2 className="text-2xl font-playfair text-pink-400 mb-4">Update Availability & Rates</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-4">
          <div>
            <label htmlFor="availabilityStatus" className="block text-sm font-medium text-gray-300 mb-1">Availability Status</label>
            <select id="availabilityStatus" value={newAvailabilityStatus} onChange={(e) => setNewAvailabilityStatus(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900/80 text-white border border-gray-700 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500">
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="busy">Busy</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div><label className="block text-xs text-gray-400">Chat Rate ($/min)</label><input type="number" step="0.01" value={newChatRate} onChange={e=>setNewChatRate(e.target.value)} className="w-full mt-1 px-2 py-1 bg-gray-700 rounded"/></div>
            <div><label className="block text-xs text-gray-400">Phone Rate ($/min)</label><input type="number" step="0.01" value={newPhoneRate} onChange={e=>setNewPhoneRate(e.target.value)} className="w-full mt-1 px-2 py-1 bg-gray-700 rounded"/></div>
            <div><label className="block text-xs text-gray-400">Video Rate ($/min)</label><input type="number" step="0.01" value={newVideoRate} onChange={e=>setNewVideoRate(e.target.value)} className="w-full mt-1 px-2 py-1 bg-gray-700 rounded"/></div>
        </div>
        <button type="submit" disabled={isUpdatingStatusRates} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-playfair transition-colors disabled:opacity-50">
            {isUpdatingStatusRates ? 'Updating...' : 'Update Status & Rates'}
        </button>
      </form>

      {/* Session Queue */}
      <div className="p-6 bg-gray-800/50 rounded-md">
        <h2 className="text-2xl font-playfair text-blue-400 mb-3">Session Queue</h2>
        {sessionQueue.length > 0 ? (
          <ul className="space-y-3">
            {sessionQueue.map(session => (
              <li key={session.id} className="p-3 bg-gray-700/50 rounded-md">
                <p className="font-semibold">Client: {session.client_name || 'N/A'}</p>
                <p>Type: {session.session_type}, Status: <span className={`font-semibold ${session.status === 'pending' ? 'text-yellow-400' : 'text-green-400'}`}>{session.status}</span></p>
                {session.status === 'pending' && (
                  <div className="mt-2 space-x-2">
                    <button onClick={() => handleSessionAction(session.id, 'accept')} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded">Accept</button>
                    <button onClick={() => handleSessionAction(session.id, 'reject')} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded">Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-gray-400">No sessions in queue.</p>}
      </div>

      {/* Earnings Overview */}
      {earnings && (
        <div className="p-6 bg-gray-800/50 rounded-md">
          <h2 className="text-2xl font-playfair text-yellow-400 mb-3">Earnings Overview</h2>
          <p>Pending Balance: ${parseFloat(earnings.pending_balance).toFixed(2)}</p>
          <p>Total Paid Out: ${parseFloat(earnings.paid_out_total).toFixed(2)}</p>
          <p>Lifetime Earnings: ${parseFloat(earnings.total_earned_lifetime).toFixed(2)}</p>
          <h4 className="text-lg font-playfair mt-3 mb-1 text-gray-300">Recent Earnings:</h4>
          {earnings.recent_earnings.length > 0 ? (
            <ul className="text-sm space-y-1">{earnings.recent_earnings.map(e => <li key={e.session_id}>${parseFloat(e.amount_earned).toFixed(2)} from session with {e.client_name} ({new Date(e.earned_at).toLocaleDateString()}) - {e.payout_status}</li>)}</ul>
          ) : <p className="text-gray-400 text-sm">No recent earnings records.</p>}
        </div>
      )}

      <div className="mb-6 p-4 bg-gray-800/50 rounded-md">
        <h2 className="text-2xl font-playfair text-green-400 mb-2">Current Bio</h2>
        <p className="text-gray-300 italic">{readerProfile.bio || 'No bio set.'}</p>
      </div>
    </div>
  );
};

export default ReaderDashboard;
