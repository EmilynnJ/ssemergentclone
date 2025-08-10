import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

// Establish a singleton Socket.io connection
const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001');

/**
 * LiveStreamPage
 *
 * Allows users to watch an active live stream, participate in a live chat and
 * send virtual gifts. The stream video is displayed via an HTML5 video
 * element that plays the reader’s media track using WebRTC. Gift sending
 * uses Stripe PaymentElement to collect payment information and completes
 * a payment intent on the backend when a gift is sent.
 */
const LiveStreamPage = () => {
  const { id } = useParams();
  const { userId, getToken } = useAuth();
  const [stream, setStream] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedGift, setSelectedGift] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const videoRef = useRef();
  const peerConnectionRef = useRef(null);
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    // Fetch stream details and gift catalogue
    async function fetchStream() {
      try {
        const [streamsRes, giftsRes] = await Promise.all([
          axios.get('/api/streams'),
          axios.get('/api/gifts'),
        ]);
        const found = streamsRes.data.find((s) => String(s.id) === String(id));
        setStream(found);
        setGifts(giftsRes.data);
      } catch (err) {
        console.error('Failed to load stream', err);
      }
    }
    fetchStream();
  }, [id]);

  useEffect(() => {
    // Join the stream room for viewer count tracking and gift events
    socket.emit('joinStream', { streamId: id, userId });
    socket.on('giftReceived', (data) => {
      if (data.streamId === Number(id)) {
        // Prepend gift notification to chat
        setChatMessages((msgs) => [
          { sender: 'SYSTEM', content: `Gift sent: ${data.gift.name} worth $${data.gift.value}`, timestamp: new Date().toISOString() },
          ...msgs,
        ]);
      }
    });
    return () => {
      socket.off('giftReceived');
    };
  }, [id, userId]);

  // Setup WebRTC for watching video
  useEffect(() => {
    // Only run if stream exists and user is not a reader (we assume stream owner uses a different UI)
    async function setupMedia() {
      if (!stream) return;
      // Acquire local audio track muted to satisfy some browsers' autoplay policies
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.getTracks().forEach((t) => t.stop());
      const peerConnection = new RTCPeerConnection({ iceServers: JSON.parse(import.meta.env.VITE_WEBRTC_ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]') });
      peerConnectionRef.current = peerConnection;
      socket.emit('joinRoom', { roomId: `stream-${id}`, userId });
      // When remote track arrives, attach to video
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      };
      // Listen for signaling
      socket.on('signal', async ({ from, data }) => {
        if (data.type === 'offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit('signal', { roomId: `stream-${id}`, targetId: data.senderId || from, data: peerConnection.localDescription });
        } else if (data.type === 'ice-candidate') {
          try {
            await peerConnection.addIceCandidate(data.candidate);
          } catch (err) {
            console.error('Error adding ICE candidate', err);
          }
        }
      });
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('signal', { roomId: `stream-${id}`, targetId: null, data: { type: 'ice-candidate', candidate: event.candidate } });
        }
      };
    }
    setupMedia();
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      socket.off('signal');
    };
  }, [stream, id, userId]);

  // Handle sending chat messages (this uses HTTP; can be swapped to websockets)
  const sendMessage = async () => {
    if (!message.trim()) return;
    setChatMessages((msgs) => [
      { sender: 'You', content: message, timestamp: new Date().toISOString() },
      ...msgs,
    ]);
    setMessage('');
  };

  const handleGiftSend = async (gift) => {
    setSelectedGift(gift);
    try {
      const token = await getToken();
      const res = await axios.post(`/api/streams/${id}/gifts`, { giftId: gift.id }, { headers: { Authorization: `Bearer ${token}` } });
      setClientSecret(res.data.clientSecret);
    } catch (err) {
      console.error('Failed to initiate gift payment', err);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: {} });
      if (result.error) {
        console.error(result.error.message);
      } else {
        // Payment succeeded
        setClientSecret(null);
        setSelectedGift(null);
      }
    } catch (err) {
      console.error('Error confirming payment', err);
    }
  };

  return (
    <div className="p-6 text-white">
      {stream ? (
        <>
          <h2 className="font-alex-brush text-5xl text-soul-pink mb-2 text-center">{stream.title}</h2>
          <p className="text-center mb-6">Hosted by {stream.reader_name}</p>
          {/* Video Player */}
          <div className="relative w-full max-w-3xl mx-auto">
            <video ref={videoRef} autoPlay playsInline controls className="w-full rounded-lg shadow-lg"></video>
          </div>
          {/* Chat and Gifts */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chat */}
            <div className="col-span-2 bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg flex flex-col">
              <h3 className="font-playfair text-xl mb-2">Live Chat</h3>
              <div className="flex-grow overflow-y-auto h-64 border border-soul-pink rounded p-2 space-y-2">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className="text-sm"><span className="font-semibold">{m.sender}: </span>{m.content}</div>
                ))}
              </div>
              <div className="mt-4 flex">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-grow p-2 rounded-l border border-soul-pink bg-soul-black"
                  placeholder="Type your message..."
                />
                <button onClick={sendMessage} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 rounded-r">Send</button>
              </div>
            </div>
            {/* Gifts */}
            <div className="bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg">
              <h3 className="font-playfair text-xl mb-2">Send a Gift</h3>
              <ul className="space-y-3">
                {gifts.map((gift) => (
                  <li key={gift.id} className="flex justify-between items-center">
                    <span>{gift.name} - ${gift.value.toFixed(2)}</span>
                    <button onClick={() => handleGiftSend(gift)} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-2 py-1 rounded">Send</button>
                  </li>
                ))}
              </ul>
              {clientSecret && selectedGift && (
                <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-2">
                  <PaymentElement options={{ clientSecret }} />
                  <button type="submit" className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded w-full">Confirm Gift Payment</button>
                </form>
              )}
            </div>
          </div>
        </>
      ) : (
        <p>Loading stream...</p>
      )}
    </div>
  );
};

export default LiveStreamPage;