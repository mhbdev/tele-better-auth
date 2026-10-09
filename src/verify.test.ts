import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { TelegramAuthData, TelegramMiniAppData } from "./types";
import {
  parseMiniAppInitData,
  validateMiniAppData,
  validateTelegramAuthData,
  verifyMiniAppInitData,
  verifyTelegramAuth,
} from "./verify";

describe("verifyTelegramAuth", () => {
  const BotToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";
  let validAuthData: TelegramAuthData;

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    1.5,
    Math.floor(Date.now() / 1000) + 600,
  ])("rejects a freshly signed invalid timestamp: %s", async (auth_date) => {
    const data = { auth_date, first_name: "John", id: 42 };
    const check = Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const hash = createHmac(
      "sha256",
      createHash("sha256").update(BotToken).digest()
    )
      .update(check)
      .digest("hex");
    expect(await verifyTelegramAuth({ ...data, hash }, BotToken)).toBe(false);
  });

  beforeEach(() => {
    // Create valid auth data for each test
    const currentTime = Math.floor(Date.now() / 1000);
    const dataWithoutHash = {
      auth_date: currentTime,
      first_name: "John",
      id: 123456789,
      last_name: "Doe",
      photo_url: "https://example.com/photo.jpg",
      username: "johndoe",
    };

    // Generate valid hash
    const dataCheckString = Object.keys(dataWithoutHash)
      .sort()
      .map(
        (key) =>
          `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`
      )
      .join("\n");

    const secretKey = createHash("sha256").update(BotToken).digest();
    const hash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    validAuthData = {
      ...dataWithoutHash,
      hash,
    };
  });

  describe("Valid authentication", () => {
    it("should return true for valid auth data", async () => {
      const result = await verifyTelegramAuth(validAuthData, BotToken);
      expect(result).toBe(true);
    });

    it("should verify data with only required fields", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const minimalData = {
        auth_date: currentTime,
        first_name: "John",
        id: 123456789,
      };

      const dataCheckString = Object.keys(minimalData)
        .sort()
        .map((key) => `${key}=${minimalData[key as keyof typeof minimalData]}`)
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...minimalData, hash },
        BotToken
      );
      expect(result).toBe(true);
    });

    it("should verify data with all optional fields", async () => {
      // validAuthData already has all fields
      const result = await verifyTelegramAuth(validAuthData, BotToken);
      expect(result).toBe(true);
    });

    it("should accept auth data within maxAge", async () => {
      const result = await verifyTelegramAuth(validAuthData, BotToken, 86400);
      expect(result).toBe(true);
    });

    it("should accept auth data from 1 second ago", async () => {
      const oneSecondAgo = Math.floor(Date.now() / 1000) - 1;
      const data = { ...validAuthData, auth_date: oneSecondAgo };

      // Regenerate hash with new auth_date
      const { hash: _, ...dataWithoutHash } = data;

      const dataCheckString = Object.keys(dataWithoutHash)
        .sort()
        .map(
          (key) =>
            `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`
        )
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...data, hash },
        BotToken,
        86400
      );
      expect(result).toBe(true);
    });
  });

  describe("Invalid HMAC", () => {
    it("should return false for tampered id", async () => {
      const tamperedData = { ...validAuthData, id: 999999999 };
      const result = await verifyTelegramAuth(tamperedData, BotToken);
      expect(result).toBe(false);
    });

    it("should return false for tampered first_name", async () => {
      const tamperedData = { ...validAuthData, first_name: "Hacker" };
      const result = await verifyTelegramAuth(tamperedData, BotToken);
      expect(result).toBe(false);
    });

    it("should return false for tampered username", async () => {
      const tamperedData = { ...validAuthData, username: "hacker" };
      const result = await verifyTelegramAuth(tamperedData, BotToken);
      expect(result).toBe(false);
    });

    it("should return false for completely wrong hash", async () => {
      const tamperedData = {
        ...validAuthData,
        hash: "0000000000000000000000000000000000000000000000000000000000000000",
      };
      const result = await verifyTelegramAuth(tamperedData, BotToken);
      expect(result).toBe(false);
    });

    it("should return false for empty hash", async () => {
      const tamperedData = { ...validAuthData, hash: "" };
      const result = await verifyTelegramAuth(tamperedData, BotToken);
      expect(result).toBe(false);
    });

    it("should return false with wrong bot token", async () => {
      const result = await verifyTelegramAuth(validAuthData, "wrong_token");
      expect(result).toBe(false);
    });

    it("should be case-sensitive for hash", async () => {
      const uppercaseHash = {
        ...validAuthData,
        hash: validAuthData.hash.toUpperCase(),
      };
      const result = await verifyTelegramAuth(uppercaseHash, BotToken);
      expect(result).toBe(false);
    });
  });

  describe("Expired auth_date", () => {
    it("should return false for auth data older than maxAge", async () => {
      const oldTime = Math.floor(Date.now() / 1000) - 86401; // 1 day + 1 second
      const oldData = { ...validAuthData, auth_date: oldTime };

      // Regenerate valid hash for old data
      const { hash: _, ...dataWithoutHash } = oldData;

      const dataCheckString = Object.keys(dataWithoutHash)
        .sort()
        .map(
          (key) =>
            `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`
        )
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...oldData, hash },
        BotToken,
        86400
      );
      expect(result).toBe(false);
    });

    it("should respect custom maxAge parameter", async () => {
      const sixtySecondsAgo = Math.floor(Date.now() / 1000) - 60;
      const data = { ...validAuthData, auth_date: sixtySecondsAgo };

      // Regenerate hash
      const { hash: _, ...dataWithoutHash } = data;

      const dataCheckString = Object.keys(dataWithoutHash)
        .sort()
        .map(
          (key) =>
            `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`
        )
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      // Should fail with maxAge of 30 seconds
      const result = await verifyTelegramAuth({ ...data, hash }, BotToken, 30);
      expect(result).toBe(false);
    });

    it("should accept auth data exactly at maxAge boundary", async () => {
      const exactlyMaxAge = Math.floor(Date.now() / 1000) - 3600; // exactly 1 hour
      const data = { ...validAuthData, auth_date: exactlyMaxAge };

      // Regenerate hash
      const { hash: _, ...dataWithoutHash } = data;

      const dataCheckString = Object.keys(dataWithoutHash)
        .sort()
        .map(
          (key) =>
            `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`
        )
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...data, hash },
        BotToken,
        3600
      );
      expect(result).toBe(true);
    });
  });

  describe("Data ordering", () => {
    it("should verify regardless of field order in original data", async () => {
      // Create data with fields in different order
      const unorderedData = {
        auth_date: validAuthData.auth_date,
        first_name: validAuthData.first_name,
        hash: validAuthData.hash,
        id: validAuthData.id,
        last_name: validAuthData.last_name,
        photo_url: validAuthData.photo_url,
        username: validAuthData.username,
      } as TelegramAuthData;

      const result = await verifyTelegramAuth(unorderedData, BotToken);
      expect(result).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle auth_date as 0 (Unix epoch)", async () => {
      const epochData = { ...validAuthData, auth_date: 0 };

      // Regenerate hash
      const { hash: _, ...dataWithoutHash } = epochData;

      const dataCheckString = Object.keys(dataWithoutHash)
        .sort()
        .map(
          (key) =>
            `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`
        )
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      // Should fail because it's way too old
      const result = await verifyTelegramAuth(
        { ...epochData, hash },
        BotToken,
        86400
      );
      expect(result).toBe(false);
    });

    it("should handle special characters in names", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const specialCharsData = {
        auth_date: currentTime,
        first_name: "José María",
        id: 123456789,
        last_name: "O'Brien-Smith",
      };

      // Generate valid hash
      const dataCheckString = Object.keys(specialCharsData)
        .sort()
        .map(
          (key) =>
            `${key}=${specialCharsData[key as keyof typeof specialCharsData]}`
        )
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...specialCharsData, hash },
        BotToken
      );
      expect(result).toBe(true);
    });

    it("should handle Unicode in usernames", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const unicodeData = {
        auth_date: currentTime,
        first_name: "User",
        id: 123456789,
        username: "用户名",
      };

      // Generate valid hash
      const dataCheckString = Object.keys(unicodeData)
        .sort()
        .map((key) => `${key}=${unicodeData[key as keyof typeof unicodeData]}`)
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...unicodeData, hash },
        BotToken
      );
      expect(result).toBe(true);
    });

    it("should handle very long photo URLs", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const longUrlData = {
        auth_date: currentTime,
        first_name: "User",
        id: 123456789,
        photo_url: `https://example.com/${"a".repeat(1000)}.jpg`,
      };

      // Generate valid hash
      const dataCheckString = Object.keys(longUrlData)
        .sort()
        .map((key) => `${key}=${longUrlData[key as keyof typeof longUrlData]}`)
        .join("\n");

      const secretKey = createHash("sha256").update(BotToken).digest();
      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const result = await verifyTelegramAuth(
        { ...longUrlData, hash },
        BotToken
      );
      expect(result).toBe(true);
    });
  });
});

describe("validateTelegramAuthData", () => {
  describe("Valid data", () => {
    it("should return true for valid minimal auth data", () => {
      const data = {
        auth_date: 1234567890,
        first_name: "John",
        hash: "abc123",
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(true);
    });

    it("should return true for valid complete auth data", () => {
      const data = {
        auth_date: 1234567890,
        first_name: "John",
        hash: "abc123",
        id: 123456789,
        last_name: "Doe",
        photo_url: "https://example.com/photo.jpg",
        username: "johndoe",
      };

      expect(validateTelegramAuthData(data)).toBe(true);
    });
  });

  describe("Invalid data", () => {
    it("should return false for null", () => {
      expect(validateTelegramAuthData(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateTelegramAuthData(undefined)).toBe(false);
    });

    it("should return false for string", () => {
      expect(validateTelegramAuthData("not an object")).toBe(false);
    });

    it("should return false for number", () => {
      expect(validateTelegramAuthData(123)).toBe(false);
    });

    it("should return false for array", () => {
      expect(validateTelegramAuthData([])).toBe(false);
    });

    it("should return false when missing id", () => {
      const data = {
        auth_date: 1234567890,
        first_name: "John",
        hash: "abc123",
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when missing first_name", () => {
      const data = {
        auth_date: 1234567890,
        hash: "abc123",
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when missing auth_date", () => {
      const data = {
        first_name: "John",
        hash: "abc123",
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when missing hash", () => {
      const data = {
        auth_date: 1234567890,
        first_name: "John",
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when id is string", () => {
      const data = {
        auth_date: 1234567890,
        first_name: "John",
        hash: "abc123",
        id: "123456789",
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when first_name is number", () => {
      const data = {
        auth_date: 1234567890,
        first_name: 123,
        hash: "abc123",
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when auth_date is string", () => {
      const data = {
        auth_date: "1234567890",
        first_name: "John",
        hash: "abc123",
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false when hash is number", () => {
      const data = {
        auth_date: 1234567890,
        first_name: "John",
        hash: 123,
        id: 123456789,
      };

      expect(validateTelegramAuthData(data)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(validateTelegramAuthData({})).toBe(false);
    });
  });

  describe("Type narrowing", () => {
    it("should narrow type to TelegramAuthData when true", () => {
      const data: unknown = {
        auth_date: 1234567890,
        first_name: "John",
        hash: "abc123",
        id: 123456789,
      };

      if (validateTelegramAuthData(data)) {
        // TypeScript should know this is TelegramAuthData now
        expect(data.id).toBe(123456789);
        expect(data.first_name).toBe("John");
        expect(data.auth_date).toBe(1234567890);
        expect(data.hash).toBe("abc123");
      }
    });
  });
});

describe("parseMiniAppInitData", () => {
  it("should parse minimal initData", () => {
    const initData = "auth_date=1234567890&hash=abc123";
    const result = parseMiniAppInitData(initData);

    expect(result.auth_date).toBe(1234567890);
    expect(result.hash).toBe("abc123");
  });

  it("should parse initData with user object", () => {
    const user = {
      first_name: "John",
      id: 123456789,
      last_name: "Doe",
      username: "johndoe",
    };
    const initData = `user=${encodeURIComponent(JSON.stringify(user))}&auth_date=1234567890&hash=abc123`;
    const result = parseMiniAppInitData(initData);

    expect(result.user).toEqual(user);
    expect(result.auth_date).toBe(1234567890);
    expect(result.hash).toBe("abc123");
  });

  it("should parse initData with all fields", () => {
    const user = {
      first_name: "John",
      id: 123456789,
      is_premium: true,
      language_code: "en",
    };
    const chat = {
      id: 987654321,
      title: "Test Chat",
      type: "private",
    };

    const initData = [
      `user=${encodeURIComponent(JSON.stringify(user))}`,
      `chat=${encodeURIComponent(JSON.stringify(chat))}`,
      "query_id=AAE123",
      "chat_type=private",
      "chat_instance=456",
      "start_param=ref123",
      "auth_date=1234567890",
      "hash=abc123",
    ].join("&");

    const result = parseMiniAppInitData(initData);

    expect(result.user).toEqual(user);
    expect(result.chat).toEqual(chat);
    expect(result.query_id).toBe("AAE123");
    expect(result.chat_type).toBe("private");
    expect(result.chat_instance).toBe("456");
    expect(result.start_param).toBe("ref123");
    expect(result.auth_date).toBe(1234567890);
    expect(result.hash).toBe("abc123");
  });

  it("should handle invalid JSON gracefully", () => {
    const initData = "user={invalid json}&auth_date=1234567890&hash=abc123";
    const result = parseMiniAppInitData(initData);

    expect(result.user).toBeUndefined();
    expect(result.auth_date).toBe(1234567890);
    expect(result.hash).toBe("abc123");
  });

  it("should parse can_send_after as number", () => {
    const initData = "can_send_after=3600&auth_date=1234567890&hash=abc123";
    const result = parseMiniAppInitData(initData);

    expect(result.can_send_after).toBe(3600);
    expect(typeof result.can_send_after).toBe("number");
  });
});

describe("verifyMiniAppInitData", () => {
  const BotToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";

  function createValidInitData(
    authDate: number = Math.floor(Date.now() / 1000)
  ): string {
    const user = {
      first_name: "John",
      id: 123456789,
      username: "johndoe",
    };

    const params = new URLSearchParams({
      auth_date: authDate.toString(),
      query_id: "AAE123",
      user: JSON.stringify(user),
    });

    // Calculate hash
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData")
      .update(BotToken)
      .digest();

    const hash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    params.append("hash", hash);
    return params.toString();
  }

  describe("Valid initData", () => {
    it("should return true for valid initData", async () => {
      const initData = createValidInitData();
      const result = await verifyMiniAppInitData(initData, BotToken);

      expect(result).toBe(true);
    });

    it("should verify initData within maxAge", async () => {
      const authDate = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const initData = createValidInitData(authDate);
      const result = await verifyMiniAppInitData(initData, BotToken, 86400);

      expect(result).toBe(true);
    });

    it("should verify minimal initData", async () => {
      const authDate = Math.floor(Date.now() / 1000);
      const params = new URLSearchParams({
        auth_date: authDate.toString(),
      });

      const dataCheckString = `auth_date=${authDate}`;
      const secretKey = createHmac("sha256", "WebAppData")
        .update(BotToken)
        .digest();

      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      params.append("hash", hash);
      const result = await verifyMiniAppInitData(params.toString(), BotToken);

      expect(result).toBe(true);
    });
  });

  describe("Invalid initData", () => {
    it("should return false for missing hash", async () => {
      const initData = "auth_date=1234567890&user=%7B%22id%22%3A123%7D";
      const result = await verifyMiniAppInitData(initData, BotToken);

      expect(result).toBe(false);
    });

    it("should return false for missing auth_date", async () => {
      const initData = "user=%7B%22id%22%3A123%7D&hash=abc123";
      const result = await verifyMiniAppInitData(initData, BotToken);

      expect(result).toBe(false);
    });

    it("should return false for invalid hash", async () => {
      const authDate = Math.floor(Date.now() / 1000);
      const initData = `auth_date=${authDate}&hash=invalid_hash`;
      const result = await verifyMiniAppInitData(initData, BotToken);

      expect(result).toBe(false);
    });

    it("should return false for tampered data", async () => {
      const validInitData = createValidInitData();
      // Tamper with the data
      const tamperedData = validInitData.replace("johndoe", "hacker");
      const result = await verifyMiniAppInitData(tamperedData, BotToken);

      expect(result).toBe(false);
    });

    it("should return false for expired initData", async () => {
      const authDate = Math.floor(Date.now() / 1000) - 90000; // >24 hours ago
      const initData = createValidInitData(authDate);
      const result = await verifyMiniAppInitData(initData, BotToken, 86400);

      expect(result).toBe(false);
    });

    it("should return false with wrong bot token", async () => {
      const initData = createValidInitData();
      const wrongToken = "987654321:WrongTokenHere";
      const result = await verifyMiniAppInitData(initData, wrongToken);

      expect(result).toBe(false);
    });
  });

  describe("Security", () => {
    it("should use WebAppData constant for secret key", async () => {
      // This tests that we use the correct secret key derivation
      const authDate = Math.floor(Date.now() / 1000);
      const params = new URLSearchParams({ auth_date: authDate.toString() });

      // Wrong: using SHA256(token) like Login Widget
      const wrongSecretKey = createHash("sha256").update(BotToken).digest();
      const wrongHash = createHmac("sha256", wrongSecretKey)
        .update(`auth_date=${authDate}`)
        .digest("hex");

      params.append("hash", wrongHash);
      const result = await verifyMiniAppInitData(params.toString(), BotToken);

      // Should fail because wrong secret key derivation
      expect(result).toBe(false);
    });

    it("should verify data-check-string alphabetical sorting", async () => {
      // Test that fields are sorted correctly
      const authDate = Math.floor(Date.now() / 1000);
      const params = new URLSearchParams();
      params.append("query_id", "AAE123");
      params.append("auth_date", authDate.toString());
      params.append("chat_type", "private");

      // Calculate with correct sorting
      const dataCheckString = [
        `auth_date=${authDate}`,
        "chat_type=private",
        "query_id=AAE123",
      ].join("\n");

      const secretKey = createHmac("sha256", "WebAppData")
        .update(BotToken)
        .digest();

      const hash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      params.append("hash", hash);
      const result = await verifyMiniAppInitData(params.toString(), BotToken);

      expect(result).toBe(true);
    });
  });
});

describe("validateMiniAppData", () => {
  describe("Valid data", () => {
    it("should return true for minimal valid data", () => {
      const data = {
        auth_date: 1234567890,
        hash: "abc123",
      };

      expect(validateMiniAppData(data)).toBe(true);
    });

    it("should return true for data with user", () => {
      const data = {
        auth_date: 1234567890,
        hash: "abc123",
        user: {
          first_name: "John",
          id: 123456789,
        },
      };

      expect(validateMiniAppData(data)).toBe(true);
    });

    it("should return true for complete data", () => {
      const data: TelegramMiniAppData = {
        auth_date: 1234567890,
        chat_type: "private",
        hash: "abc123",
        query_id: "AAE123",
        user: {
          first_name: "John",
          id: 123456789,
          is_premium: true,
          language_code: "en",
          last_name: "Doe",
          username: "johndoe",
        },
      };

      expect(validateMiniAppData(data)).toBe(true);
    });
  });

  describe("Invalid data", () => {
    it("should return false for null", () => {
      expect(validateMiniAppData(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateMiniAppData(undefined)).toBe(false);
    });

    it("should return false for missing auth_date", () => {
      const data = {
        hash: "abc123",
      };

      expect(validateMiniAppData(data)).toBe(false);
    });

    it("should return false for missing hash", () => {
      const data = {
        auth_date: 1234567890,
      };

      expect(validateMiniAppData(data)).toBe(false);
    });

    it("should return false for invalid user object", () => {
      const data = {
        auth_date: 1234567890,
        hash: "abc123",
        user: {
          // Missing id and first_name
          username: "johndoe",
        },
      };

      expect(validateMiniAppData(data)).toBe(false);
    });

    it("should return false when user.id is string", () => {
      const data = {
        auth_date: 1234567890,
        hash: "abc123",
        user: {
          first_name: "John",
          id: "123456789",
        },
      };

      expect(validateMiniAppData(data)).toBe(false);
    });
  });
});
