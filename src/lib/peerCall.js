import Peer from "peerjs";
import { notificationHelper } from "./notificationManager";

let peer = null;
let currentCall = null;
let localStream = null;
let onCallEndCallback = null;
let currentCallData = null;
let callStartTime = null;
let callTimerInterval = null;
let callTimeoutTimeout = null;
let isAudioMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let screenShareStream = null;
let peerConnectionState = 'disconnected';
let onCallStateChangeCallback = null;
let ringtoneInterval = null;
let audioContext = null;

const CALL_STORAGE_KEY = 'chat_app_active_call';

const getPeerId = (userId) => `chat-app-${userId}`;

const CALL_TIMEOUT_MS = 30000;
const RECONNECT_DELAY_MS = 3000;

export const saveCallState = (state) => {
  try {
    sessionStorage.setItem(CALL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.log('Could not save call state:', e);
  }
};

export const getSavedCallState = () => {
  try {
    const saved = sessionStorage.getItem(CALL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.log('Could not get call state:', e);
    return null;
  }
};

export const clearSavedCallState = () => {
  try {
    sessionStorage.removeItem(CALL_STORAGE_KEY);
  } catch (e) {
    console.log('Could not clear call state:', e);
  }
};

const createAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const playRingtone = () => {
  try {
    const ctx = createAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log('Could not play ringtone:', e);
  }
};

const startRingtone = () => {
  stopRingtone();
  ringtoneInterval = setInterval(playRingtone, 1000);
};

const stopRingtone = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
};

const playConnectSound = () => {
  try {
    const ctx = createAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log('Could not play connect sound:', e);
  }
};

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
};

const showBrowserNotification = (title, body, icon = null) => {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: icon || '/favicon.svg',
      tag: 'call-notification',
      requireInteraction: true,
    });
  }
};

export const showIncomingCallNotification = async (callerName, callType) => {
  const hasPermission = await requestNotificationPermission();
  if (hasPermission) {
    showBrowserNotification(
      'Incoming Call',
      `${callerName} is calling you (${callType})`,
    );
  }
};

export const initializePeer = async (userId) => {
  const peerId = getPeerId(userId);
  
  if (peer) {
    if (peer.id === peerId) return peer;
    peer.destroy();
  }

  return new Promise((resolve, reject) => {
    peer = new Peer(peerId, {
      debug: 1,
    });

    peer.on('open', (id) => {
      console.log('Peer connected with ID:', id);
      resolve(peer);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        peer = new Peer(undefined, { debug: 1 });
        peer.on('open', (id) => {
          console.log('Peer connected with auto ID:', id);
          resolve(peer);
        });
        peer.on('error', reject);
      } else {
        reject(err);
      }
    });

    peer.on('disconnected', () => {
      console.log('Peer disconnected, attempting reconnect...');
      peerConnectionState = 'reconnecting';
      updateCallState('reconnecting');
      
      setTimeout(() => {
        if (peer && !peer.disconnected) {
          peer.reconnect();
        }
      }, RECONNECT_DELAY_MS);
    });

    peer.on('connection', (conn) => {
      console.log('Peer connection received');
      conn.on('close', () => {
        console.log('Peer connection closed');
      });
    });
  });
};

export const initializePeerForIncoming = async (userId) => {
  try {
    await initializePeer(userId);
    
    if (peer) {
      peer.on('call', async (call) => {
        console.log('Incoming call from:', call.peer);
        
        clearTimeout(callTimeoutTimeout);
        startRingtone();
        
        currentCallData = {
          call,
          callerPeerId: call.peer,
          callType: call.options?.video !== false ? "video" : "audio",
          startTime: null,
        };
        
        updateCallState('ringing');
        
        const callerName = call.peer.replace('chat-app-', '');
        
        saveCallState({
          type: 'incoming',
          callerPeerId: call.peer,
          callerName,
          callType: currentCallData.callType,
          startTime: Date.now(),
        });
        
        showIncomingCallNotification(callerName, currentCallData.callType);
        
        const container = ensureCallContainer();
        
        container.innerHTML = buildIncomingCallHTML(callerName, currentCallData.callType);
        
        container.style.display = "flex";
        
        setupIncomingCallHandlers(call);
      });
    }
    
    return peer;
  } catch (error) {
    console.error('Error initializing peer for incoming calls:', error);
    throw error;
  }
};

const buildIncomingCallHTML = (callerName, callType) => `
  <div class="call-status" style="color: white; font-size: 24px; margin-bottom: 20px;">
    Incoming ${callType} call from ${callerName}
  </div>
  <video id="incoming-local-video" autoplay playsinline muted style="width: 100%; max-width: 600px; background: #000; display: none;"></video>
  <div style="margin-top: 20px; display: flex; gap: 20px;">
    <button id="accept-call-btn" class="call-btn accept-btn" style="padding: 15px 40px; font-size: 18px; background: #27ae60; color: white; border: none; border-radius: 50px; cursor: pointer;">Accept</button>
    <button id="decline-call-btn" class="call-btn decline-btn" style="padding: 15px 40px; font-size: 18px; background: #e74c3c; color: white; border: none; border-radius: 50px; cursor: pointer;">Decline</button>
  </div>
`;

const buildActiveCallHTML = (callType, callState) => {
  const duration = getCallDuration();
  const statusText = callState === 'connecting' ? 'Connecting...' : 
                     callState === 'connected' ? 'Connected' : 
                     callState === 'ringing' ? 'Ringing...' : 'Calling...';
  
  return `
    <style>
      .call-controls { display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap; justify-content: center; }
      .call-btn-control { padding: 12px 24px; font-size: 16px; border: none; border-radius: 50px; cursor: pointer; }
      .call-btn-muted { background: #e74c3c; color: white; }
      .call-btn-unmuted { background: #3498db; color: white; }
      .call-btn-video-off { background: #e74c3c; color: white; }
      .call-btn-video-on { background: #3498db; color: white; }
      .call-btn-screen { background: #9b59b6; color: white; }
      .call-btn-screen-active { background: #27ae60; color: white; }
      .call-btn-end { background: #e74c3c; color: white; padding: 15px 40px; }
      .call-timer { color: white; font-size: 20px; margin-bottom: 10px; }
      .call-status { color: #3498db; font-size: 16px; margin-bottom: 15px; }
    </style>
    <div class="call-timer">${duration}</div>
    <div class="call-status">${statusText}</div>
    <video id="remote-video" autoplay playsinline style="width: 100%; max-width: 600px; background: #000; border-radius: 10px;"></video>
    <video id="local-video" autoplay playsinline muted style="position: absolute; bottom: 120px; right: 20px; width: 120px; height: 90px; border: 2px solid white; border-radius: 8px; ${callType === 'audio' ? 'display: none;' : ''} ${isVideoOff ? 'opacity: 0;' : ''}"></video>
    <div class="call-controls">
      <button id="mute-btn" class="call-btn-control ${isAudioMuted ? 'call-btn-muted' : 'call-btn-unmuted'}">
        ${isAudioMuted ? '🔇 Unmute' : '🔊 Mute'}
      </button>
      ${callType === 'video' ? `
      <button id="video-btn" class="call-btn-control ${isVideoOff ? 'call-btn-video-off' : 'call-btn-video-on'}">
        ${isVideoOff ? '📷 Turn On' : '📷 Turn Off'}
      </button>
      <button id="screen-btn" class="call-btn-control ${isScreenSharing ? 'call-btn-screen-active' : 'call-btn-screen'}">
        ${isScreenSharing ? '⏹ Stop Share' : '🖥 Share Screen'}
      </button>
      ` : ''}
      <button id="end-call-btn" class="call-btn-control call-btn-end">End Call</button>
    </div>
  `;
};

const setupIncomingCallHandlers = (call) => {
  const acceptBtn = document.getElementById("accept-call-btn");
  const declineBtn = document.getElementById("decline-call-btn");
  
  if (acceptBtn) {
    acceptBtn.onclick = async () => {
      try {
        clearTimeout(callTimeoutTimeout);
        stopRingtone();
        playConnectSound();
        const { localStream: stream } = await answerCall(call, currentCallData.callType);
        currentCallData.localStream = stream;
        currentCallData.startTime = Date.now();
        startCallTimer();
        showActiveCallUI(call, stream);
        updateCallState('connected');
        clearSavedCallState();
      } catch (error) {
        console.error('Error answering call:', error);
        call.close();
        hideCallUI();
        updateCallState('ended');
      }
    };
  }
  
  if (declineBtn) {
    declineBtn.onclick = () => {
      stopRingtone();
      call.close();
      hideCallUI();
      updateCallState('ended');
    };
  }
};

const setupActiveCallHandlers = (call) => {
  const muteBtn = document.getElementById("mute-btn");
  const videoBtn = document.getElementById("video-btn");
  const screenBtn = document.getElementById("screen-btn");
  const endBtn = document.getElementById("end-call-btn");
  
  if (muteBtn) {
    muteBtn.onclick = () => {
      toggleMute();
    };
  }
  
  if (videoBtn) {
    videoBtn.onclick = () => {
      toggleVideo();
    };
  }
  
  if (screenBtn) {
    screenBtn.onclick = () => {
      toggleScreenShare(call);
    };
  }
  
  if (endBtn) {
    endBtn.onclick = () => {
      endCall();
    };
  }
};

const toggleMute = () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isAudioMuted;
      isAudioMuted = !isAudioMuted;
      updateCallControls();
    }
  }
};

const toggleVideo = () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isVideoOff;
      isVideoOff = !isVideoOff;
      updateCallControls();
    }
  }
};

const toggleScreenShare = async (call) => {
  try {
    if (isScreenSharing) {
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
        screenShareStream = null;
      }
      isScreenSharing = false;
      
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && call && call.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }
      
      if (localStream) {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
          localVideo.srcObject = localStream;
        }
      }
    } else {
      screenShareStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      
      isScreenSharing = true;
      
      const screenTrack = screenShareStream.getVideoTracks()[0];
      
      screenTrack.onended = () => {
        isScreenSharing = false;
        if (screenShareStream) {
          screenShareStream.getTracks().forEach(track => track.stop());
          screenShareStream = null;
        }
        updateCallControls();
        
        if (localStream && call) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          }
        }
      };
      
      if (call && call.peerConnection) {
        const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      }
      
      const localVideo = document.getElementById("local-video");
      if (localVideo) {
        localVideo.srcObject = screenShareStream;
      }
    }
    
    updateCallControls();
  } catch (error) {
    console.error('Screen share error:', error);
    notificationHelper.error("Could not share screen");
    isScreenSharing = false;
    updateCallControls();
  }
};

const updateCallControls = () => {
  const container = document.getElementById("peer-call-container");
  if (!container || !currentCallData) return;
  
  const muteBtn = document.getElementById("mute-btn");
  const videoBtn = document.getElementById("video-btn");
  const screenBtn = document.getElementById("screen-btn");
  
  if (muteBtn) {
    muteBtn.textContent = isAudioMuted ? '🔇 Unmute' : '🔊 Mute';
    muteBtn.className = `call-btn-control ${isAudioMuted ? 'call-btn-muted' : 'call-btn-unmuted'}`;
  }
  
  if (videoBtn) {
    videoBtn.textContent = isVideoOff ? '📷 Turn On' : '📷 Turn Off';
    videoBtn.className = `call-btn-control ${isVideoOff ? 'call-btn-video-off' : 'call-btn-video-on'}`;
  }
  
  if (screenBtn) {
    screenBtn.textContent = isScreenSharing ? '⏹ Stop Share' : '🖥 Share Screen';
    screenBtn.className = `call-btn-control ${isScreenSharing ? 'call-btn-screen-active' : 'call-btn-screen'}`;
  }
  
  const localVideo = document.getElementById("local-video");
  if (localVideo) {
    if (isScreenSharing && screenShareStream) {
      localVideo.srcObject = screenShareStream;
    } else if (localStream) {
      localVideo.srcObject = localStream;
    }
    localVideo.style.opacity = isVideoOff && !isScreenSharing ? '0' : '1';
  }
};

export const getLocalStream = async (callType = "video") => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });
    isAudioMuted = false;
    isVideoOff = callType !== "video";
    return localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    notificationHelper.error("Unable to access camera/microphone");
    throw error;
  }
};

export const createCall = async (peerId, callType = "video") => {
  if (!peer) {
    throw new Error("Peer not initialized");
  }

  const stream = await getLocalStream(callType);
  const call = peer.call(peerId, stream);
  
  currentCall = call;
  callStartTime = Date.now();
  
  updateCallState('connecting');
  startCallTimer();
  showActiveCallUI(call, stream);

  startCallTimeout();
  
  call.on('stream', (remoteStream) => {
    console.log('Received remote stream');
    clearTimeout(callTimeoutTimeout);
    updateCallState('connected');
    updateRemoteStream(remoteStream);
  });

  call.on('close', () => {
    console.log('Call closed');
    handleCallEnded();
  });

  call.on('error', (err) => {
    console.error('Call error:', err);
    notificationHelper.error("Call failed");
    handleCallEnded();
  });

  return { call, localStream: stream };
};

export const answerCall = async (call, callType = "video") => {
  const stream = await getLocalStream(callType);
  call.answer(stream);
  currentCall = call;
  callStartTime = Date.now();

  call.on('stream', (remoteStream) => {
    console.log('Received remote stream in answer');
    updateCallState('connected');
    updateRemoteStream(remoteStream);
  });

  call.on('close', () => {
    console.log('Call closed');
    handleCallEnded();
  });

  return { call, localStream: stream };
};

const startCallTimeout = () => {
  callTimeoutTimeout = setTimeout(() => {
    console.log('Call timeout - no answer');
    notificationHelper.info("No answer - call timed out");
    endCall();
  }, CALL_TIMEOUT_MS);
};

const startCallTimer = () => {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
  }
  
  callTimerInterval = setInterval(() => {
    const container = document.getElementById("peer-call-container");
    if (!container) return;
    
    const timerEl = container.querySelector('.call-timer');
    if (timerEl) {
      timerEl.textContent = getCallDuration();
    }
  }, 1000);
};

const getCallDuration = () => {
  if (!callStartTime) return "00:00";
  
  const diff = Math.floor((Date.now() - callStartTime) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const updateCallState = (state) => {
  peerConnectionState = state;
  if (onCallStateChangeCallback) {
    onCallStateChangeCallback(state);
  }
};

const updateRemoteStream = (remoteStream) => {
  const container = document.getElementById("peer-call-container");
  if (!container) return;
  
  const remoteVideo = document.getElementById("remote-video");
  if (remoteVideo) {
    remoteVideo.srcObject = remoteStream;
  }
};

export const endCall = () => {
  handleCallEnded();
};

const handleCallEnded = () => {
  stopRingtone();
  
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  
  if (callTimeoutTimeout) {
    clearTimeout(callTimeoutTimeout);
    callTimeoutTimeout = null;
  }
  
  callStartTime = null;
  isAudioMuted = false;
  isVideoOff = false;
  isScreenSharing = false;
  
  if (screenShareStream) {
    screenShareStream.getTracks().forEach(track => track.stop());
    screenShareStream = null;
  }
  
  hideCallUI();
  updateCallState('ended');
  
  if (onCallEndCallback) {
    onCallEndCallback();
    onCallEndCallback = null;
  }
};

const ensureCallContainer = () => {
  let container = document.getElementById("peer-call-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "peer-call-container";
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      z-index: 9999;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(container);
  }
  return container;
};

const showActiveCallUI = (callObj, localStreamObj) => {
  const container = ensureCallContainer();
  const callType = currentCallData?.callType || "video";
  
  container.innerHTML = buildActiveCallHTML(callType, peerConnectionState);
  container.style.display = "flex";
  
  const localVideo = document.getElementById("local-video");
  const remoteVideo = document.getElementById("remote-video");
  
  if (localVideo && localStreamObj) {
    localVideo.srcObject = localStreamObj;
  }
  
  if (callObj) {
    callObj.on('stream', (remoteStream) => {
      console.log('Received remote stream in active call');
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
      }
    });
  }
  
  setupActiveCallHandlers(callObj);
  
  if (callObj) {
    callObj.on('close', () => {
      console.log('Active call closed');
      handleCallEnded();
    });
  }
};

const hideCallUI = () => {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  
  const container = document.getElementById("peer-call-container");
  if (container) {
    container.style.display = "none";
    container.innerHTML = "";
  }
  currentCallData = null;
  updateCallState('ended');
  clearSavedCallState();
};

export const hideCallUIFunction = hideCallUI;

export const startVideoSession = async (roomID, user = {}, options = {}) => {
  try {
    if (typeof window === "undefined") {
      return { ok: false, error: new Error("Window is not available") };
    }

    const userId = user.id || user.userId;
    if (!userId) {
      notificationHelper.error("User ID is required");
      return { ok: false, error: new Error("Missing user ID") };
    }

    let targetUserId = options?.targetUserId;
    
    if (!targetUserId && roomID) {
      const parts = roomID.split('_');
      targetUserId = parts.find(id => id && id !== userId) || roomID;
    }
    
    if (!targetUserId) {
      notificationHelper.error("Could not determine target user");
      return { ok: false, error: new Error("Missing target user ID") };
    }

    const targetPeerId = getPeerId(targetUserId);
    const callType = options?.callType === "audio" ? "audio" : "video";

    console.log('Starting call - myId:', userId, 'targetId:', targetUserId, 'peerId:', targetPeerId);

    if (!peer) {
      await initializePeer(userId);
    }

    updateCallState('calling');
    
    const { call, localStream: stream } = await createCall(targetPeerId, callType);
    
    currentCallData = {
      call,
      callType,
      targetPeerId,
      startTime: null,
    };

    saveCallState({
      type: 'outgoing',
      roomID,
      targetUserId,
      callType,
      startTime: Date.now(),
    });

    return { ok: true, roomID };
  } catch (error) {
    console.error("Video session error:", error);
    notificationHelper.error(error?.message || "Unable to start video call.");
    updateCallState('error');
    return { ok: false, error };
  }
};

export const setCallEndCallback = (callback) => {
  onCallEndCallback = callback;
};

export const setCallStateCallback = (callback) => {
  onCallStateChangeCallback = callback;
};

export const getCallState = () => peerConnectionState;

export const cleanupPeer = () => {
  handleCallEnded();
  
  if (peer) {
    peer.destroy();
    peer = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  updateCallState('disconnected');
};