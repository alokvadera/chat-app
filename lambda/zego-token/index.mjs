import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

const toBase64 = (value) => Buffer.from(value).toString("base64");

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

const generateKitToken = ({
  appID,
  serverSecret,
  roomID,
  userID,
  userName,
  effectiveTimeInSeconds = 7200,
}) => {
  const ctime = Math.floor(Date.now() / 1000);
  const payload = {
    app_id: appID,
    user_id: userID,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime,
    expire: ctime + effectiveTimeInSeconds,
  };

  const iv = crypto.randomBytes(8).toString("hex").slice(0, 16);
  const key = Buffer.from(serverSecret, "utf8");
  const cipher = crypto.createCipheriv(
    `aes-${key.length * 8}-cbc`,
    key,
    Buffer.from(iv, "utf8"),
  );
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

const parseBody = (event) => {
  if (!event?.body) return {};
  if (typeof event.body === "object") return event.body;

  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: jsonHeaders,
      body: "",
    };
  }

  if (method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  const appID = Number(process.env.ZEGO_APP_ID);
  const serverSecret = String(process.env.ZEGO_SERVER_SECRET || "").trim();

  if (!Number.isFinite(appID) || !serverSecret) {
    const missing = [];
    if (!Number.isFinite(appID)) missing.push("ZEGO_APP_ID");
    if (!serverSecret) missing.push("ZEGO_SERVER_SECRET");
    return jsonResponse(500, {
      error: `ZEGO server configuration is missing: ${missing.join(", ")}`,
    });
  }

  try {
    const { roomID, userID, userName } = parseBody(event);
    const normalizedRoomID = String(roomID || "").trim();
    const normalizedUserID = String(userID || "").trim();
    const normalizedUserName = String(userName || "").trim();

    if (!normalizedRoomID || !normalizedUserID || !normalizedUserName) {
      return jsonResponse(400, {
        error: "roomID, userID, and userName are required.",
      });
    }

    const token = generateKitToken({
      appID,
      serverSecret,
      roomID: normalizedRoomID,
      userID: normalizedUserID,
      userName: normalizedUserName,
    });

    return jsonResponse(200, { token, appID });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Unable to generate ZEGO token.",
    });
  }
};
