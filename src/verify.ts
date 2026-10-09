import { DEFAULT_MAX_AUTH_AGE } from "./constants";
import type { TelegramAuthData, TelegramMiniAppData } from "./types";

const encoder = new TextEncoder();

/**
 * Computes HMAC-SHA256 of data using the given key
 */
async function hmacSha256(key: Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  return globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(data) as BufferSource
  );
}

/**
 * Computes SHA-256 hash of a string
 */
async function sha256(data: string): Promise<ArrayBuffer> {
  return await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(data) as BufferSource
  );
}

/**
 * Converts an ArrayBuffer to a lowercase hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isFresh(authDate: number, maxAge: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (
    Number.isSafeInteger(authDate) &&
    authDate > 0 &&
    Number.isFinite(maxAge) &&
    maxAge >= 0 &&
    authDate <= now &&
    now - authDate <= maxAge
  );
}

function equalHash(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(received)) {
    return false;
  }
  let difference = 0;
  const normalized = received;
  for (let index = 0; index < expected.length; index += 1) {
    // biome-ignore lint/suspicious/noBitwiseOperators: Accumulate differences without early exit.
    difference |= expected.charCodeAt(index) ^ normalized.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verifies the authenticity of Telegram authentication data
 * @param data - Authentication data from Telegram Login Widget
 * @param botToken - Bot token from @BotFather
 * @param maxAge - Maximum age of auth in seconds (default: 24 hours)
 * @returns Promise that resolves to true if data is valid, false otherwise
 */
export async function verifyTelegramAuth(
  data: TelegramAuthData,
  botToken: string,
  maxAge = DEFAULT_MAX_AUTH_AGE
): Promise<boolean> {
  if (!validateTelegramAuthData(data)) {
    return false;
  }
  // Extract hash from data
  const { hash, ...dataWithoutHash } = data;

  // Check auth_date is not too old
  const authDate = dataWithoutHash.auth_date;
  if (!isFresh(authDate, maxAge)) {
    return false;
  }

  // Create data-check-string
  const dataCheckString = Object.keys(dataWithoutHash)
    .filter(
      (key) =>
        dataWithoutHash[key as keyof typeof dataWithoutHash] !== undefined
    )
    .sort()
    .map((key) => {
      const value = dataWithoutHash[key as keyof typeof dataWithoutHash];
      return `${key}=${value}`;
    })
    .join("\n");

  // Create secret key: SHA256(bot_token)
  const secretKey = new Uint8Array(await sha256(botToken));

  // Calculate HMAC-SHA256
  const hmac = bufferToHex(await hmacSha256(secretKey, dataCheckString));

  // Compare with received hash
  return equalHash(hmac, hash);
}

/**
 * Validates that required fields are present in Telegram auth data
 */
export function validateTelegramAuthData(data: any): data is TelegramAuthData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.id === "number" &&
    Number.isSafeInteger(data.id) &&
    data.id > 0 &&
    typeof data.first_name === "string" &&
    data.first_name.length > 0 &&
    typeof data.auth_date === "number" &&
    typeof data.hash === "string"
  );
}

/**
 * Parse initData string from Telegram Mini App
 * @param initData - URL-encoded initData string from Telegram.WebApp.initData
 * @returns Parsed Mini App data object
 */
export function parseMiniAppInitData(initData: string): TelegramMiniAppData {
  const params = new URLSearchParams(initData);
  const data: Partial<TelegramMiniAppData> & Record<string, unknown> = {};

  for (const [key, value] of params.entries()) {
    if (key === "user" || key === "receiver" || key === "chat") {
      // Parse JSON objects
      try {
        data[key] = JSON.parse(value);
      } catch {}
    } else if (key === "auth_date" || key === "can_send_after") {
      // Parse numbers
      data[key] = Number(value);
    } else {
      // Keep as string
      data[key] = value;
    }
  }

  return data as TelegramMiniAppData;
}

/**
 * Verifies the authenticity of Telegram Mini App initData
 * @param initData - Raw initData string from Telegram.WebApp.initData
 * @param botToken - Bot token from @BotFather
 * @param maxAge - Maximum age of auth in seconds (default: 24 hours)
 * @returns Promise that resolves to true if data is valid, false otherwise
 */
export async function verifyMiniAppInitData(
  initData: string,
  botToken: string,
  maxAge = DEFAULT_MAX_AUTH_AGE
): Promise<boolean> {
  const params = new URLSearchParams(initData);
  if (new Set(params.keys()).size !== Array.from(params.keys()).length) {
    return false;
  }
  const hash = params.get("hash");

  if (!hash) {
    return false;
  }

  // Remove hash from params
  params.delete("hash");

  // Check auth_date
  const authDate = params.get("auth_date");
  if (!authDate) {
    return false;
  }

  const authDateNum = Number(authDate);
  if (!isFresh(authDateNum, maxAge)) {
    return false;
  }

  // Create data-check-string (sorted alphabetically)
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => {
      if (a === b) {
        return 0;
      }
      return a < b ? -1 : 1;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Create secret key: HMAC-SHA256(key="WebAppData", data=botToken)
  const secretKey = new Uint8Array(
    await hmacSha256(encoder.encode("WebAppData"), botToken)
  );

  // Calculate HMAC-SHA256
  const calculatedHash = bufferToHex(
    await hmacSha256(secretKey, dataCheckString)
  );

  // Compare with received hash
  return equalHash(calculatedHash, hash);
}

/**
 * Validates that required fields are present in Mini App data
 */
export function validateMiniAppData(data: any): data is TelegramMiniAppData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.auth_date === "number" &&
    Number.isSafeInteger(data.auth_date) &&
    data.auth_date > 0 &&
    typeof data.hash === "string" &&
    (data.user === undefined ||
      (typeof data.user === "object" &&
        data.user !== null &&
        typeof data.user.id === "number" &&
        Number.isSafeInteger(data.user.id) &&
        data.user.id > 0 &&
        typeof data.user.first_name === "string"))
  );
}
