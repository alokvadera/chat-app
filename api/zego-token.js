import crypto from "node:crypto";
import process from "node:process";
import { Buffer } from "node:buffer";

const toBase64 = (value) => Buffer.from(value).toString("base64");

const generateKitToken = ({ appID, serverSecret, roomID, userID, userName, effectiveTimeInSeconds = 7200 }) => {
  const ctime = Math.floor(Date.now() / 1000);
  const payload = {
    app_id: appID,
    user_id: userID,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime,
    expire: ctime + effectiveTimeInSeconds,
  };

  const iv = crypto
    .randomBytes(8)
    .toString("hex")
    .slice(0, 16);

  const key = Buffer.from(serverSecret, "utf8");
  const cipher = crypto.createCipheriv(`aes-${key.length * 8}-cbc`, key, Buffer.from(iv, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  const output = Buffer.alloc(28 + encrypted.length);
  output.set([0, 0, 0, 0], 0);
  output.writeUInt32BE(payload.expire, 4);
  output.writeUInt16BE(iv.length, 8);
  output.set(Buffer.from(iv, "utf8"), 10);
  output.writeUInt16BE(encrypted.length, 26);
  output.set(encrypted, 28);

  const tokenPart = toBase64(output);
  const userPayload = {
    userID,
    roomID,
    userName: encodeURIComponent(userName),
    appID,
  };

  return `04${tokenPart}#${toBase64(JSON.stringify(userPayload))}`;
};

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const appIDRaw = process.env.ZEGO_APP_ID || process.env.VITE_ZEGO_APP_ID;
  const serverSecret = String(
    process.env.ZEGO_SERVER_SECRET || process.env.VITE_ZEGO_SERVER_SECRET || "",
  ).trim();
  const appID = Number(appIDRaw);

  if (!Number.isFinite(appID) || !serverSecret) {
    const missing = [];
    if (!Number.isFinite(appID)) missing.push("ZEGO_APP_ID");
    if (!serverSecret) missing.push("ZEGO_SERVER_SECRET");
    return res.status(500).json({
      error: `ZEGO server configuration is missing: ${missing.join(", ")}`,
    });
  }

  const { roomID, userID, userName } = req.body || {};

  const normalizedRoomID = String(roomID || "").trim();
  const normalizedUserID = String(userID || "").trim();
  const normalizedUserName = String(userName || "").trim();

  if (!normalizedRoomID || !normalizedUserID || !normalizedUserName) {
    return res.status(400).json({ error: "roomID, userID, and userName are required." });
  }

  try {
    const token = generateKitToken({
      appID,
      serverSecret,
      roomID: normalizedRoomID,
      userID: normalizedUserID,
      userName: normalizedUserName,
    });

    return res.status(200).json({ token, appID });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Unable to generate ZEGO token." });
  }
}
