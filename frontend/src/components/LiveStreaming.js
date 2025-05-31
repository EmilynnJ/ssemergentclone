import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function LiveStreamViewer({ streamId, api }) {
  const { user } = useAuth();
  const [stream, setStream] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedGift, setSelectedGift] = useState('rose');
  const [giftMessage, setGiftMessage] = useState('');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const videoRef = useRef();

  const giftTypes = [
    { type: 'rose', price: 1.00, emoji: '🌹', name: 'Rose' },
    { type: 'heart', price: 2.50, emoji: '💖', name: 'Heart' },
    { type: 'star', price: 5.00, emoji: '⭐', name: 'Star' },
    { type: 'crown', price: 10.00, emoji: '👑', name: 'Crown' },
    { type: 'diamond', price: 25.00, emoji: '💎', name: 'Diamond' }
  ];

  useEffect(() => {
    if (streamId) {
      loadStreamInfo();
    }
  }, [streamId]);

  const loadStreamInfo = async () => {
    try {
      // In a real implementation, you'd have an endpoint to get stream details
      // For now, we'll simulate stream data
      setStream({
        id: streamId,
        title: "Daily Tarot Reading",
        reader_name: "Mystic Sarah",
        viewer_count: 42,
        total_gifts: 156.50
      });
    } catch (error) {
      console.error('Error loading stream:', error);
    }
  };

  const sendGift = async () => {
    if (!selectedGift) return;

    const gift = giftTypes.find(g => g.type === selectedGift);
    try {
      await api.post(`/api/streams/${streamId}/gift`, {
        stream_id: streamId,
        gift_type: selectedGift,
        gift_value: gift.price,
        message: giftMessage
      });

      // Add gift to local display
      setGifts(prev => [...prev, {
        id: Date.now(),
        type: selectedGift,
        emoji: gift.emoji,
        value: gift.price,
        message: giftMessage,
        sender: user?.firstName || 'Anonymous'
      }]);

      setGiftMessage('');
      setShowGiftModal(false);
      
      // Show gift animation
      showGiftAnimation(gift);
    } catch (error) {
      console.error('Error sending gift:', error);
      alert(error.response?.data?.detail || 'Failed to send gift');
    }
  };

  const showGiftAnimation = (gift) => {
    // Create floating gift animation
    const giftElement = document.createElement('div');
    giftElement.innerHTML = `
      <div class="gift-animation">
        <span style="font-size: 3rem;">${gift.emoji}</span>
        <div style="color: #fbbf24; font-weight: bold;">$${gift.price}</div>
      </div>
    `;
    giftElement.className = 'fixed bottom-20 right-4 z-50 animate-bounce';
    document.body.appendChild(giftElement);

    setTimeout(() => {
      document.body.removeChild(giftElement);
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 overflow-hidden">
      {/* Stream Header */}
      <div className="p-4 border-b border-pink-500/30">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-alex-brush text-pink-400">
              {stream?.title || 'Live Stream'}
            </h2>
            <p className="text-gray-300 font-playfair">
              with {stream?.reader_name || 'Reader'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white font-playfair">LIVE</span>
            </div>
            <div className="text-gray-300">
              👥 {stream?.viewer_count || 0} viewers
            </div>
            <div className="text-pink-400">
              💝 ${stream?.total_gifts?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Video Area */}
        <div className="flex-1">
          <div className="aspect-video bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center relative">
            {/* Video player would go here */}
            <div className="text-center text-white">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
                <span className="text-4xl">📺</span>
              </div>
              <p className="font-playfair">Live Stream Player</p>
              <p className="text-gray-300 text-sm">Video stream would be embedded here</p>
            </div>

            {/* Floating Gifts */}
            <div className="absolute bottom-4 right-4 space-y-2">
              {gifts.slice(-5).map((gift) => (
                <div key={gift.id} className="bg-black/80 rounded-lg p-2 flex items-center space-x-2 animate-pulse">
                  <span className="text-2xl">{gift.emoji}</span>
                  <div>
                    <div className="text-yellow-400 font-bold">${gift.value}</div>
                    <div className="text-white text-sm">{gift.sender}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gift Buttons */}
          <div className="p-4 border-t border-pink-500/30">
            <div className="flex justify-center space-x-2">
              {giftTypes.map((gift) => (
                <button
                  key={gift.type}
                  onClick={() => {
                    setSelectedGift(gift.type);
                    setShowGiftModal(true);
                  }}
                  className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg transition-colors flex flex-col items-center"
                >
                  <span className="text-2xl">{gift.emoji}</span>
                  <span className="text-xs">${gift.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-80 border-l border-pink-500/30 flex flex-col">
          <div className="p-3 border-b border-pink-500/30">
            <h3 className="font-playfair text-white">Live Chat</h3>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg, index) => (
              <div key={index} className="text-sm">
                <span className="text-pink-400 font-bold">{msg.user}:</span>
                <span className="text-white ml-2">{msg.message}</span>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div className="text-gray-400 text-center text-sm">
                Chat will appear here during the live stream
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-pink-500/30">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-pink-500 focus:outline-none text-sm"
              />
              <button className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded transition-colors text-sm">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gift Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-md w-full">
            <h3 className="text-xl font-alex-brush text-pink-400 mb-4">Send Gift</h3>
            
            {selectedGift && (() => {
              const gift = giftTypes.find(g => g.type === selectedGift);
              return (
                <div className="text-center mb-4">
                  <span className="text-6xl">{gift.emoji}</span>
                  <h4 className="text-white font-playfair text-lg">{gift.name}</h4>
                  <p className="text-pink-400 text-xl">${gift.price}</p>
                </div>
              );
            })()}

            <div className="mb-4">
              <label className="block text-white font-playfair mb-2">Message (Optional)</label>
              <input
                type="text"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Add a message with your gift..."
                maxLength={100}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={sendGift}
                className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg font-playfair transition-colors"
              >
                Send Gift
              </button>
              
              <button
                onClick={() => setShowGiftModal(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-playfair transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveStreamsList({ api }) {
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLiveStreams();
    // Refresh every 30 seconds
    const interval = setInterval(loadLiveStreams, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLiveStreams = async () => {
    try {
      const response = await api.get('/api/streams/live');
      setLiveStreams(response.data);
    } catch (error) {
      console.error('Error loading live streams:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading live streams...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-alex-brush text-pink-400 text-center">
        Live Streams
      </h2>

      {liveStreams.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
            <span className="text-4xl">📺</span>
          </div>
          <p className="text-xl font-playfair">No live streams currently</p>
          <p>Check back later for live readings and spiritual guidance</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveStreams.map((stream) => (
            <div key={stream.id} className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 overflow-hidden">
              {/* Stream Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center relative">
                <span className="text-4xl">📺</span>
                
                {/* Live Badge */}
                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center">
                  <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                  LIVE
                </div>

                {/* Viewer Count */}
                <div className="absolute top-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs">
                  👥 {stream.viewer_count}
                </div>
              </div>

              {/* Stream Info */}
              <div className="p-4">
                <h3 className="text-white font-playfair font-bold mb-2">
                  {stream.title}
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  {stream.first_name} {stream.last_name}
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="text-pink-400 text-sm">
                    💝 ${stream.total_gifts?.toFixed(2) || '0.00'} gifts
                  </div>
                  <button className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-playfair transition-colors">
                    Watch
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReaderStreamDashboard({ api }) {
  const [streams, setStreams] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStream, setNewStream] = useState({
    title: '',
    description: '',
    scheduled_time: ''
  });

  const createStream = async () => {
    try {
      const streamData = {
        title: newStream.title,
        description: newStream.description
      };

      if (newStream.scheduled_time) {
        streamData.scheduled_time = new Date(newStream.scheduled_time).toISOString();
      }

      const response = await api.post('/api/streams/create', streamData);
      
      alert('Stream created successfully!');
      setShowCreateModal(false);
      setNewStream({ title: '', description: '', scheduled_time: '' });
      
      // Reload streams
      loadStreams();
    } catch (error) {
      console.error('Error creating stream:', error);
      alert(error.response?.data?.detail || 'Failed to create stream');
    }
  };

  const loadStreams = async () => {
    // Implementation would load reader's streams
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-alex-brush text-pink-400">
          Streaming Dashboard
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-lg font-playfair transition-colors"
        >
          Create Stream
        </button>
      </div>

      {/* Stream Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
          <h3 className="font-playfair text-white mb-2">Total Viewers</h3>
          <div className="text-2xl font-alex-brush text-pink-400">1,234</div>
        </div>
        
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
          <h3 className="font-playfair text-white mb-2">Gifts Received</h3>
          <div className="text-2xl font-alex-brush text-green-400">$456.78</div>
        </div>
        
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
          <h3 className="font-playfair text-white mb-2">Total Streams</h3>
          <div className="text-2xl font-alex-brush text-blue-400">23</div>
        </div>
      </div>

      {/* Create Stream Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-md w-full">
            <h3 className="text-xl font-alex-brush text-pink-400 mb-4">
              Create New Stream
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-white font-playfair mb-2">Title</label>
                <input
                  type="text"
                  value={newStream.title}
                  onChange={(e) => setNewStream({...newStream, title: e.target.value})}
                  placeholder="Stream title..."
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-white font-playfair mb-2">Description</label>
                <textarea
                  value={newStream.description}
                  onChange={(e) => setNewStream({...newStream, description: e.target.value})}
                  placeholder="Stream description..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-white font-playfair mb-2">Schedule (Optional)</label>
                <input
                  type="datetime-local"
                  value={newStream.scheduled_time}
                  onChange={(e) => setNewStream({...newStream, scheduled_time: e.target.value})}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={createStream}
                  disabled={!newStream.title}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-playfair transition-colors"
                >
                  Create Stream
                </button>
                
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-playfair transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default { LiveStreamViewer, LiveStreamsList, ReaderStreamDashboard };
