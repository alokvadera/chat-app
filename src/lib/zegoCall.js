import { notificationHelper } from "./notificationManager";

let activeZegoInstance = null;
let moduleZegoPromise = null;

const isValidZegoSdk = (candidate) =>
  !!candidate &&
  typeof candidate.create === "function" &&
  typeof candidate.generateKitTokenForTest === "function";

const normalizeZegoSdk = (source) => {
  const candidates = [
    source,
    source?.default,
    source?.ZegoUIKitPrebuilt,
    source?.default?.ZegoUIKitPrebuilt,
    source?.default?.default,
  ];

  return candidates.find(isValidZegoSdk) || null;
};

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
  const globalSdk = normalizeZegoSdk(window.ZegoUIKitPrebuilt);
  if (globalSdk) return globalSdk;
  return null;
};

const waitForModuleZegoSdk = async () => {
  if (!moduleZegoPromise) {
    moduleZegoPromise = import("@zegocloud/zego-uikit-prebuilt")
      .then((mod) => normalizeZegoSdk(mod))
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
    if (!Number.isFinite(appID)) {
      notificationHelper.error("Zego video call is not configured. Add VITE_ZEGO_APP_ID.");
      return { ok: false, error: new Error("Missing Zego APP ID") };
    }

    const ZegoUIKitPrebuilt = await resolveZegoSdk();
    if (!isValidZegoSdk(ZegoUIKitPrebuilt)) {
      throw new Error("Zego SDK unavailable or invalid export shape.");
    }

    const userID = String(user.id || user.userId || `user_${Date.now()}`);
    const userName = String(user.name || user.userName || "Chat User");
    const callType = options?.callType === "audio" ? "audio" : "video";

    let kitToken = "";
    const tokenEndpoint = String(import.meta.env.VITE_ZEGO_TOKEN_ENDPOINT || "").trim();

    try {
      if (!tokenEndpoint) {
        throw new Error(
          "VITE_ZEGO_TOKEN_ENDPOINT is not configured. Please set it to the API Gateway URL that proxies /zego-token.",
        );
      }

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomID, userID, userName }),
      });

      const contentType = response.headers.get("content-type") || "";
      let data = null;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          `ZEGO token endpoint returned unexpected response (${response.status}): ${text}`,
        );
      }

      if (!response.ok || !data?.token) {
        throw new Error(data?.error || "Unable to fetch ZEGO token from server.");
      }

      kitToken = String(data.token);
    } catch (error) {
      throw new Error(`Failed to fetch ZEGO token: ${error?.message || "unknown error"}`);
    }

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
