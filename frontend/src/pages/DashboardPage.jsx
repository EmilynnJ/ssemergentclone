import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

/**
 * DashboardPage
 *
 * Presents role‑specific dashboards for clients, readers and admins. Clients
 * see session history and spending; readers see earnings and can start
 * live streams; admins can view and manage users. Data is fetched
 * from the backend using the authenticated token.
 */
const DashboardPage = () => {
  const { getToken, user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [newReaderEmail, setNewReaderEmail] = useState('');
  const [streamTitle, setStreamTitle] = useState('');

  const fetchDashboard = async () => {
    try {
      const token = await getToken();
      const metricsRes = await axios.get('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
      setMetrics(metricsRes.data);
      const sessionsRes = await axios.get('/api/sessions', { headers: { Authorization: `Bearer ${token}` } });
      setSessions(sessionsRes.data);
      // Admin loads users list
      if (user?.publicMetadata?.role === 'admin' || metricsRes.data.userCounts) {
        const usersRes = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard', err);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const startStream = async () => {
    if (!streamTitle.trim()) return;
    try {
      const token = await getToken();
      await axios.post('/api/streams/start', { title: streamTitle, description: '' }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Stream started! Find it in Live page.');
      setStreamTitle('');
    } catch (err) {
      console.error('Failed to start stream', err);
      alert('Error starting stream.');
    }
  };

  const createReader = async () => {
    if (!newReaderEmail.trim()) return;
    try {
      const token = await getToken();
      // Create user record with role reader (simulate admin creation)
      await axios.post('/api/admin/users', { email: newReaderEmail, role: 'reader' }, { headers: { Authorization: `Bearer ${token}` } });
      setNewReaderEmail('');
      fetchDashboard();
    } catch (err) {
      console.error('Failed to create reader', err);
      alert('Error creating reader.');
    }
  };

  return (
    <div className="p-6 text-white">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Dashboard</h2>
      {!metrics ? (
        <p>Loading metrics...</p>
      ) : (
        <>
          {user?.publicMetadata?.role === 'client' || (!user?.publicMetadata?.role && metrics.sessionsCount !== undefined) ? (
            <div>
              <h3 className="font-playfair text-2xl mb-2">Your Session Summary</h3>
              <p className="mb-2">Total sessions: {metrics.sessionsCount}</p>
              <p className="mb-4">Total spent: ${metrics.totalSpent.toFixed(2)}</p>
              <h4 className="font-playfair text-xl mb-2">Session History</h4>
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="bg-soul-black bg-opacity-70 p-2 rounded">
                    Session #{s.id} with reader {s.reader_id}, minutes: {s.total_minutes || '—'}, amount: ${s.amount_charged || 0}
                  </li>
                ))}
                {sessions.length === 0 && <p>You have no sessions yet.</p>}
              </ul>
            </div>
          ) : null}
          {user?.publicMetadata?.role === 'reader' || (metrics.totalEarned !== undefined && metrics.sessionsCount !== undefined && !metrics.userCounts) ? (
            <div>
              <h3 className="font-playfair text-2xl mb-2">Reader Overview</h3>
              <p className="mb-2">Total sessions conducted: {metrics.sessionsCount}</p>
              <p className="mb-4">Total earned: ${metrics.totalEarned.toFixed(2)}</p>
              <h4 className="font-playfair text-xl mb-2">Session History</h4>
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="bg-soul-black bg-opacity-70 p-2 rounded">
                    Session #{s.id} with client {s.client_id}, minutes: {s.total_minutes || '—'}, amount: ${s.amount_charged || 0}
                  </li>
                ))}
                {sessions.length === 0 && <p>You have no sessions yet.</p>}
              </ul>
              {/* Stream start form */}
              <div className="mt-4">
                <h4 className="font-playfair text-xl mb-2">Start a Live Stream</h4>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="Stream title"
                  className="p-2 text-soul-black rounded mr-2"
                />
                <button onClick={startStream} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Start</button>
              </div>
            </div>
          ) : null}
          {metrics.userCounts ? (
            <div>
              <h3 className="font-playfair text-2xl mb-2">Admin Metrics</h3>
              <p className="mb-2">Total users: {users.length}</p>
              <p className="mb-2">Total sessions: {metrics.totalSessions}</p>
              <h4 className="font-playfair text-xl mb-2">User Roles</h4>
              <ul className="mb-4">
                {metrics.userCounts.map((uc) => (
                  <li key={uc.role}>Role {uc.role}: {uc.count}</li>
                ))}
              </ul>
              <h4 className="font-playfair text-xl mb-2">Add New Reader</h4>
              <input
                type="email"
                value={newReaderEmail}
                onChange={(e) => setNewReaderEmail(e.target.value)}
                placeholder="Reader email"
                className="p-2 text-soul-black rounded mr-2"
              />
              <button onClick={createReader} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Create Reader</button>
              <h4 className="font-playfair text-xl mt-6 mb-2">All Users</h4>
              <ul className="space-y-1">
                {users.map((u) => (
                  <li key={u.id} className="bg-soul-black bg-opacity-70 p-2 rounded">{u.name || u.email} – {u.role}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default DashboardPage;