import React, { useState } from 'react';

export function ScheduledReadingModal({ isOpen, onClose, reader, api }) {
  const [sessionType, setSessionType] = useState('chat');
  const [billingType, setBillingType] = useState('per_minute');
  const [duration, setDuration] = useState(15);
  const [scheduledTime, setScheduledTime] = useState('');
  const [requesting, setRequesting] = useState(false);

  if (!isOpen || !reader) return null;

  const getPerMinuteRate = (type) => reader[`${type}_rate_per_minute`] || 0;
  const getFixedPrice = (type, minutes) => reader[`${type}_${minutes}min_price`] || 0;

  const calculatePrice = () => {
    if (billingType === 'fixed_duration') {
      return getFixedPrice(sessionType, duration);
    }
    return getPerMinuteRate(sessionType);
  };

  const requestScheduledSession = async () => {
    setRequesting(true);
    try {
      const requestData = {
        reader_id: reader.id,
        session_type: sessionType,
        billing_type: billingType
      };

      if (billingType === 'fixed_duration') {
        requestData.duration_minutes = duration;
      }

      if (scheduledTime) {
        requestData.scheduled_time = new Date(scheduledTime).toISOString();
      }

      const response = await api.post('/api/session/request', requestData);
      
      if (billingType === 'fixed_duration') {
        alert(`Scheduled reading booked! You'll be charged $${calculatePrice()} when the session starts.`);
      } else {
        alert('Reading request sent! You\'ll be charged per minute once the reader accepts.');
      }
      
      onClose();
    } catch (err) {
      console.error('Error requesting session:', err);
      alert(err.response?.data?.detail || 'Failed to request session');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-lg w-full">
        <h3 className="text-xl font-alex-brush text-pink-400 mb-6">
          Book Reading with {reader.first_name} {reader.last_name}
        </h3>

        {/* Session Type Selection */}
        <div className="mb-6">
          <label className="block text-white font-playfair mb-3">Reading Type</label>
          <div className="grid grid-cols-3 gap-2">
            {['chat', 'phone', 'video'].map((type) => (
              <button
                key={type}
                onClick={() => setSessionType(type)}
                disabled={getPerMinuteRate(type) === 0 && getFixedPrice(type, 15) === 0}
                className={`p-3 rounded-lg font-playfair transition-colors capitalize ${
                  sessionType === type
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Billing Type Selection */}
        <div className="mb-6">
          <label className="block text-white font-playfair mb-3">Billing Method</label>
          <div className="space-y-3">
            {/* Per-minute option */}
            {getPerMinuteRate(sessionType) > 0 && (
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="billingType"
                  value="per_minute"
                  checked={billingType === 'per_minute'}
                  onChange={(e) => setBillingType(e.target.value)}
                  className="text-pink-500 focus:ring-pink-500"
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-white font-playfair">Per-Minute Billing</span>
                    <span className="text-pink-400 font-playfair">${getPerMinuteRate(sessionType)}/min</span>
                  </div>
                  <p className="text-gray-400 text-sm">Pay as you go - session can end anytime</p>
                </div>
              </label>
            )}

            {/* Fixed duration options */}
            <div className="space-y-2">
              {[15, 30, 60].map((minutes) => {
                const price = getFixedPrice(sessionType, minutes);
                return price > 0 ? (
                  <label key={minutes} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="billingType"
                      value="fixed_duration"
                      checked={billingType === 'fixed_duration' && duration === minutes}
                      onChange={(e) => {
                        setBillingType('fixed_duration');
                        setDuration(minutes);
                      }}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-white font-playfair">{minutes} Minute Session</span>
                        <span className="text-pink-400 font-playfair">${price}</span>
                      </div>
                      <p className="text-gray-400 text-sm">Fixed price - guaranteed {minutes} minutes</p>
                    </div>
                  </label>
                ) : null;
              })}
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="mb-6">
          <label className="block text-white font-playfair mb-3">Schedule (Optional)</label>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
          />
          <p className="text-gray-400 text-sm mt-1">
            Leave blank for immediate reading request
          </p>
        </div>

        {/* Price Summary */}
        <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-white font-playfair">Total Cost:</span>
            <span className="text-pink-400 font-playfair text-lg">
              {billingType === 'fixed_duration' 
                ? `$${calculatePrice()}`
                : `$${calculatePrice()}/minute`
              }
            </span>
          </div>
          {billingType === 'per_minute' && (
            <p className="text-purple-300 text-sm mt-2">
              Actual cost depends on session duration
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={requestScheduledSession}
            disabled={requesting || calculatePrice() === 0}
            className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-playfair transition-colors"
          >
            {requesting ? 'Booking...' : 
             scheduledTime ? 'Schedule Reading' : 'Request Now'}
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

export function ScheduledSessionsList({ sessions, onJoinSession }) {
  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="font-playfair">No scheduled readings</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <div key={session.id} className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-pink-500/30">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="text-white font-playfair capitalize">
                {session.session_type} Reading
              </h4>
              <p className="text-gray-300 text-sm">
                with {session.reader_first_name} {session.reader_last_name}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-playfair ${
              session.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400' :
              session.status === 'active' ? 'bg-green-600/20 text-green-400' :
              'bg-gray-600/20 text-gray-400'
            }`}>
              {session.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-400">Scheduled:</span>
              <p className="text-white">{formatDateTime(session.scheduled_time)}</p>
            </div>
            <div>
              <span className="text-gray-400">Cost:</span>
              <p className="text-white">
                {session.billing_type === 'fixed_duration' 
                  ? `$${session.fixed_price}` 
                  : `$${session.rate_per_minute}/min`
                }
              </p>
            </div>
          </div>

          {session.status === 'pending' && new Date(session.scheduled_time) <= new Date() && (
            <button
              onClick={() => onJoinSession(session)}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors"
            >
              Join Reading
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default { ScheduledReadingModal, ScheduledSessionsList };
