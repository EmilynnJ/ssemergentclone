import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import { io } from 'socket.io-client';

/**
 * CallPage
 *
 * Manages a one‑on‑one reading session between a client and a reader. This
 * component sets up a WebRTC peer connection, handles signaling via
 * Socket.io, displays local and remote video streams, shows a
 * session timer, and calls the backend to end the session when the
 * user hangs up. The sessionId and roomId are passed via the URL.
 */
const CallPage = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');
  const { getToken, userId } = useAuth();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';
  const iceServersEnv = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  const iceServers = iceServersEnv ? JSON.parse(iceServersEnv) : [{ urls: 'stun:stun.l.google.com:19302' }];

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const [duration, setDuration] = useState(0);

  // Convert seconds to mm:ss format
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    const startCall = async () => {
      try {
        // Get local media
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        // Initialize RTCPeerConnection
        peerRef.current = new RTCPeerConnection({ iceServers });
        // Add local tracks
        localStream.getTracks().forEach((track) => peerRef.current.addTrack(track, localStream));
        // When remote track arrives, set remote video
        peerRef.current.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };
        // Handle ICE candidates
        peerRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit('signal', {
              roomId,
              targetId: null,
              data: { type: 'ice-candidate', candidate: event.candidate },
            });
          }
        };
        // Connect to Socket.io server
        socketRef.current = io(API_BASE, { transports: ['websocket'] });
        socketRef.current.emit('joinRoom', { roomId, userId });
        // Listen for signaling messages
        socketRef.current.on('signal', async ({ from, data }) => {
          if (!peerRef.current) return;
          switch (data.type) {
            case 'offer':
              await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answer = await peerRef.current.createAnswer();
              await peerRef.current.setLocalDescription(answer);
              socketRef.current.emit('signal', { roomId, targetId: from, data: { type: 'answer', answer } });
              break;
            case 'answer':
              await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              break;
            case 'ice-candidate':
              try {
                await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (err) {
                console.error('Error adding received ICE candidate', err);
              }
              break;
            default:
              break;
          }
        });
        // Create an offer as the first peer
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socketRef.current.emit('signal', {
          roomId,
          targetId: null,
          data: { type: 'offer', offer },
        });
        // Start session timer
        timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
      } catch (err) {
        console.error('Error starting call', err);
        alert('Unable to start media devices. Please check your camera and microphone permissions.');
      }
    };
    startCall();
    // Cleanup on unmount
    return () => {
      clearInterval(timerRef.current);
      peerRef.current?.close();
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // End call handler
  const endCall = async () => {
    clearInterval(timerRef.current);
    try {
      const token = await getToken();
      await axios.post(
        `${API_BASE}/api/sessions/end`,
        { sessionId: parseInt(sessionId, 10) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      console.error('Failed to end session', err);
    }
    peerRef.current?.close();
    socketRef.current?.disconnect();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-soul-black text-soul-gray-100 flex flex-col items-center py-6">
      <h2 className="text-3xl font-alex-brush text-soul-pink mb-4">Live Reading Session</h2>
      <div className="flex flex-col md:flex-row gap-4 justify-center items-center w-full max-w-5xl">
        <video ref={localVideoRef} autoPlay muted playsInline className="bg-black w-72 h-52 md:w-96 md:h-60 rounded-lg shadow-inner" />
        <video ref={remoteVideoRef} autoPlay playsInline className="bg-black w-72 h-52 md:w-96 md:h-60 rounded-lg shadow-inner" />
      </div>
      <div className="mt-4 text-lg font-playfair">
        Duration: {formatDuration(duration)}
      </div>
      <button
        onClick={endCall}
        className="mt-6 px-6 py-3 bg-soul-purple hover:bg-soul-purple-dark text-white rounded mystical-glow-hover"
      >
        End Session
      </button>
    </div>
  );
};

export default CallPage;