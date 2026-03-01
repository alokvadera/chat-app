import { notificationHelper } from "./notificationManager";

let activeZegoInstance = null;
let moduleZegoPromise = null;

const ensureZegoRoot = () => {
  let root =
    document.getElementById("video-call-root") ||
    document.getElementById("zego-video-container");
  if (root) return root;

  root = document.createElement("div");
  root.id = "video-call-root";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "0";
  root.style.width = "100vw";
  root.style.height = "100vh";
  root.style.zIndex = "999";
  root.style.background = "#000";

  document.body.appendChild(root);
  return root;
};

const waitForGlobalZegoSdk = async () => {
  if (window.ZegoUIKitPrebuilt) return window.ZegoUIKitPrebuilt;
  return null;
};

const waitForModuleZegoSdk = async () => {
  if (!moduleZegoPromise) {
    moduleZegoPromise = import("@zegocloud/zego-uikit-prebuilt")
      .then((mod) => mod?.default || mod?.ZegoUIKitPrebuilt || mod)
      .catch(() => null);
  }

  return moduleZegoPromise;
};

const resolveZegoSdk = async () => {
  const moduleSdk = await waitForModuleZegoSdk();
  if (moduleSdk) return moduleSdk;

  try {
    const globalSdk = await waitForGlobalZegoSdk();
    if (globalSdk) return globalSdk;
  } catch {
    // no-op
  }

  throw new Error("Zego SDK unavailable. Module import failed.");
};

export const startVideoSession = async (roomID, user = {}, options = {}) => {
  try {
    if (typeof window === "undefined") {
      return { ok: false, error: new Error("Window is not available") };
    }

    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
    const serverSecret = String(import.meta.env.VITE_ZEGO_SERVER_SECRET || "").trim();

    if (!Number.isFinite(appID) || !serverSecret) {
      notificationHelper.error("Zego video call is not configured. Add VITE_ZEGO_APP_ID and VITE_ZEGO_SERVER_SECRET.");
      return { ok: false, error: new Error("Missing Zego configuration") };
    }

    const ZegoUIKitPrebuilt = await resolveZegoSdk();
    if (!ZegoUIKitPrebuilt) {
      throw new Error("Zego SDK unavailable.");
    }

    const userID = String(user.id || user.userId || `user_${Date.now()}`);
    const userName = String(user.name || user.userName || "Chat User");
    const callType = options?.callType === "audio" ? "audio" : "video";

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomID,
      userID,
      userName,
    );

    const root = ensureZegoRoot();
    root.innerHTML = "";
    root.style.display = "block";

    if (activeZegoInstance?.destroy) {
      activeZegoInstance.destroy();
    }

    activeZegoInstance = ZegoUIKitPrebuilt.create(kitToken);
    activeZegoInstance.joinRoom({
      container: root,
      scenario: {
        mode: ZegoUIKitPrebuilt.GroupCall,
      },
      showPreJoinView: false,
      turnOnMicrophoneWhenJoining: true,
      turnOnCameraWhenJoining: callType !== "audio",
      showScreenSharingButton: false,
      onLeaveRoom: () => {
        root.innerHTML = "";
        root.style.display = "none";
      },
    });

    return { ok: true, roomID };
  } catch (error) {
    notificationHelper.error(error?.message || "Unable to start video call.");
    return { ok: false, error };
  }
};
