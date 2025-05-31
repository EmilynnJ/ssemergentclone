import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createAuthenticatedAxios } from '../App';
import SessionCallUI from '../components/SessionCallUI';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { QuickAddFundsButton } from '../components/PaymentUI'; // Using the exported name

// Load Stripe outside of a component’s render to avoid recreating the Stripe object on every render.
// Use your Stripe publishable key.
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE");


const ClientDashboard = () => {
  const auth = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [messagesInfo, setMessagesInfo] = useState({ message: "Loading messages...", sample_messages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [activeCallSession, setActiveCallSession] = useState(null);

  const authenticatedAxios = createAuthenticatedAxios();

  const fetchClientData = async (isInitialLoad = false) => {
    if(isInitialLoad) setLoading(true);
    setError('');
    try {
      const [userRes, clientRes, bookingsRes, messagesRes] = await Promise.all([
        authenticatedAxios.get('/api/user/profile'),
        authenticatedAxios.get('/api/client/profile'),
        authenticatedAxios.get('/api/client/bookings'),
        authenticatedAxios.get('/api/client/messages')
      ]);
      setUserProfile(userRes.data);
      setClientProfile(clientRes.data);
      setBookings(bookingsRes.data);
      setMessagesInfo(messagesRes.data);
    } catch (err) {
      console.error("Error fetching client data:", err);
      setError(err.response?.data?.detail || 'Failed to load dashboard data.');
    } finally {
      if(isInitialLoad) setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.userId) {
        fetchClientData(true); // Pass true for initial load
    }
  }, [auth.userId]);

  // WebSocket listener for real-time updates
  useEffect(() => {
    if (auth.lastWsMessage) {
      const { type, ...data } = auth.lastWsMessage;
      console.log("ClientDashboard received WS Message:", type, data);

      if (type === 'session_accepted' && data.session_id && data.client_user_id === auth.userId) {
        if (data.session_type === 'video' || data.session_type === 'phone') {
          // The backend notification for 'session_accepted' should ideally contain all necessary session details
          // including client_user_id and reader_user_id.
          // For SessionCallUI, we need: id, room_id, client_user_id, reader_user_id, session_type
          // Assuming 'data' contains these from the backend notification.
          const sessionDetailsForCall = bookings.find(b => b.id === data.session_id) || data;
          // Ensure client_user_id and reader_user_id are present. If not, fetch full session details.
          // This is simplified; ideally, the WS message `data` is self-sufficient for `SessionCallUI`.
          if (sessionDetailsForCall.client_user_id && sessionDetailsForCall.reader_user_id) {
             setActiveCallSession(sessionDetailsForCall);
          } else {
            // Fallback: fetch full details if WS message is minimal
            authenticatedAxios.get(`/api/session/${data.session_id}`) // Assuming such an endpoint exists
                .then(res => setActiveCallSession(res.data))
                .catch(err => console.error("Error fetching session details for call UI", err));
          }
        }
        fetchClientData(); // Re-fetch bookings to update status
      } else if ((type === 'session_rejected' || type === 'session_cancelled_by_client' || type === 'session_ended') && data.session_id) {
        if (activeCallSession && activeCallSession.id === data.session_id) {
          setActiveCallSession(null);
        }
        fetchClientData();
      }
    }
  }, [auth.lastWsMessage, auth.userId, bookings, activeCallSession]);


  const handleCancelBooking = async (sessionId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await authenticatedAxios.post('/api/session/action', {
        session_id: sessionId,
        action: 'cancel_client',
      });
      fetchClientData(); // Refresh bookings
    } catch (err) {
      console.error("Error cancelling booking:", err);
      setError(err.response?.data?.detail || "Failed to cancel booking.");
    }
  };

  const handleHangUp = async () => {
    if (!activeCallSession) return;
    try {
      const authenticatedAxios = createAuthenticatedAxios();
      await authenticatedAxios.post('/api/session/action', {
        session_id: activeCallSession.id,
        action: 'end',
      });
      console.log('Session ended via API.');
    } catch (err) {
      console.error('Error ending session:', err);
      // Handle error (e.g., show message to user)
    } finally {
      setActiveCallSession(null); // Close the call UI
    }
  };

  if (loading) {
    return <div className="p-8 text-white text-center">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-400 bg-red-900/30 rounded-md text-center">Error: {error}</div>;
  }

  if (activeCallSession) {
    return (
      <SessionCallUI
        session={activeCallSession}
        auth={auth} // Pass the whole auth object which includes userId and token
        onHangUp={handleHangUp}
      />
    );
  }

  const handlePaymentSuccess = (amountAdded) => {
    setPaymentSuccess(`Successfully added $${amountAdded.toFixed(2)} to your wallet!`);
    setPaymentError('');
    fetchClientData(); // Re-fetch client data to update balance
    setTimeout(() => setPaymentSuccess(''), 5000); // Clear message after 5s
  };


  return (
    <div className="p-8 text-white bg-black/30 backdrop-blur-md rounded-lg shadow-xl border border-pink-500/30">
      <h1 className="text-4xl font-alex-brush text-pink-400 mb-6">
        Welcome, {userProfile?.first_name || userProfile?.email || 'Client'}!
      </h1>

      {userProfile && (
        <div className="mb-6 p-4 bg-gray-800/50 rounded-md">
          <h2 className="text-2xl font-playfair text-purple-400 mb-2">Account Details</h2>
          <p><strong>Email:</strong> {userProfile.email}</p>
          <p><strong>Role:</strong> {userProfile.role}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {clientProfile && (
          <div className="p-6 bg-gray-800/50 rounded-md">
            <h2 className="text-2xl font-playfair text-green-400 mb-3">Wallet</h2>
          <p className="text-xl mb-4"><strong>Balance:</strong> ${clientProfile.balance.toFixed(2)}</p>
            <Elements stripe={stripePromise}>
              <QuickAddFundsButton onPaymentSuccess={handlePaymentSuccess} />
            </Elements>
            {paymentSuccess && <p className="mt-3 text-green-400">{paymentSuccess}</p>}
            {paymentError && <p className="mt-3 text-red-400">{paymentError}</p>}
          </div>
        )}
         {/* Messages Section */}
        <div className="p-6 bg-gray-800/50 rounded-md">
            <h2 className="text-2xl font-playfair text-yellow-400 mb-3">Messages</h2>
            <p className="text-gray-400">{messagesInfo.message}</p>
            {messagesInfo.sample_messages && messagesInfo.sample_messages.length > 0 ? (
              <ul className="list-disc list-inside pl-4 mt-2 text-sm">
                {messagesInfo.sample_messages.map((msg, index) => <li key={index}>{msg.text}</li>)}
              </ul>
            ) : (
              !error && <p className="text-gray-500 text-sm">No sample messages.</p>
            )}
        </div>
      </div>

      {/* Bookings Section */}
      <div className="mt-8 p-6 bg-gray-800/50 rounded-md">
        <h2 className="text-2xl font-playfair text-blue-400 mb-3">My Bookings</h2>
        {bookings.length > 0 ? (
          <ul className="space-y-3">
            {bookings.map(booking => (
              <li key={booking.id} className="p-3 bg-gray-700/50 rounded-md flex flex-col sm:flex-row justify-between sm:items-center">
                <div>
                  <p className="font-semibold text-pink-300">Reader: {booking.reader_name || 'N/A'}</p>
                  <p>Type: {booking.session_type}, Status: <span className={`font-semibold ${
                    booking.status === 'pending' ? 'text-yellow-400' :
                    booking.status === 'active' ? 'text-green-400' :
                    booking.status === 'completed' ? 'text-blue-300' :
                    'text-gray-500'}`}>{booking.status}</span></p>
                  <p className="text-xs text-gray-400">Room: {booking.room_id}</p>
                  <p className="text-xs text-gray-400">Scheduled: {booking.scheduled_time ? new Date(booking.scheduled_time).toLocaleString() : 'ASAP'}</p>
                  {booking.start_time && <p className="text-xs text-gray-400">Started: {new Date(booking.start_time).toLocaleString()}</p>}
                  {booking.end_time && <p className="text-xs text-gray-400">Ended: {new Date(booking.end_time).toLocaleString()}</p>}
                  {booking.total_amount && <p className="text-xs text-gray-400">Cost: ${parseFloat(booking.total_amount).toFixed(2)}</p>}
                </div>
                <div className="mt-2 sm:mt-0">
                  {booking.status === 'pending' && (
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded font-playfair transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {booking.status === 'active' && (booking.session_type === 'video' || booking.session_type === 'phone') && activeCallSession?.id !== booking.id && (
                    <button
                      onClick={() => setActiveCallSession(booking)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded font-playfair transition-colors ml-2"
                    >
                      Join Call
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">No bookings found.</p>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
