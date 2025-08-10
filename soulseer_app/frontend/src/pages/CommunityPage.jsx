import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

/**
 * CommunityPage
 *
 * Displays forum topics and allows authenticated users to create new
 * discussions. Each topic links to a TopicPage for threaded posts.
 */
const CommunityPage = () => {
  const [topics, setTopics] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { getToken, isSignedIn } = useAuth();

  const fetchTopics = async () => {
    try {
      const res = await axios.get('/api/forum/topics');
      setTopics(res.data);
    } catch (err) {
      console.error('Failed to fetch topics', err);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const createTopic = async () => {
    if (!title || !content) return;
    try {
      const token = await getToken();
      await axios.post('/api/forum/topics', { title, content }, { headers: { Authorization: `Bearer ${token}` } });
      setTitle('');
      setContent('');
      fetchTopics();
    } catch (err) {
      console.error('Failed to create topic', err);
    }
  };

  return (
    <div className="p-6 text-white">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Community Forum</h2>
      {isSignedIn && (
        <div className="max-w-xl mx-auto mb-6 bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg">
          <h3 className="font-playfair text-2xl mb-2">Start a New Discussion</h3>
          <input
            type="text"
            placeholder="Topic title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 mb-2 text-soul-black rounded"
          />
          <textarea
            placeholder="Write your post..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2 mb-2 h-24 text-soul-black rounded"
          ></textarea>
          <button onClick={createTopic} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Publish</button>
        </div>
      )}
      <div className="space-y-4">
        {topics.map((topic) => (
          <div key={topic.id} className="bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg">
            <h3 className="font-playfair text-2xl mb-1">
              <Link to={`/community/${topic.id}`}>{topic.title}</Link>
            </h3>
            <p className="text-sm text-gray-300 mb-1">By {topic.author_name} on {new Date(topic.created_at).toLocaleString()}</p>
            <p className="text-gray-400">{topic.content.slice(0, 100)}{topic.content.length > 100 && '...'}</p>
          </div>
        ))}
        {topics.length === 0 && <p>No topics yet. Be the first to start a conversation!</p>}
      </div>
    </div>
  );
};

export default CommunityPage;