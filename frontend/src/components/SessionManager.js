import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { VideoCallInterface } from './WebRTC';
import { PaymentSummary } from './PaymentUI';

export function SessionRequestModal({ isOpen, onClose, reader, api }) {
  const [sessionType, setSessionType] = useState('chat');
  const [requesting, setRequesting] = useState(false);

  if (!isOpen || !reader) return null;

  const requestSession = async () => {
    setRequesting(true);
    try {
      const response = await api.post('/api/session/request', {
        reader_id: reader.id,
        session_type: sessionType
      });
      
      alert('Session request sent! Waiting for reader to accept...');
      onClose();
    } catch (err) {
      console.error('Error requesting session:', err);
      alert(err.response?.data?.detail || 'Failed to request session');
    } finally {
      setRequesting(false);
    }
  };

  const getRate = (type) => reader[`${type}_rate_per_minute`] || 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-md w-full">
        <h3 className="text-xl font-alex-brush text-pink-400 mb-4">
          Request Reading with {reader.first_name} {reader.last_name}
        </h3>

        {/* Session Type Selection */}
        <div className="space-y-3 mb-6">
          {['chat', 'phone', 'video'].map((type) => {
            const rate = getRate(type);
            return rate > 0 ? (
              <label key={type} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="sessionType"
                  value={type}
                  checked={sessionType === type}
                  onChange={(e) => setSessionType(e.target.value)}
                  className="text-pink-500 focus:ring-pink-500"
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-white font-playfair capitalize">{type} Reading</span>
                    <span className="text-pink-400 font-playfair">${rate}/min</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {type === 'chat' && 'Text-based spiritual guidance'}
                    {type === 'phone' && 'Voice-only reading session'}
                    {type === 'video' && 'Face-to-face video reading'}
                  </p>
                </div>
              </label>
            ) : null;
          })}
        </div>

        {/* Important Notice */}
        <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3 mb-6">
          <p className="text-yellow-400 text-sm">
            You will be charged ${getRate(sessionType)}/minute once the reader accepts. 
            Make sure you have sufficient balance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={requestSession}
            disabled={requesting || getRate(sessionType) === 0}
            className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-playfair transition-colors"
          >
            {requesting ? 'Requesting...' : `Request ${sessionType} Reading`}
          </button>
          
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-playfair transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function SessionNotification({ session, onAccept, onReject, isReader }) {
  if (!session) return null;

  return (
    <div className="fixed top-4 right-4 bg-black/90 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-sm z-50">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </div>
        
        <div className="flex-1">
          <h4 className="text-white font-playfair font-bold">
            {isReader ? 'New Session Request' : 'Session Update'}
          </h4>
          <p className="text-gray-300 text-sm mb-3">
            {isReader 
              ? `${session.client_first_name} ${session.client_last_name} wants a ${session.session_type} reading`
              : `Reader ${session.reader_first_name} ${session.reader_last_name} ${session.status === 'accepted' ? 'accepted' : 'responded to'} your session`
            }
          </p>
          
          {isReader && session.status === 'pending' && (
            <div className="flex space-x-2">
              <button
                onClick={() => onAccept(session.id)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-playfair transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onReject(session.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-playfair transition-colors"
              >
                Decline
              </button>
            </div>
          )}
          
          {session.status === 'accepted' && (
            <div className="bg-green-600/20 border border-green-500 rounded-lg p-2">
              <p className="text-green-400 text-sm">Session starting soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SessionManager({ api }) {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [sessionNotifications, setSessionNotifications] = useState([]);
  const [completedSession, setCompletedSession] = useState(null);
  const [webSocket, setWebSocket] = useState(null);

  useEffect(() => {
    if (user?.id) {
      connectWebSocket();
    }
    
    return () => {
      if (webSocket) {
        webSocket.close();
      }
    };
  }, [user?.id]);

  const connectWebSocket = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${user.id}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to notification WebSocket');
      setWebSocket(ws);
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'session_request':
        if (message.data.reader_user_id === user?.id) {
          setSessionNotifications(prev => [...prev, message.data]);
        }
        break;
        
      case 'session_accepted':
        if (message.data.client_user_id === user?.id) {
          setActiveSession(message.data);
          setSessionNotifications(prev => 
            prev.filter(notif => notif.id !== message.data.session_id)
          );
        }
        break;
        
      case 'session_rejected':
        setSessionNotifications(prev => 
          prev.filter(notif => notif.id !== message.data.session_id)
        );
        alert('Reader declined your session request.');
        break;
        
      case 'session_ended':
        if (activeSession && activeSession.id === message.data.session_id) {
          setCompletedSession({
            ...activeSession,
            total_amount: message.data.total_amount,
            total_minutes: message.data.total_minutes
          });
          setActiveSession(null);
        }
        break;
    }
  };

  const handleAcceptSession = async (sessionId) => {
    try {
      const response = await api.post('/api/session/action', {
        session_id: sessionId,
        action: 'accept'
      });
      
      // Remove notification and set as active session
      const session = sessionNotifications.find(s => s.id === sessionId);
      if (session) {
        setActiveSession(session);
        setSessionNotifications(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Error accepting session:', error);
      alert('Failed to accept session');
    }
  };

  const handleRejectSession = async (sessionId) => {
    try {
      await api.post('/api/session/action', {
        session_id: sessionId,
        action: 'reject'
      });
      
      // Remove notification
      setSessionNotifications(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Error rejecting session:', error);
      alert('Failed to reject session');
    }
  };

  const handleEndCall = () => {
    setActiveSession(null);
  };

  const clearCompletedSession = () => {
    setCompletedSession(null);
  };

  return (
    <>
      {/* Session Notifications */}
      {sessionNotifications.map((session, index) => (
        <div key={session.id} style={{ top: `${4 + index * 120}px` }} className="absolute">
          <SessionNotification
            session={session}
            onAccept={handleAcceptSession}
            onReject={handleRejectSession}
            isReader={session.reader_user_id === user?.id}
          />
        </div>
      ))}

      {/* Active Video Call */}
      {activeSession && (
        <VideoCallInterface
          sessionData={activeSession}
          onEndCall={handleEndCall}
          api={api}
        />
      )}

      {/* Completed Session Summary */}
      {completedSession && (
        <PaymentSummary
          session={completedSession}
          onClose={clearCompletedSession}
        />
      )}
    </>
  );
}

export default SessionManager;
