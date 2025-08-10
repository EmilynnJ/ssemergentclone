import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

/**
 * HomePage
 *
 * Displays the SoulSeer landing page with hero imagery, tagline and
 * sections highlighting online readers, live streams and featured
 * products. Data is fetched from the backend API to ensure real
 * availability and up‑to‑date listings.
 */
const HomePage = () => {
  const [readers, setReaders] = useState([]);
  const [streams, setStreams] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [readRes, streamRes, prodRes] = await Promise.all([
          axios.get('/api/readers'),
          axios.get('/api/streams'),
          axios.get('/api/products'),
        ]);
        setReaders(readRes.data);
        setStreams(streamRes.data);
        setProducts(prodRes.data.slice(0, 4)); // show first 4 products
      } catch (err) {
        console.error('Failed to load home data', err);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="text-white">
      {/* Hero Section */}
      <section className="relative h-96 flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url('https://i.postimg.cc/tRLSgCPb/HERO-IMAGE-1.jpg')` }}>
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative z-10 text-center p-8">
          <h1 className="font-alex-brush text-6xl text-soul-pink drop-shadow-glow-pink mb-4">SoulSeer</h1>
          <p className="font-playfair text-xl max-w-xl mx-auto">A Community of Gifted Psychics</p>
        </div>
      </section>

      {/* Readers Section */}
      <section className="p-6">
        <h2 className="font-alex-brush text-4xl text-soul-pink mb-4">Online Readers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {readers.map((reader) => (
            <div key={reader.id} className="bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="font-playfair text-2xl mb-2">{reader.name || reader.email}</h3>
                <p className="text-sm mb-4">Available for readings now</p>
              </div>
              <Link to={`/readings?readerId=${reader.id}`} className="mt-auto inline-block text-center bg-soul-pink hover:bg-soul-pink-light text-soul-black font-bold py-2 px-4 rounded transition-colors duration-200">
                Start Reading
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Streams Section */}
      <section className="p-6">
        <h2 className="font-alex-brush text-4xl text-soul-pink mb-4">Live Streams</h2>
        {streams.length === 0 ? (
          <p className="font-playfair">No live streams at the moment. Check back later!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <div key={stream.id} className="bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg">
                <h3 className="font-playfair text-2xl mb-2">{stream.title}</h3>
                <p className="text-sm mb-2">Hosted by {stream.reader_name}</p>
                <p className="text-sm mb-4">Viewers: {stream.viewer_count}</p>
                <Link to={`/live/${stream.id}`} className="inline-block text-center bg-soul-pink hover:bg-soul-pink-light text-soul-black font-bold py-2 px-4 rounded transition-colors duration-200">Watch</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured Products Section */}
      <section className="p-6">
        <h2 className="font-alex-brush text-4xl text-soul-pink mb-4">Featured Products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((prod) => (
            <div key={prod.id} className="bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg">
              <img src={prod.image_url} alt={prod.name} className="w-full h-40 object-cover rounded" />
              <h3 className="font-playfair text-xl mt-2">{prod.name}</h3>
              <p className="text-sm mb-2">${prod.price.toFixed(2)}</p>
              <Link to={`/shop`} className="inline-block text-center bg-soul-pink hover:bg-soul-pink-light text-soul-black font-bold py-2 px-4 rounded transition-colors duration-200">Shop Now</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;