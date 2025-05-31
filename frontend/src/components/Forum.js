import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function ForumInterface({ api }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [currentCategory, setCurrentCategory] = useState('general');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'general', name: 'General Discussion', icon: '💬' },
    { id: 'tarot', name: 'Tarot Reading', icon: '🔮' },
    { id: 'astrology', name: 'Astrology', icon: '⭐' },
    { id: 'spirituality', name: 'Spirituality', icon: '🙏' },
    { id: 'dreams', name: 'Dream Interpretation', icon: '💭' },
    { id: 'meditation', name: 'Meditation', icon: '🧘' }
  ];

  useEffect(() => {
    loadPosts();
  }, [currentCategory]);

  useEffect(() => {
    if (selectedPost) {
      loadReplies(selectedPost.id);
    }
  }, [selectedPost]);

  const loadPosts = async () => {
    try {
      const response = await api.get(`/api/forum/posts?category=${currentCategory}`);
      setPosts(response.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async (postId) => {
    try {
      const response = await api.get(`/api/forum/posts/${postId}/replies`);
      setReplies(response.data);
    } catch (error) {
      console.error('Error loading replies:', error);
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
        <div className="text-white">Loading forum...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-alex-brush text-pink-400 mb-2">
          Community Forum
        </h1>
        <p className="text-gray-300 font-playfair">
          Connect with fellow seekers and share spiritual insights
        </p>
      </div>

      <div className="flex gap-6">
        {/* Categories Sidebar */}
        <div className="w-64">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-4">
            <h3 className="font-playfair text-white mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setCurrentCategory(category.id);
                    setSelectedPost(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentCategory === category.id
                      ? 'bg-pink-600/20 text-pink-400'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {!selectedPost ? (
            <PostsList 
              posts={posts}
              currentCategory={currentCategory}
              categories={categories}
              onSelectPost={setSelectedPost}
              onCreatePost={() => setShowCreatePost(true)}
              formatTime={formatTime}
            />
          ) : (
            <PostDetail
              post={selectedPost}
              replies={replies}
              onBack={() => setSelectedPost(null)}
              onReplyAdded={loadReplies}
              formatTime={formatTime}
              api={api}
            />
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        category={currentCategory}
        categories={categories}
        onPostCreated={() => {
          setShowCreatePost(false);
          loadPosts();
        }}
        api={api}
      />
    </div>
  );
}

function PostsList({ posts, currentCategory, categories, onSelectPost, onCreatePost, formatTime }) {
  const category = categories.find(c => c.id === currentCategory);

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30">
      {/* Header */}
      <div className="p-6 border-b border-pink-500/30 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-alex-brush text-pink-400 flex items-center">
            <span className="mr-2 text-2xl">{category?.icon}</span>
            {category?.name}
          </h2>
          <p className="text-gray-300 text-sm">{posts.length} posts</p>
        </div>
        <button
          onClick={onCreatePost}
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors"
        >
          New Post
        </button>
      </div>

      {/* Posts List */}
      <div className="divide-y divide-gray-700">
        {posts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">{category?.icon}</span>
            </div>
            <p className="font-playfair">No posts in this category yet</p>
            <p className="text-sm">Be the first to start a conversation!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="p-6 hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-white font-playfair font-bold hover:text-pink-400 transition-colors">
                  {post.title}
                </h3>
                {post.is_pinned && (
                  <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded text-xs">
                    📌 Pinned
                  </span>
                )}
              </div>
              
              <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                {post.content.substring(0, 150)}...
              </p>
              
              <div className="flex justify-between items-center text-sm text-gray-400">
                <div className="flex items-center space-x-4">
                  <span>By {post.first_name} {post.last_name}</span>
                  <span>{formatTime(post.created_at)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>💬 {post.reply_count} replies</span>
                  {post.last_reply_at && (
                    <span>• Last reply {formatTime(post.last_reply_at)}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PostDetail({ post, replies, onBack, onReplyAdded, formatTime, api }) {
  const { user } = useAuth();
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReply = async () => {
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/api/forum/posts/${post.id}/replies`, {
        post_id: post.id,
        content: replyContent.trim()
      });
      
      setReplyContent('');
      onReplyAdded(post.id);
    } catch (error) {
      console.error('Error submitting reply:', error);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30">
      {/* Header */}
      <div className="p-6 border-b border-pink-500/30">
        <button
          onClick={onBack}
          className="text-pink-400 hover:text-pink-300 mb-4 flex items-center transition-colors"
        >
          ← Back to posts
        </button>
        
        <h1 className="text-2xl font-alex-brush text-pink-400 mb-2">
          {post.title}
        </h1>
        
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>By {post.first_name} {post.last_name}</span>
          <span>{formatTime(post.created_at)}</span>
          <span>💬 {replies.length} replies</span>
        </div>
      </div>

      {/* Post Content */}
      <div className="p-6 border-b border-pink-500/30">
        <div className="text-white font-playfair whitespace-pre-wrap">
          {post.content}
        </div>
      </div>

      {/* Replies */}
      <div className="p-6">
        <h3 className="text-lg font-playfair text-white mb-4">
          Replies ({replies.length})
        </h3>
        
        <div className="space-y-6 mb-6">
          {replies.map((reply) => (
            <div key={reply.id} className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-pink-400 font-playfair">
                  {reply.first_name} {reply.last_name}
                </span>
                <span className="text-gray-400 text-sm">
                  {formatTime(reply.created_at)}
                </span>
              </div>
              <div className="text-white font-playfair whitespace-pre-wrap">
                {reply.content}
              </div>
            </div>
          ))}
        </div>

        {/* Reply Form */}
        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-white font-playfair mb-3">Add Reply</h4>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Share your thoughts..."
            rows={4}
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={submitReply}
              disabled={submitting || !replyContent.trim()}
              className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-playfair transition-colors"
            >
              {submitting ? 'Submitting...' : 'Post Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePostModal({ isOpen, onClose, category, categories, onPostCreated, api }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: category
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormData(prev => ({ ...prev, category }));
  }, [category]);

  if (!isOpen) return null;

  const submitPost = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/api/forum/posts', {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category
      });
      
      setFormData({ title: '', content: '', category });
      onPostCreated();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-2xl w-full">
        <h3 className="text-xl font-alex-brush text-pink-400 mb-6">
          Create New Post
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-white font-playfair mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white font-playfair mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Enter post title..."
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-white font-playfair mb-2">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              placeholder="Share your thoughts, experiences, or questions..."
              rows={8}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={submitPost}
              disabled={submitting || !formData.title.trim() || !formData.content.trim()}
              className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-playfair transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Post'}
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
    </div>
  );
}

export default ForumInterface;
