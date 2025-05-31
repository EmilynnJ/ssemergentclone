import React, { useState, useEffect, useRef } from 'react';
import { createAuthenticatedAxios } from '../App'; // Adjust path if App.js is not the correct location

const SessionCallUI = ({ session, auth, onHangUp }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [signalingWs, setSignalingWs] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('initializing'); // initializing, connecting, connected, failed, disconnected

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null); // To hold peerConnection instance for cleanup and access in handlers

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  // Determine the other participant's user ID
  // This assumes session object has client.user_id and reader.user_id or similar
  // For this example, let's assume session prop contains a structure like:
  // session = { id, room_id, client_user_id, reader_user_id, session_type }
  // And auth.userId is the current logged-in user's ID.
  const otherParticipantUserId = auth.userId === session.client_user_id ? session.reader_user_id : session.client_user_id;


  useEffect(() => {
    let pc;
    let ws;
    let localMediaStream;

    const initializeWebRTC = async () => {
      setConnectionStatus('fetching_config');
      try {
        const axiosInstance = createAuthenticatedAxios(); // For fetching ICE config
        const response = await axiosInstance.get('/api/webrtc/config');
        const iceConfig = response.data;

        pc = new RTCPeerConnection(iceConfig);
        pcRef.current = pc;
        setPeerConnection(pc); // Or manage via ref primarily

        pc.onicecandidate = (event) => handleIceCandidateEvent(event, ws); // Pass ws to handler
        pc.ontrack = handleTrackEvent;
        pc.onconnectionstatechange = () => {
            if(pcRef.current) {
                setConnectionStatus(pcRef.current.connectionState);
            }
        };

        setConnectionStatus('media_setup');
        // Get local media
        localMediaStream = await navigator.mediaDevices.getUserMedia({
          video: session.session_type === 'video', // Enable video only if it's a video session
          audio: true,
        });
        setLocalStream(localMediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localMediaStream;
        }
        localMediaStream.getTracks().forEach(track => pc.addTrack(track, localMediaStream));

        // Establish WebSocket connection for signaling
        setConnectionStatus('signaling_setup');
        const wsUrlPath = `/api/webrtc/${session.room_id}/${auth.userId}?token=${auth.token}`;
        // Ensure correct WebSocket protocol (ws or wss)
        const backendHost = API_BASE_URL.replace(/^http/, 'ws');
        ws = new WebSocket(`${backendHost}${wsUrlPath}`);
        setSignalingWs(ws);

        ws.onopen = () => {
          setConnectionStatus('signaling_open');
          console.log('WebRTC Signaling WebSocket connected.');
          // Determine if this client should make the offer
          // Assuming client initiates the offer, adjust if reader should
          // This logic might need more robust role checking from session/auth props
          if (auth.userId === session.client_user_id) {
            createAndSendOffer(pc, ws);
          }
        };

        ws.onmessage = handleSignalingMessage;

        ws.onerror = (error) => {
          console.error('WebSocket Error:', error);
          setConnectionStatus('failed');
        };
        ws.onclose = () => {
          console.log('WebSocket Disconnected');
          setConnectionStatus('disconnected');
        };

      } catch (error) {
        console.error('Failed to initialize WebRTC:', error);
        setConnectionStatus('failed');
        if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            alert("No camera/microphone found. Please ensure they are connected and permissions are allowed.");
        } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            alert("Camera/microphone access denied. Please allow access in your browser settings.");
        }
      }
    };

    const createAndSendOffer = async (peerConn, webSocket) => {
      try {
        setConnectionStatus('creating_offer');
        const offer = await peerConn.createOffer();
        await peerConn.setLocalDescription(offer);
        setConnectionStatus('sending_offer');
        webSocket.send(JSON.stringify({ type: 'offer', target: otherParticipantUserId, data: peerConn.localDescription }));
      } catch (error) {
        console.error('Error creating offer:', error);
        setConnectionStatus('failed');
      }
    };

    const handleIceCandidateEvent = (event, webSocket) => {
      if (event.candidate && webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify({ type: 'ice-candidate', target: otherParticipantUserId, data: event.candidate }));
      }
    };

    const handleTrackEvent = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      } else {
        // Fallback for older browsers
        if (!remoteStream || remoteStream.id !== event.streams[0].id) {
            let newStream = new MediaStream();
            event.track.onunmute = () => {
                newStream.addTrack(event.track);
                setRemoteStream(newStream);
                if(remoteVideoRef.current) remoteVideoRef.current.srcObject = newStream;
            };
        }
      }
    };

    const handleSignalingMessage = async (event) => {
        const message = JSON.parse(event.data);
        const currentPC = pcRef.current; // Use the ref to get current peer connection
        if (!currentPC) return;

        try {
            if (message.type === 'offer') {
                if (message.sender === auth.userId) return; // Ignore self-sent offers
                setConnectionStatus('received_offer');
                await currentPC.setRemoteDescription(new RTCSessionDescription(message.data));
                const answer = await currentPC.createAnswer();
                await currentPC.setLocalDescription(answer);
                if (signalingWs && signalingWs.readyState === WebSocket.OPEN) {
                     signalingWs.send(JSON.stringify({ type: 'answer', target: message.sender, data: currentPC.localDescription }));
                }
            } else if (message.type === 'answer') {
                 if (message.sender === auth.userId) return; // Ignore self-sent answers
                setConnectionStatus('received_answer');
                await currentPC.setRemoteDescription(new RTCSessionDescription(message.data));
            } else if (message.type === 'ice-candidate') {
                if (message.sender === auth.userId || !message.data) return;
                await currentPC.addIceCandidate(new RTCIceCandidate(message.data));
            } else if (message.type === 'user_joined' || message.type === 'user_left') {
                console.log("Signaling server message:", message);
            }
        } catch (error) {
            console.error('Error handling signaling message:', error);
        }
    };

    initializeWebRTC();

    return () => {
      // Cleanup
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(track => track.stop());
      }
      setLocalStream(null);
      setRemoteStream(null);
      setPeerConnection(null);
      setSignalingWs(null);
    };
  }, [session.room_id, auth.userId, auth.token, session.client_user_id, session.reader_user_id, session.session_type]); // Dependencies

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && session.session_type === 'video') {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const handleHangUpInternal = () => {
    if (signalingWs && signalingWs.readyState === WebSocket.OPEN) {
        signalingWs.send(JSON.stringify({ type: 'end-call', target: otherParticipantUserId, room_id: session.room_id }));
    }
    onHangUp(); // Propagate to parent to handle API call for session end
  };

  return (
    <div className="p-4 bg-black/70 backdrop-blur-sm rounded-lg shadow-xl border border-pink-500/50 text-white">
      <h2 className="text-2xl font-alex-brush text-pink-400 mb-4">Session Call ({session.session_type})</h2>
      <p className="text-sm text-gray-400 mb-2">Status: <span className="font-semibold text-yellow-300">{connectionStatus}</span></p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-lg font-playfair mb-1">Your View</h3>
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-48 bg-gray-900 rounded border border-gray-700" />
        </div>
        <div>
          <h3 className="text-lg font-playfair mb-1">Remote View</h3>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-48 bg-gray-800 rounded border border-gray-700" />
        </div>
      </div>
      <div className="flex justify-center space-x-3">
        <button onClick={toggleMute} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-playfair">
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        {session.session_type === 'video' && (
          <button onClick={toggleVideo} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-playfair">
            {isVideoEnabled ? 'Hide Video' : 'Show Video'}
          </button>
        )}
        <button onClick={handleHangUpInternal} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-playfair">
          Hang Up
        </button>
      </div>
    </div>
  );
};

export default SessionCallUI;
