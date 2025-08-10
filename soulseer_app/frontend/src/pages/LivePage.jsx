import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

/**
 * LivePage
 *
 * Lists all currently active live streams. Readers can start their own
 * streams via the reader dashboard; clients can browse and watch
 * ongoing streams. Each card links to an individual LiveStreamPage.
 */
const LivePage = () => {
  const [streams, setStreams] = useState([]);
  useEffect(() => {
    async function fetchStreams() {
      try {
        const res = await axios.get('/api/streams');
        setStreams(res.data);
      } catch (err) {
        console.error('Failed to fetch live streams', err);
      }
    }
    fetchStreams();
  }, []);
  return (
    <div className="p-6 text-white">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Live Streams</h2>
      {streams.length === 0 ? (
        <p className="font-playfair text-center">No live streams are active right now. Check back soon!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((stream) => (
            <div key={stream.id} className="bg-soul-black bg-opacity-70 p-4 rounded-lg backdrop-blur-md shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="font-playfair text-2xl mb-2">{stream.title}</h3>
                <p className="text-sm mb-1">Hosted by {stream.reader_name}</p>
                <p className="text-sm mb-4">Viewers: {stream.viewer_count}</p>
              </div>
              <Link to={`/live/${stream.id}`} className="inline-block text-center bg-soul-pink hover:bg-soul-pink-light text-soul-black font-bold py-2 px-4 rounded transition-colors duration-200">Watch Stream</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LivePage;