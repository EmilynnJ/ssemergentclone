import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function MessagingInterface({ api }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPaidReply, setIsPaidReply] = useState(false);
  const [replyPrice, setReplyPrice] = useState(5.00);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.other_user_id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async () => {
    try {
      const response = await api.get('/api/messages/conversations');
      setConversations(response.data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId) => {
    try {
      const response = await api.get(`/api/messages/conversation/${otherUserId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const messageData = {
        recipient_id: selectedConversation.other_user_id,
        message_text: newMessage.trim(),
        is_paid: isPaidReply,
        price: isPaidReply ? replyPrice : 0
      };

      const response = await api.post('/api/messages/send', messageData);
      
      // Add message to current conversation
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      
      // Update conversation list
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error.response?.data?.detail || 'Failed to send message');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 overflow-hidden">
      {/* Conversations List */}
      <div className="w-1/3 border-r border-pink-500/30">
        <div className="p-4 border-b border-pink-500/30">
          <h3 className="text-lg font-alex-brush text-pink-400">Messages</h3>
        </div>
        
        <div className="overflow-y-auto h-full">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <p className="font-playfair">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.other_user_id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                  selectedConversation?.other_user_id === conv.other_user_id ? 'bg-pink-600/20' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-playfair">
                    {conv.first_name} {conv.last_name}
                  </h4>
                  <span className="text-xs text-gray-400">
                    {formatTime(conv.last_message_time)}
                  </span>
                </div>
                <p className="text-gray-300 text-sm truncate">
                  {conv.last_message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-pink-500/30">
              <h3 className="text-lg font-playfair text-white">
                {selectedConversation.first_name} {selectedConversation.last_name}
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    message.sender_id === user?.id
                      ? 'bg-pink-600 text-white'
                      : 'bg-gray-700 text-white'
                  }`}>
                    <p className="text-sm">{message.message_text}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs opacity-75">
                        {formatTime(message.created_at)}
                      </span>
                      {message.is_paid && (
                        <span className="text-xs bg-green-600 px-2 py-1 rounded">
                          ${message.price}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-pink-500/30">
              {/* Paid Reply Toggle (for readers) */}
              {user?.publicMetadata?.role === 'reader' && (
                <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPaidReply}
                      onChange={(e) => setIsPaidReply(e.target.checked)}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-white font-playfair">Paid Reply</span>
                  </label>
                  
                  {isPaidReply && (
                    <div className="mt-3 flex items-center space-x-2">
                      <label className="text-gray-300 text-sm">Price:</label>
                      <span className="text-white">$</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0.50"
                        max="50"
                        value={replyPrice}
                        onChange={(e) => setReplyPrice(parseFloat(e.target.value) || 0.50)}
                        className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-6 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isPaidReply ? `Send ($${replyPrice})` : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-playfair">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function StartConversationModal({ isOpen, onClose, readers, api }) {
  const [selectedReader, setSelectedReader] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const startConversation = async () => {
    if (!selectedReader || !message.trim()) return;

    setSending(true);
    try {
      await api.post('/api/messages/send', {
        recipient_id: selectedReader,
        message_text: message.trim(),
        is_paid: false,
        price: 0
      });
      
      alert('Message sent successfully!');
      onClose();
      setSelectedReader('');
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-md w-full">
        <h3 className="text-xl font-alex-brush text-pink-400 mb-4">
          Start New Conversation
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-white font-playfair mb-2">Select Reader</label>
            <select
              value={selectedReader}
              onChange={(e) => setSelectedReader(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
            >
              <option value="">Choose a reader...</option>
              {readers.map((reader) => (
                <option key={reader.user_id} value={reader.user_id}>
                  {reader.first_name} {reader.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white font-playfair mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={startConversation}
              disabled={sending || !selectedReader || !message.trim()}
              className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-playfair transition-colors"
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>
            
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-playfair transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default { MessagingInterface, StartConversationModal };
