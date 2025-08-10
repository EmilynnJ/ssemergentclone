import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

/**
 * ReaderList
 *
 * Fetches and displays a list of all available readers. Clients can
 * initiate a reading by clicking the “Request Reading” button, which
 * creates a session on the backend and navigates the user to the
 * CallPage with the generated sessionId and roomId. The per‑minute rate
 * should ideally come from the reader’s profile; for now this uses a
 * hardcoded example rate.
 */
const ReaderList = () => {
  const [readers, setReaders] = useState([]);
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    const fetchReaders = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/readers`);
        setReaders(res.data);
      } catch (err) {
        console.error('Failed to fetch readers', err);
      }
    };
    fetchReaders();
  }, [API_BASE]);

  const startSession = async (readerId) => {
    try {
      // Obtain JWT from Clerk to authorize the request
      const token = await getToken();
      const ratePerMinute = 5; // TODO: fetch actual rate from reader profile
      const res = await axios.post(
        `${API_BASE}/api/sessions/start`,
        { readerId, ratePerMinute },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const { sessionId, roomId } = res.data;
      // Navigate to call page with parameters
      navigate(`/call/${sessionId}?roomId=${roomId}`);
    } catch (err) {
      console.error('Failed to start session', err);
      alert('Could not start session. Please try again.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <h2 className="text-4xl font-alex-brush text-soul-pink mb-4 text-center">Available Readers</h2>
      <ul className="space-y-4">
        {readers.map((reader) => (
          <li
            key={reader.id}
            className="p-4 bg-soul-gray-800 rounded-lg flex items-center justify-between shadow-lg"
          >
            <div>
              <p className="text-xl font-playfair">{reader.name || reader.email}</p>
              <p className="text-sm text-soul-gray-300">Per‑minute rate: $5</p>
            </div>
            <button
              onClick={() => startSession(reader.id)}
              className="px-4 py-2 bg-soul-pink hover:bg-soul-pink-light text-white rounded mystical-glow-hover"
            >
              Request Reading
            </button>
          </li>
        ))}
        {readers.length === 0 && <p>No readers available at this time.</p>}
      </ul>
    </div>
  );
};

export default ReaderList;