import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/clerk-react';

/**
 * ProfilePage
 *
 * Enables users to view and update their personal profile information.
 * Changes are persisted to the backend via the /api/users/me endpoint.
 */
const ProfilePage = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.fullName || '');
      setEmail(user.primaryEmailAddress?.emailAddress || '');
    }
  }, [user]);

  const saveProfile = async () => {
    try {
      const token = await getToken();
      const res = await axios.put('/api/users/me', { name, email }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('Profile updated successfully');
    } catch (err) {
      console.error('Failed to update profile', err);
      setMessage('Error updating profile');
    }
  };

  return (
    <div className="p-6 text-white max-w-lg mx-auto">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Your Profile</h2>
      <label className="block mb-2 font-playfair">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-2 mb-4 text-soul-black rounded"
      />
      <label className="block mb-2 font-playfair">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 mb-4 text-soul-black rounded"
      />
      <button onClick={saveProfile} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Save Changes</button>
      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
};

export default ProfilePage;