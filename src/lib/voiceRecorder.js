// ═══════════════════════════════════════════════════
// Voice recording utility using MediaRecorder API
// ═══════════════════════════════════════════════════

let mediaRecorder = null;
let audioChunks = [];
let stream = null;

export const isRecordingSupported = () =>
  typeof navigator !== "undefined" &&
  navigator.mediaDevices &&
  typeof MediaRecorder !== "undefined";

export const startRecording = async () => {
  if (!isRecordingSupported()) {
    throw new Error("Voice recording is not supported in this browser.");
  }

  audioChunks = [];
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      resolve({ blob, url, mimeType });
    };

    mediaRecorder.onerror = (e) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      reject(e.error || new Error("Recording failed"));
    };

    mediaRecorder.start(100); // Collect data every 100ms
    resolve({ recording: true });
  });
};

export const stopRecording = () =>
  new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      reject(new Error("No active recording"));
      return;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      mediaRecorder = null;
      audioChunks = [];
      resolve({ blob, url, mimeType });
    };

    mediaRecorder.stop();
  });

export const cancelRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  mediaRecorder = null;
  audioChunks = [];
};

export const isRecording = () =>
  mediaRecorder && mediaRecorder.state === "recording";
