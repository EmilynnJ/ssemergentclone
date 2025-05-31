import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingSocket = null;
    this.chatChannel = null;
    this.roomId = null;
    this.userId = null;
    this.isInitiator = false;
    this.onRemoteStreamCallback = null;
    this.onLocalStreamCallback = null;
    this.onConnectionStateCallback = null;
    this.onDisconnectCallback = null;
    this.onChatMessageCallback = null;
  }

  async initialize(roomId, userId, sessionType = 'video', isInitiator = false) {
    this.roomId = roomId;
    this.userId = userId;
    this.isInitiator = isInitiator;
    this.sessionType = sessionType;

    // Get WebRTC configuration from backend
    const response = await fetch(`${import.meta.env.REACT_APP_BACKEND_URL}/api/webrtc/config`);
    const config = await response.json();

    // Create peer connection
    this.peerConnection = new RTCPeerConnection(config);

    // Set up event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      this.remoteStream = event.streams[0];
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(this.peerConnection.connectionState);
      }
      
      if (this.peerConnection.connectionState === 'disconnected' || 
          this.peerConnection.connectionState === 'failed') {
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback();
        }
      }
    };

    // Set up data channel for chat
    this.setupDataChannel();

    // Get user media based on session type
    if (sessionType !== 'chat') {
      await this.getUserMedia(sessionType === 'video', true);
    }

    // Connect to signaling server
    await this.connectSignaling();
  }

  setupDataChannel() {
    if (this.isInitiator) {
      // Initiator creates the data channel
      this.chatChannel = this.peerConnection.createDataChannel('chat', {
        ordered: true
      });
      this.setupDataChannelEvents(this.chatChannel);
    } else {
      // Receiver waits for data channel
      this.peerConnection.ondatachannel = (event) => {
        this.chatChannel = event.channel;
        this.setupDataChannelEvents(this.chatChannel);
      };
    }
  }

  setupDataChannelEvents(channel) {
    channel.onopen = () => {
      console.log('Chat channel opened');
    };

    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (this.onChatMessageCallback) {
        this.onChatMessageCallback(message);
      }
    };

    channel.onclose = () => {
      console.log('Chat channel closed');
    };

    channel.onerror = (error) => {
      console.error('Chat channel error:', error);
    };
  }

  sendChatMessage(message) {
    if (this.chatChannel && this.chatChannel.readyState === 'open') {
      const chatMessage = {
        type: 'text',
        text: message,
        timestamp: Date.now(),
        userId: this.userId
      };
      
      this.chatChannel.send(JSON.stringify(chatMessage));
      return chatMessage;
    }
    return null;
  }

  async getUserMedia(videoEnabled = true, audioEnabled = true) {
    try {
      const constraints = {
        video: videoEnabled ? { 
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async connectSignaling() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/webrtc/${this.roomId}?user_id=${this.userId}`;
    
    this.signalingSocket = new WebSocket(wsUrl);

    this.signalingSocket.onopen = () => {
      console.log('Connected to signaling server');
      
      // If initiator, create offer
      if (this.isInitiator) {
        setTimeout(() => this.createOffer(), 1000);
      }
    };

    this.signalingSocket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      await this.handleSignalingMessage(message);
    };

    this.signalingSocket.onclose = () => {
      console.log('Signaling connection closed');
    };

    this.signalingSocket.onerror = (error) => {
      console.error('Signaling error:', error);
    };
  }

  async handleSignalingMessage(message) {
    switch (message.type) {
      case 'offer':
        await this.handleOffer(message);
        break;
      case 'answer':
        await this.handleAnswer(message);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message);
        break;
      case 'user_joined':
        console.log('User joined:', message.user_id);
        if (this.isInitiator && message.user_id !== this.userId) {
          // Someone joined, create offer
          setTimeout(() => this.createOffer(), 1000);
        }
        break;
      case 'user_left':
        console.log('User left:', message.user_id);
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback();
        }
        break;
    }
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: this.sessionType !== 'chat',
        offerToReceiveVideo: this.sessionType === 'video'
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignalingMessage({
        type: 'offer',
        sdp: offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(message) {
    try {
      await this.peerConnection.setRemoteDescription(message.sdp);
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.sendSignalingMessage({
        type: 'answer',
        sdp: answer,
        target: message.sender
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(message) {
    try {
      await this.peerConnection.setRemoteDescription(message.sdp);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(message) {
    try {
      await this.peerConnection.addIceCandidate(message.candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  sendSignalingMessage(message) {
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify(message));
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  async switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const constraints = {
            video: {
              facingMode: videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user'
            },
            audio: true
          };
          
          const newStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Replace video track
          const newVideoTrack = newStream.getVideoTracks()[0];
          const sender = this.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
          
          // Update local stream
          videoTrack.stop();
          this.localStream.removeTrack(videoTrack);
          this.localStream.addTrack(newVideoTrack);
          
          if (this.onLocalStreamCallback) {
            this.onLocalStreamCallback(this.localStream);
          }
        } catch (error) {
          console.error('Error switching camera:', error);
        }
      }
    }
  }

  endCall() {
    // Send end call message
    this.sendSignalingMessage({
      type: 'end-call'
    });

    // Close data channel
    if (this.chatChannel) {
      this.chatChannel.close();
      this.chatChannel = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close signaling socket
    if (this.signalingSocket) {
      this.signalingSocket.close();
      this.signalingSocket = null;
    }
  }

  setOnRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
  }

  setOnLocalStream(callback) {
    this.onLocalStreamCallback = callback;
  }

  setOnConnectionState(callback) {
    this.onConnectionStateCallback = callback;
  }

  setOnDisconnect(callback) {
    this.onDisconnectCallback = callback;
  }

  setOnChatMessage(callback) {
    this.onChatMessageCallback = callback;
  }
}

// Chat Interface Component
function ChatInterface({ messages, onSendMessage, disabled, currentUserId }) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.userId === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              msg.userId === currentUserId 
                ? 'bg-pink-600 text-white' 
                : 'bg-gray-700 text-white'
            }`}>
              <p className="text-sm">{msg.text}</p>
              <p className="text-xs opacity-75 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-600">
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={disabled}
            className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="px-6 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

// Enhanced WebRTC Video Call Component with Chat
export function VideoCallInterface({ sessionData, onEndCall, api }) {
  const { user } = useAuth();
  const [webRTC] = useState(() => new WebRTCService());
  const [isAudioEnabled, setIsAudioEnabled] = useState(sessionData.session_type !== 'chat');
  const [isVideoEnabled, setIsVideoEnabled] = useState(sessionData.session_type === 'video');
  const [connectionState, setConnectionState] = useState('new');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [showChat, setShowChat] = useState(sessionData.session_type === 'chat');
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    initializeWebRTC();
    startTimer();
    
    return () => {
      webRTC.endCall();
    };
  }, []);

  const initializeWebRTC = async () => {
    try {
      const isInitiator = user?.id === sessionData.client_user_id;
      
      webRTC.setOnLocalStream((stream) => {
        if (localVideoRef.current && sessionData.session_type !== 'chat') {
          localVideoRef.current.srcObject = stream;
        }
      });

      webRTC.setOnRemoteStream((stream) => {
        if (remoteVideoRef.current && sessionData.session_type !== 'chat') {
          remoteVideoRef.current.srcObject = stream;
        }
        setIsConnected(true);
      });

      webRTC.setOnConnectionState((state) => {
        setConnectionState(state);
        if (state === 'connected') {
          setIsConnected(true);
        }
      });

      webRTC.setOnDisconnect(() => {
        handleEndCall();
      });

      webRTC.setOnChatMessage((message) => {
        setChatMessages(prev => [...prev, message]);
      });

      await webRTC.initialize(
        sessionData.room_id, 
        user?.id, 
        sessionData.session_type,
        isInitiator
      );
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      if (sessionData.session_type !== 'chat') {
        alert('Failed to access camera/microphone. Please check permissions.');
      }
    }
  };

  const startTimer = () => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  };

  const handleSendChatMessage = (message) => {
    const chatMessage = webRTC.sendChatMessage(message);
    if (chatMessage) {
      setChatMessages(prev => [...prev, chatMessage]);
    }
  };

  const handleToggleAudio = () => {
    const enabled = webRTC.toggleAudio();
    setIsAudioEnabled(enabled);
  };

  const handleToggleVideo = () => {
    const enabled = webRTC.toggleVideo();
    setIsVideoEnabled(enabled);
  };

  const handleSwitchCamera = () => {
    webRTC.switchCamera();
  };

  const handleEndCall = async () => {
    try {
      await api.post('/api/session/action', {
        session_id: sessionData.id,
        action: 'end'
      });
      webRTC.endCall();
      onEndCall();
    } catch (error) {
      console.error('Error ending call:', error);
      onEndCall();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const ratePerMinute = sessionData.rate_per_minute;
  const estimatedCost = Math.ceil(timeElapsed / 60) * ratePerMinute;

  // Chat-only layout
  if (sessionData.session_type === 'chat') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-black to-pink-900 z-50 flex flex-col">
        {/* Header */}
        <div className="bg-black/80 backdrop-blur-sm p-4 flex justify-between items-center border-b border-pink-500/30">
          <div className="text-white">
            <h3 className="font-playfair text-lg">
              Chat Reading with {user?.id === sessionData.client_user_id 
                ? `${sessionData.reader_first_name} ${sessionData.reader_last_name}`
                : `${sessionData.client_first_name} ${sessionData.client_last_name}`
              }
            </h3>
            <p className="text-sm text-gray-300">
              ${ratePerMinute}/min • {formatTime(timeElapsed)} • ~${estimatedCost.toFixed(2)}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <button
              onClick={handleEndCall}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-playfair transition-colors"
            >
              End Chat
            </button>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1">
          <ChatInterface
            messages={chatMessages}
            onSendMessage={handleSendChatMessage}
            disabled={!isConnected}
            currentUserId={user?.id}
          />
        </div>
      </div>
    );
  }

  // Video/Audio layout
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-sm p-4 flex justify-between items-center">
        <div className="text-white">
          <h3 className="font-playfair text-lg">
            {user?.id === sessionData.client_user_id 
              ? `${sessionData.reader_first_name} ${sessionData.reader_last_name}`
              : `${sessionData.client_first_name} ${sessionData.client_last_name}`
            }
          </h3>
          <p className="text-sm text-gray-300">
            ${ratePerMinute}/min • {formatTime(timeElapsed)} • ~${estimatedCost.toFixed(2)}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionState === 'connected' ? 'bg-green-500' : 
            connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-white text-sm capitalize">{connectionState}</span>
          
          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Container */}
        <div className={`${showChat ? 'flex-1' : 'w-full'} relative`}>
          {sessionData.session_type === 'video' ? (
            <>
              {/* Remote Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Local Video */}
              <div className="absolute top-4 right-4 w-32 h-24 md:w-48 md:h-36 bg-gray-800 rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>
            </>
          ) : (
            // Audio-only visualization
            <div className="w-full h-full bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-alex-brush">Audio Reading</h3>
                <p className="text-gray-300">Voice connection active</p>
              </div>
            </div>
          )}

          {/* Connection Status Overlay */}
          {!isConnected && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="font-playfair">Connecting...</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 bg-black/80 backdrop-blur-sm border-l border-pink-500/30">
            <ChatInterface
              messages={chatMessages}
              onSendMessage={handleSendChatMessage}
              disabled={!isConnected}
              currentUserId={user?.id}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm p-4">
        <div className="flex justify-center space-x-4">
          {/* Audio Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`p-3 rounded-full transition-colors ${
              isAudioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isAudioEnabled ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Video Toggle (only for video sessions) */}
          {sessionData.session_type === 'video' && (
            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded-full transition-colors ${
                isVideoEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isVideoEnabled ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13V7a1 1 0 00-1.447-.894l-2 1A1 1 0 0014 8v.586l-2-2V6a2 2 0 00-2-2H8.586l-2-2H3.707zM2 6a2 2 0 012-2h.586l2 2H4v8a2 2 0 002 2h6a2 2 0 002-2v-.586l2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}

          {/* Switch Camera (only for video sessions) */}
          {sessionData.session_type === 'video' && (
            <button
              onClick={handleSwitchCamera}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2h-3l-1-1H8L7 3H4z" />
                <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            </button>
          )}

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 6.707 6.293a1 1 0 00-1.414 1.414L8.586 11l-3.293 3.293a1 1 0 001.414 1.414L10 12.414l3.293 3.293a1 1 0 001.414-1.414L11.414 11l3.293-3.293z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default WebRTCService;
