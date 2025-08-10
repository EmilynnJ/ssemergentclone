import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

/**
 * TopicPage
 *
 * Shows the posts for a single discussion topic and allows
 * authenticated users to contribute replies. Posts are displayed
 * chronologically. After submitting, the post list refreshes.
 */
const TopicPage = () => {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const { getToken, isSignedIn } = useAuth();

  const fetchData = async () => {
    try {
      // Get topics list to find the selected topic details
      const topicsRes = await axios.get('/api/forum/topics');
      const found = topicsRes.data.find((t) => String(t.id) === String(id));
      setTopic(found);
      const postsRes = await axios.get(`/api/forum/topics/${id}/posts`);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Failed to load topic', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const submitPost = async () => {
    if (!newPost.trim()) return;
    try {
      const token = await getToken();
      await axios.post(`/api/forum/topics/${id}/posts`, { content: newPost }, { headers: { Authorization: `Bearer ${token}` } });
      setNewPost('');
      fetchData();
    } catch (err) {
      console.error('Failed to submit post', err);
    }
  };

  return (
    <div className="p-6 text-white">
      {topic ? (
        <>
          <h2 className="font-playfair text-3xl mb-2">{topic.title}</h2>
          <p className="text-sm text-gray-300 mb-4">By {topic.author_name} on {new Date(topic.created_at).toLocaleString()}</p>
          <p className="mb-6">{topic.content}</p>
          <div className="space-y-4 mb-6">
            {posts.map((post) => (
              <div key={post.id} className="bg-soul-black bg-opacity-70 backdrop-blur-md p-3 rounded shadow">
                <p className="text-sm text-soul-pink">{post.author_name}:</p>
                <p className="text-sm">{post.content}</p>
              </div>
            ))}
            {posts.length === 0 && <p>No replies yet.</p>}
          </div>
          {isSignedIn && (
            <div className="max-w-xl">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-2 h-24 text-soul-black rounded mb-2"
              ></textarea>
              <button onClick={submitPost} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Post Reply</button>
            </div>
          )}
        </>
      ) : (
        <p>Loading topic...</p>
      )}
    </div>
  );
};

export default TopicPage;