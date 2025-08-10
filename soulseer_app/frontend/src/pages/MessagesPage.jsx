import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { io } from 'socket.io-client';

// Create a singleton socket connection for messaging
const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001');

/**
 * MessagesPage
 *
 * Provides a basic messaging UI. The left pane lists available
 * contacts (readers), while the right pane shows the conversation
 * history and a form to send new messages. Real‑time updates are
 * delivered via Socket.io when new messages are posted.
 */
const MessagesPage = () => {
  const { getToken, userId } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await axios.get('/api/readers');
        setContacts(res.data);
      } catch (err) {
        console.error('Failed to fetch contacts', err);
      }
    }
    fetchContacts();
  }, []);

  useEffect(() => {
    if (!activeContact) return;
    async function fetchMessages() {
      try {
        const token = await getToken();
        const res = await axios.get(`/api/messages/${activeContact.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setMessages(res.data);
        // Join chat room for real‑time updates
        socket.emit('joinChat', { userId, contactId: activeContact.id });
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    }
    fetchMessages();
  }, [activeContact, getToken, userId]);

  useEffect(() => {
    socket.on('newMessage', (msg) => {
      // Append incoming message if it's for the active conversation
      if ((msg.sender_id === activeContact?.id && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === activeContact?.id)) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return () => {
      socket.off('newMessage');
    };
  }, [activeContact, userId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeContact) return;
    try {
      const token = await getToken();
      await axios.post('/api/messages', { receiverId: activeContact.id, content: newMessage }, { headers: { Authorization: `Bearer ${token}` } });
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <div className="p-6 text-white grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Contacts */}
      <div className="md:col-span-1 bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg h-[70vh] overflow-y-auto">
        <h3 className="font-playfair text-xl mb-2">Contacts</h3>
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              onClick={() => setActiveContact(contact)}
              className={`p-2 rounded cursor-pointer ${activeContact?.id === contact.id ? 'bg-soul-pink text-soul-black' : 'hover:bg-soul-gray-700'}`}
            >
              {contact.name || contact.email}
            </li>
          ))}
        </ul>
      </div>
      {/* Messages */}
      <div className="md:col-span-3 bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg h-[70vh] flex flex-col">
        {activeContact ? (
          <>
            <h3 className="font-playfair text-xl mb-2">Conversation with {activeContact.name || activeContact.email}</h3>
            <div className="flex-grow overflow-y-auto border border-soul-pink rounded p-2 mb-4">
              {messages.map((msg) => (
                <div key={msg.id} className="mb-2 text-sm">
                  <span className="font-semibold">{msg.sender_id === userId ? 'You' : activeContact.name || activeContact.email}:</span> {msg.content}
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-grow p-2 rounded-l text-soul-black"
                placeholder="Type your message..."
              />
              <button onClick={sendMessage} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded-r">Send</button>
            </div>
          </>
        ) : (
          <p>Select a contact to start messaging.</p>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;