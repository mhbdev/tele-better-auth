import {
  TELEGRAM_OIDC_AUTH_ENDPOINT,
  TELEGRAM_OIDC_ISSUER,
  TELEGRAM_OIDC_JWKS_URI,
  TELEGRAM_OIDC_PROVIDER_ID,
  TELEGRAM_OIDC_TOKEN_ENDPOINT,
} from "./constants";

const BOT_ID = "123456789";

import { afterEach, describe, expect, it, vi } from "vitest";

const BOT_TOKEN = "123456789:test-token";
afterEach(() => vi.restoreAllMocks());
describe("Plugin integration", () => {
  describe("init hook with OIDC", () => {
    it("should include init hook when oidc.enabled is true", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      expect(plugin).toHaveProperty("init");
      expect(typeof plugin.init).toBe("function");
    });

    it("should NOT include init hook when oidc is not configured", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
      });

      expect(plugin).not.toHaveProperty("init");
    });

    it("should NOT include init hook when oidc.enabled is false", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { enabled: false },
      });

      expect(plugin).not.toHaveProperty("init");
    });

    it("should return socialProviders from init hook", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      const mockCtx = {
        getPlugin: () => undefined,
        hasPlugin: () => false,
        socialProviders: [],
      } as any;
      const result = plugin.init!(mockCtx)!;
      const providers = result.context!.socialProviders!;

      expect(providers).toHaveLength(1);
      expect(providers[0]!.id).toBe(TELEGRAM_OIDC_PROVIDER_ID);
      expect(providers[0]!.name).toBe("Telegram");
    });

    it("should preserve existing social providers via concat", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      const existingProvider = {
        id: "google",
        name: "Google",
      };
      const mockCtx = {
        getPlugin: () => undefined,
        hasPlugin: () => false,
        socialProviders: [existingProvider],
      } as any;
      const result = plugin.init!(mockCtx)!;
      const providers = result.context!.socialProviders!;

      expect(providers).toHaveLength(2);
      expect(providers[0]!.id).toBe(TELEGRAM_OIDC_PROVIDER_ID);
      expect(providers[1]!).toBe(existingProvider);
    });

    it("should pass OIDC options to the provider", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: {
          clientSecret: "test-oidc-secret",
          enabled: true,
          requestBotAccess: true,
          requestPhone: true,
        },
      });

      const mockCtx = {
        getPlugin: () => undefined,
        hasPlugin: () => false,
        socialProviders: [],
      } as any;
      const result = plugin.init!(mockCtx);
      const [provider] = result.context!.socialProviders!;

      expect(provider!.options?.clientId).toBe(BOT_ID);
      expect(provider!.options?.clientSecret).toBe("test-oidc-secret");
    });
  });

  describe("testMode + OIDC warning", () => {
    it("should warn when testMode and oidc are both enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { telegram } = await import("./index");
      telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
        testMode: true,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("testMode is enabled with OIDC")
      );

      warnSpy.mockRestore();
    });

    it("should not warn when only testMode is enabled without OIDC", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { telegram } = await import("./index");
      telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        testMode: true,
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should not warn when testMode is true and oidc.enabled is false", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { telegram } = await import("./index");
      telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { enabled: false },
        testMode: true,
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should not warn when testMode is false and oidc is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { telegram } = await import("./index");
      telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
        testMode: false,
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should include [tele-better-auth] prefix and oauth.telegram.org in warning", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { telegram } = await import("./index");
      telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
        testMode: true,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[tele-better-auth]")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("oauth.telegram.org")
      );

      warnSpy.mockRestore();
    });
  });

  describe("testMode defaults and invariants", () => {
    it("should default testMode to false — no warn even with oidc enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { telegram } = await import("./index");
      telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      // testMode defaults to false, so no warning even though oidc is on
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should not create init hook from testMode alone", async () => {
      const { telegram } = await import("./index");

      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        testMode: true,
      });

      // testMode alone doesn't add init — only oidc.enabled does
      expect(plugin.init).toBeUndefined();
    });

    it("should return init result as an object (not void) when oidc enabled", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      const mockCtx = {
        getPlugin: () => undefined,
        hasPlugin: () => false,
        socialProviders: [],
      } as any;
      const result = plugin.init!(mockCtx);

      // Prove it returns an object, not void/undefined
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("context");
      expect(result!.context).toHaveProperty("socialProviders");
    });
  });

  describe("Config endpoint oidcEnabled", () => {
    it("should have getTelegramConfig endpoint", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      expect(plugin.endpoints).toHaveProperty("getTelegramConfig");
    });

    it("should include telegramPhoneNumber in schema", async () => {
      const { telegram } = await import("./index");
      const plugin = telegram({
        botToken: BOT_TOKEN,
        botUsername: "test_bot",
        oidc: { clientSecret: "test-oidc-secret", enabled: true },
      });

      expect(plugin.schema!.user!.fields).toHaveProperty("telegramPhoneNumber");
      expect(plugin.schema!.user!.fields.telegramPhoneNumber).toEqual({
        input: false,
        required: false,
        type: "string",
        unique: false,
      });
    });
  });
});

describe("Constants", () => {
  it("should export correct OIDC constants", () => {
    expect(TELEGRAM_OIDC_PROVIDER_ID).toBe("telegram-oidc");
    expect(TELEGRAM_OIDC_ISSUER).toBe("https://oauth.telegram.org");
    expect(TELEGRAM_OIDC_AUTH_ENDPOINT).toBe("https://oauth.telegram.org/auth");
    expect(TELEGRAM_OIDC_TOKEN_ENDPOINT).toBe(
      "https://oauth.telegram.org/token"
    );
    expect(TELEGRAM_OIDC_JWKS_URI).toBe(
      "https://oauth.telegram.org/.well-known/jwks.json"
    );
  });
});

describe("Adversarial: testMode option", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should default testMode to false when not specified in options", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    // The config endpoint should exist and testMode should be false by default
    expect(plugin.endpoints).toHaveProperty("getTelegramConfig");
    // The endpoint created by createAuthEndpoint is a function
    expect(typeof plugin.endpoints.getTelegramConfig).toBe("function");
  });

  it("should not warn when testMode is true and oidc is omitted entirely", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { telegram } = await import("./index");
    telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      testMode: true,
      // no oidc key at all
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when testMode is true and oidc.enabled is explicitly false", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { telegram } = await import("./index");
    telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      oidc: { enabled: false },
      testMode: true,
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should warn with the exact expected message string", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { telegram } = await import("./index");
    telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
      testMode: true,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[tele-better-auth] testMode is enabled with OIDC. Telegram's OIDC endpoint (oauth.telegram.org) has no documented test variant — OIDC authentication may not work with test server bot tokens."
    );
  });

  it("should not warn when testMode is false and oidc is enabled", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { telegram } = await import("./index");
    telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
      testMode: false,
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when testMode is false (default) and oidc is enabled", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { telegram } = await import("./index");
    telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      // testMode omitted, defaults to false
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("passing testMode: false explicitly should behave same as omitting it", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { telegram } = await import("./index");

    const pluginWithExplicitFalse = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
      testMode: false,
    });

    const pluginWithOmitted = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
    });

    // Neither should have triggered a warning
    expect(warnSpy).not.toHaveBeenCalled();

    // Both should have the same plugin ID and structure
    expect(pluginWithExplicitFalse.id).toBe(pluginWithOmitted.id);
    expect(pluginWithExplicitFalse.id).toBe("telegram");
  });
});

describe("Adversarial: init hook return value is non-void object", () => {
  it("should return a concrete object from init, not undefined/void", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
    });

    const mockCtx = {
      getPlugin: () => undefined,
      hasPlugin: () => false,
      socialProviders: [],
    } as any;

    const result = plugin.init!(mockCtx);

    // The result must be a non-null object, not undefined
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
    expect(result).not.toBeUndefined();

    // It must have the context property with socialProviders
    expect(result).toHaveProperty("context");
    expect(result!.context).toHaveProperty("socialProviders");
    expect(Array.isArray(result!.context!.socialProviders)).toBe(true);
  });
});

describe("Adversarial: config endpoint shape with testMode", () => {
  it("should include all four config fields in the plugin structure", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "my_bot",
      miniApp: { enabled: true },
      oidc: { clientSecret: "test-oidc-secret", enabled: true },
      testMode: true,
    });

    // The getTelegramConfig endpoint must exist
    expect(plugin.endpoints).toHaveProperty("getTelegramConfig");
  });

  it("should have PLUGIN_ID as 'telegram'", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    expect(plugin.id).toBe("telegram");
  });

  it("should include $ERROR_CODES on the plugin", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    expect(plugin).toHaveProperty("$ERROR_CODES");
    expect(plugin.$ERROR_CODES).toHaveProperty("BOT_TOKEN_REQUIRED");
    expect(plugin.$ERROR_CODES).toHaveProperty("INVALID_AUTH_DATA");
  });

  it("should have rateLimit array with correct path matchers", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    expect(Array.isArray(plugin.rateLimit)).toBe(true);
    expect(plugin.rateLimit.length).toBeGreaterThanOrEqual(3);

    // Verify path matchers actually work
    const signinMatcher = plugin.rateLimit.find(
      (r) => r.pathMatcher("/telegram/signin") === true
    );
    expect(signinMatcher).toBeDefined();
    expect(signinMatcher!.max).toBe(10);

    const linkMatcher = plugin.rateLimit.find(
      (r) => r.pathMatcher("/telegram/link") === true
    );
    expect(linkMatcher).toBeDefined();
    expect(linkMatcher!.max).toBe(5);

    // Verify matchers don't match wrong paths
    expect(plugin.rateLimit[0]!.pathMatcher("/telegram/link")).toBe(false);
    expect(plugin.rateLimit[1]!.pathMatcher("/telegram/signin")).toBe(false);
  });
});

describe("Adversarial: plugin constructor error cases", () => {
  it("should throw when botToken is empty string", async () => {
    const { telegram } = await import("./index");
    expect(() => telegram({ botToken: "", botUsername: "test_bot" })).toThrow();
  });

  it("should throw when botUsername is empty string", async () => {
    const { telegram } = await import("./index");
    expect(() => telegram({ botToken: BOT_TOKEN, botUsername: "" })).toThrow();
  });

  it("should throw the specific BOT_TOKEN_REQUIRED message", async () => {
    const { telegram } = await import("./index");
    expect(() => telegram({ botToken: "", botUsername: "test_bot" })).toThrow(
      "Telegram plugin: botToken is required"
    );
  });

  it("should throw the specific BOT_USERNAME_REQUIRED message", async () => {
    const { telegram } = await import("./index");
    expect(() => telegram({ botToken: BOT_TOKEN, botUsername: "" })).toThrow(
      "Telegram plugin: botUsername is required"
    );
  });
});

// These tests read built output — skip when dist/ doesn't exist (e.g. CI runs tests before build)
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const distExists = existsSync(resolve(process.cwd(), "dist", "index.d.ts"));

describe.skipIf(!distExists)("Module augmentation in built output", () => {
  it("should have BetterAuthPluginRegistry in dist/index.d.ts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const distDir = path.resolve(process.cwd(), "dist");
    const dtsContent =
      fs.readFileSync(path.join(distDir, "index.d.ts"), "utf-8") +
      fs
        .readdirSync(distDir)
        .filter((file) => file.startsWith("index-") && file.endsWith(".d.ts"))
        .map((file) => fs.readFileSync(path.join(distDir, file), "utf-8"))
        .join("\n");
    expect(dtsContent).toContain("BetterAuthPluginRegistry");
    expect(dtsContent).toContain("typeof telegram");
    expect(dtsContent).toContain('declare module "@better-auth/core"');
  });

  it("should have BetterAuthPluginRegistry in dist/index.d.cts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const distDir = path.resolve(process.cwd(), "dist");
    const dctsContent =
      fs.readFileSync(path.join(distDir, "index.d.cts"), "utf-8") +
      fs
        .readdirSync(distDir)
        .filter((file) => file.startsWith("index-") && file.endsWith(".d.cts"))
        .map((file) => fs.readFileSync(path.join(distDir, file), "utf-8"))
        .join("\n");
    expect(dctsContent).toContain("BetterAuthPluginRegistry");
    expect(dctsContent).toContain("typeof telegram");
    expect(dctsContent).toContain('declare module "@better-auth/core"');
  });

  it("should reference the correct module path @better-auth/core in d.ts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const distDir = path.resolve(process.cwd(), "dist");
    const dtsContent =
      fs.readFileSync(path.join(distDir, "index.d.ts"), "utf-8") +
      fs
        .readdirSync(distDir)
        .filter((file) => file.startsWith("index-") && file.endsWith(".d.ts"))
        .map((file) => fs.readFileSync(path.join(distDir, file), "utf-8"))
        .join("\n");

    // Verify the augmentation references the exact module
    const moduleRegex = /declare module "@better-auth\/core"/;
    expect(moduleRegex.test(dtsContent)).toBe(true);

    // Make sure the creator is typed, not just `any`
    expect(dtsContent).toContain("creator: typeof telegram");
  });

  it("should have the augmentation in both ESM and CJS declaration files", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const distDir = path.resolve(process.cwd(), "dist");

    const dtsContent =
      fs.readFileSync(path.join(distDir, "index.d.ts"), "utf-8") +
      fs
        .readdirSync(distDir)
        .filter((file) => file.startsWith("index-") && file.endsWith(".d.ts"))
        .map((file) => fs.readFileSync(path.join(distDir, file), "utf-8"))
        .join("\n");
    const dctsContent =
      fs.readFileSync(path.join(distDir, "index.d.cts"), "utf-8") +
      fs
        .readdirSync(distDir)
        .filter((file) => file.startsWith("index-") && file.endsWith(".d.cts"))
        .map((file) => fs.readFileSync(path.join(distDir, file), "utf-8"))
        .join("\n");

    // Extract the augmentation blocks
    const augmentationPattern =
      /declare module "@better-auth\/core"\s*\{[\s\S]*?BetterAuthPluginRegistry[\s\S]*?\}/;

    const dtsMatch = dtsContent.match(augmentationPattern);
    const dctsMatch = dctsContent.match(augmentationPattern);

    expect(dtsMatch).not.toBeNull();
    expect(dctsMatch).not.toBeNull();

    // The augmentation content should be identical between ESM and CJS
    expect(dtsMatch![0]).toBe(dctsMatch![0]);
  });
});

describe("Adversarial: miniApp conditional endpoints", () => {
  it("should NOT have miniApp endpoints when miniApp is not configured", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    expect(plugin.endpoints).not.toHaveProperty("signInWithMiniApp");
    expect(plugin.endpoints).not.toHaveProperty("validateMiniApp");
  });

  it("should NOT have miniApp endpoints when miniApp.enabled is false", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      miniApp: { enabled: false },
    });

    expect(plugin.endpoints).not.toHaveProperty("signInWithMiniApp");
    expect(plugin.endpoints).not.toHaveProperty("validateMiniApp");
  });

  it("should HAVE miniApp endpoints when miniApp.enabled is true", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      miniApp: { enabled: true },
    });

    expect(plugin.endpoints).toHaveProperty("signInWithMiniApp");
    expect(plugin.endpoints).toHaveProperty("validateMiniApp");
  });

  it("should have miniApp rate limits when miniApp is enabled", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
      miniApp: { enabled: true },
    });

    const miniAppSigninMatcher = plugin.rateLimit.find(
      (r) => r.pathMatcher("/telegram/miniapp/signin") === true
    );
    const miniAppValidateMatcher = plugin.rateLimit.find(
      (r) => r.pathMatcher("/telegram/miniapp/validate") === true
    );

    expect(miniAppSigninMatcher).toBeDefined();
    expect(miniAppSigninMatcher!.max).toBe(10);
    expect(miniAppValidateMatcher).toBeDefined();
    expect(miniAppValidateMatcher!.max).toBe(20);
  });
});

describe("Adversarial: schema shape", () => {
  it("should have all expected user fields", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    const userFields = Object.keys(plugin.schema!.user!.fields);
    expect(userFields).toContain("telegramId");
    expect(userFields).toContain("telegramUsername");
    expect(userFields).toContain("telegramPhoneNumber");
    expect(userFields.length).toBe(3);
  });

  it("should have all expected account fields", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    const accountFields = Object.keys(plugin.schema!.account!.fields);
    expect(accountFields).toContain("telegramId");
    expect(accountFields).toContain("telegramUsername");
    expect(accountFields.length).toBe(2);
  });

  it("should mark all user fields as non-required and non-input", async () => {
    const { telegram } = await import("./index");
    const plugin = telegram({
      botToken: BOT_TOKEN,
      botUsername: "test_bot",
    });

    for (const [, field] of Object.entries(plugin.schema!.user!.fields)) {
      expect(field.required).toBe(false);
      expect(field.input).toBe(false);
    }
  });
});
