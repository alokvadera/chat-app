import Peer from "peerjs";
import { notificationHelper } from "./notificationManager";

let peer = null;
let currentCall = null;
let localStream = null;
let onCallEndCallback = null;
let currentCallData = null;

const getPeerId = (userId) => `chat-app-${userId}`;

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
  });
};

export const initializePeerForIncoming = async (userId) => {
  try {
    await initializePeer(userId);
    
    if (peer) {
      peer.on('call', async (call) => {
        console.log('Incoming call from:', call.peer);
        
        currentCallData = {
          call,
          callerPeerId: call.peer,
          callType: call.options?.video !== false ? "video" : "audio",
        };
        
        const container = ensureCallContainer();
        
        const callerName = call.peer.replace('chat-app-', '');
        container.innerHTML = `
          <div style="color: white; font-size: 24px; margin-bottom: 20px;">
            Incoming ${currentCallData.callType} call from ${callerName}
          </div>
          <video id="incoming-local-video" autoplay playsinline muted style="width: 100%; max-width: 600px; background: #000; display: none;"></video>
          <div style="margin-top: 20px; display: flex; gap: 20px;">
            <button id="accept-call-btn" style="padding: 15px 40px; font-size: 18px; background: #27ae60; color: white; border: none; border-radius: 50px; cursor: pointer;">Accept</button>
            <button id="decline-call-btn" style="padding: 15px 40px; font-size: 18px; background: #e74c3c; color: white; border: none; border-radius: 50px; cursor: pointer;">Decline</button>
          </div>
        `;
        
        container.style.display = "flex";
        
        const acceptBtn = document.getElementById("accept-call-btn");
        const declineBtn = document.getElementById("decline-call-btn");
        
        acceptBtn.onclick = async () => {
          try {
            const { localStream: stream } = await answerCall(call, currentCallData.callType);
            currentCallData.localStream = stream;
            showCallUIFromIncoming(call, stream);
          } catch (error) {
            console.error('Error answering call:', error);
            call.close();
            hideCallUI();
          }
        };
        
        declineBtn.onclick = () => {
          call.close();
          hideCallUI();
        };
      });
    }
    
    return peer;
  } catch (error) {
    console.error('Error initializing peer for incoming calls:', error);
    throw error;
  }
};

export const getLocalStream = async (callType = "video") => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });
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
  
  call.on('stream', (remoteStream) => {
    console.log('Received remote stream');
    updateCallUI("connected", remoteStream);
  });

  call.on('close', () => {
    console.log('Call closed');
    cleanupCall();
  });

  call.on('error', (err) => {
    console.error('Call error:', err);
    notificationHelper.error("Call failed");
    cleanupCall();
  });

  return { call, localStream };
};

export const answerCall = async (call, callType = "video") => {
  const stream = await getLocalStream(callType);
  call.answer(stream);
  currentCall = call;

  call.on('stream', (remoteStream) => {
    console.log('Received remote stream in answer');
    updateCallUI("connected", remoteStream);
  });

  call.on('close', () => {
    console.log('Call closed');
    cleanupCall();
  });

  return { call, localStream: stream };
};

export const endCall = () => {
  cleanupCall();
};

const cleanupCall = () => {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  updateCallUI("ended");
  
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

const showCallUI = (type, peerId, localStreamObj, callObj) => {
  const container = ensureCallContainer();
  
  container.innerHTML = `
    <div style="color: white; font-size: 24px; margin-bottom: 20px;">
      ${type === "incoming" ? "Incoming Call" : "Calling..."}
    </div>
    <video id="remote-video" autoplay playsinline style="width: 100%; max-width: 600px; background: #000;"></video>
    <video id="local-video" autoplay playsinline muted style="position: absolute; bottom: 100px; right: 20px; width: 120px; height: 90px; border: 2px solid white; border-radius: 8px;"></video>
    <div style="margin-top: 20px;">
      <button id="end-call-btn" style="padding: 15px 40px; font-size: 18px; background: #e74c3c; color: white; border: none; border-radius: 50px; cursor: pointer;">End Call</button>
    </div>
  `;
  
  container.style.display = "flex";
  
  const localVideo = document.getElementById("local-video");
  const remoteVideo = document.getElementById("remote-video");
  const endBtn = document.getElementById("end-call-btn");
  
  if (localVideo && localStreamObj) {
    localVideo.srcObject = localStreamObj;
  }
  
  if (callObj && callObj.remoteStream) {
    if (remoteVideo) {
      remoteVideo.srcObject = callObj.remoteStream;
    }
  }
  
  if (callObj) {
    callObj.on('stream', (remoteStream) => {
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
      }
    });
  }
  
  endBtn.onclick = () => {
    endCall();
    container.style.display = "none";
  };
};

const updateCallUI = (state, remoteStream) => {
  const container = document.getElementById("peer-call-container");
  if (!container) return;
  
  if (state === "ended") {
    container.style.display = "none";
    container.innerHTML = "";
  } else if (state === "connected" && remoteStream) {
    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
    }
  }
};

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

    const { call, localStream: stream } = await createCall(targetPeerId, callType);
    
    showCallUI("outgoing", targetPeerId, stream, call);
    
    call.on('close', () => {
      endCall();
    });

    return { ok: true, roomID };
  } catch (error) {
    console.error("Video session error:", error);
    notificationHelper.error(error?.message || "Unable to start video call.");
    return { ok: false, error };
  }
};

export const setCallEndCallback = (callback) => {
  onCallEndCallback = callback;
};

export const cleanupPeer = () => {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
};

const showCallUIFromIncoming = (call, localStreamObj) => {
  const container = ensureCallContainer();
  
  container.innerHTML = `
    <div style="color: white; font-size: 24px; margin-bottom: 20px;">
      Call Active
    </div>
    <video id="remote-video" autoplay playsinline style="width: 100%; max-width: 600px; background: #000;"></video>
    <video id="local-video" autoplay playsinline muted style="position: absolute; bottom: 100px; right: 20px; width: 120px; height: 90px; border: 2px solid white; border-radius: 8px;"></video>
    <div style="margin-top: 20px;">
      <button id="end-call-btn" style="padding: 15px 40px; font-size: 18px; background: #e74c3c; color: white; border: none; border-radius: 50px; cursor: pointer;">End Call</button>
    </div>
  `;
  
  container.style.display = "flex";
  
  const localVideo = document.getElementById("local-video");
  const remoteVideo = document.getElementById("remote-video");
  const endBtn = document.getElementById("end-call-btn");
  
  if (localVideo && localStreamObj) {
    localVideo.srcObject = localStreamObj;
  }
  
  call.on('stream', (remoteStream) => {
    console.log('Received remote stream in incoming call');
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
    }
  });
  
  call.on('close', () => {
    console.log('Incoming call closed');
    hideCallUI();
    cleanupCall();
  });
  
  endBtn.onclick = () => {
    call.close();
    hideCallUI();
    cleanupCall();
  };
};

const hideCallUI = () => {
  const container = document.getElementById("peer-call-container");
  if (container) {
    container.style.display = "none";
    container.innerHTML = "";
  }
  currentCallData = null;
};

export const hideCallUIFunction = hideCallUI;