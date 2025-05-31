import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createAuthenticatedAxios } from '../App';

const AdminDashboard = () => {
  const { userId } = useAuth();
  const [adminUserProfile, setAdminUserProfile] = useState(null);
  const [readers, setReaders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false); // Keep existing Stripe sync states
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState(false);

  const authenticatedAxios = createAuthenticatedAxios();

  const fetchData = async (isInitialLoad = false) => {
    if(isInitialLoad) setLoading(true);
    setError('');
    try {
      const [userRes, readersRes, logsRes] = await Promise.all([
        authenticatedAxios.get('/api/user/profile'),
        authenticatedAxios.get('/api/admin/readers'),
        authenticatedAxios.get('/api/admin/logs')
      ]);
      setAdminUserProfile(userRes.data);
      setReaders(readersRes.data);
      setLogs(logsRes.data);
    } catch (err) {
      console.error("Error fetching admin data:", err);
      setError(err.response?.data?.detail || 'Failed to load admin data.');
    } finally {
      if(isInitialLoad) setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchData(true); // Initial data fetch
    } else {
      setLoading(false);
      setError("User ID not found. Please log in again.");
    }
  }, [userId]);

  const handleStripeSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    setSyncError(false);
    try {
      const response = await authenticatedAxios.post('/api/admin/stripe/sync-products');
      setSyncMessage(response.data.message || 'Stripe product sync initiated successfully.');
    } catch (err) {
      setSyncError(true);
      setSyncMessage(err.response?.data?.detail || 'Failed to initiate Stripe product sync.');
      console.error("Error syncing Stripe products:", err);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 7000);
    }
  };

  const handleReaderStatusUpdate = async (targetUserId, newStatus) => {
    if (!window.confirm(`Are you sure you want to set reader ${targetUserId} to ${newStatus}?`)) return;
    try {
      await authenticatedAxios.put(`/api/admin/reader/${targetUserId}/status`, { status: newStatus });
      fetchData(); // Re-fetch admin data to update the list
    } catch (err) {
      console.error(`Error updating reader ${targetUserId} status:`, err);
      setError(err.response?.data?.detail || "Failed to update reader status.");
    }
  };

  if (loading) {
    return <div className="p-8 text-white text-center">Loading admin dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-400 bg-red-900/30 rounded-md text-center">Error: {error}</div>;
  }

  return (
    <div className="p-8 text-white bg-black/30 backdrop-blur-md rounded-lg shadow-xl border border-red-500/30">
      <h1 className="text-4xl font-alex-brush text-red-400 mb-6">
        Admin Dashboard
      </h1>

      {adminUserProfile && (
        <div className="mb-6 p-4 bg-gray-800/50 rounded-md">
          <h2 className="text-2xl font-playfair text-purple-400 mb-2">Administrator Info</h2>
          <p><strong>Welcome, {adminUserProfile.first_name || adminUserProfile.email}!</strong></p>
          <p><strong>Role:</strong> {adminUserProfile.role}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Stripe Sync Card */}
        <div className="p-6 bg-gray-800/50 rounded-md">
          <h2 className="text-2xl font-playfair text-green-400 mb-3">Stripe Operations</h2>
          <p className="text-gray-400 mb-2">Initiate synchronization of products with Stripe.</p>
          <button
            onClick={handleStripeSync}
            disabled={syncing}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-playfair transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Stripe Products'}
          </button>
          {syncMessage && <p className={`mt-2 text-sm ${syncError ? 'text-red-400' : 'text-green-400'}`}>{syncMessage}</p>}
        </div>
        {/* Placeholder for other admin actions if needed */}
      </div>

      {/* Manage Readers Section */}
      <div className="p-6 bg-gray-800/50 rounded-md mb-8">
        <h2 className="text-2xl font-playfair text-blue-400 mb-3">Manage Readers</h2>
        {readers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs text-pink-300 uppercase bg-gray-700/50">
                <tr>
                  <th scope="col" className="py-3 px-6">Name</th>
                  <th scope="col" className="py-3 px-6">Email</th>
                  <th scope="col" className="py-3 px-6">App Status</th>
                  <th scope="col" className="py-3 px-6">Availability</th>
                  <th scope="col" className="py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {readers.map(reader => (
                  <tr key={reader.id} className="bg-gray-900/50 border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="py-4 px-6">{reader.first_name || ''} {reader.last_name || ''}</td>
                    <td className="py-4 px-6">{reader.email}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        reader.application_status === 'active' ? 'bg-green-700 text-green-200' :
                        reader.application_status === 'suspended' ? 'bg-red-700 text-red-200' :
                        'bg-yellow-700 text-yellow-200'}`
                      }>
                        {reader.application_status}
                      </span>
                    </td>
                    <td className="py-4 px-6">{reader.availability_status}</td>
                    <td className="py-4 px-6 space-x-1">
                      {reader.application_status !== 'active' && (
                        <button onClick={() => handleReaderStatusUpdate(reader.id, 'active')} className="text-green-400 hover:text-green-300 text-xs">Approve</button>
                      )}
                      {reader.application_status !== 'suspended' && (
                        <button onClick={() => handleReaderStatusUpdate(reader.id, 'suspended')} className="text-red-400 hover:text-red-300 text-xs">Suspend</button>
                      )}
                       {reader.application_status === 'suspended' && (
                        <button onClick={() => handleReaderStatusUpdate(reader.id, 'active')} className="text-yellow-400 hover:text-yellow-300 text-xs">Re-activate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400">No readers found or to manage.</p>}
      </div>

      {/* View System Logs Section */}
      <div className="p-6 bg-gray-800/50 rounded-md">
        <h2 className="text-2xl font-playfair text-yellow-400 mb-3">System Logs</h2>
        {logs.length > 0 ? (
          <ul className="space-y-1 text-xs max-h-60 overflow-y-auto bg-gray-900/30 p-2 rounded">
            {logs.map((log, index) => (
              <li key={index} className={`p-1 rounded ${log.level === 'ERROR' ? 'text-red-300' : log.level === 'WARNING' ? 'text-yellow-300' : 'text-gray-300'}`}>
                [{new Date(log.timestamp).toLocaleString()}] [{log.level}] {log.message}
              </li>
            ))}
          </ul>
        ) : <p className="text-gray-400">No logs to display.</p>}
      </div>
    </div>
  );
};

export default AdminDashboard;
