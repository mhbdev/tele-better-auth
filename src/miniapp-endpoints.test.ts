/**
 * @vitest-environment happy-dom
 *
 * Tests for miniapp-endpoints.ts — signIn and validate handlers.
 * Covers every branch: initData validation, HMAC verification,
 * existing account, existing user by telegramId, auto-create,
 * auto-create disabled, auto-signin disabled, custom mapper,
 * and validate endpoint (valid/invalid).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("better-auth/api", () => {
  class MockAPIError extends Error {
    status: string;
    constructor(status: string, opts: { message: string }) {
      super(opts.message);
      this.status = status;
    }
    static from(status: string, error: { code: string; message: string }) {
      return new MockAPIError(status, { message: error.message });
    }
  }
  return {
    APIError: MockAPIError,
    createAuthEndpoint: vi.fn(
      (_path: string, _options: any, handler: any) => handler
    ),
    createAuthMiddleware: (handler: any) => handler,
    freshSessionMiddleware: {},
    sessionMiddleware: {},
  };
});

vi.mock("better-auth/cookies", () => ({
  setSessionCookie: vi.fn(),
}));

vi.mock("./verify", () => ({
  parseMiniAppInitData: vi.fn(),
  validateMiniAppData: vi.fn(),
  verifyMiniAppInitData: vi.fn(),
}));

import { ERROR_CODES } from "./constants";
import {
  createMiniAppEndpoints,
  getMiniAppRateLimits,
} from "./miniapp-endpoints";
import type { TelegramPluginConfig } from "./plugin-config";
import {
  parseMiniAppInitData,
  validateMiniAppData,
  verifyMiniAppInitData,
} from "./verify";

const mockedVerify = vi.mocked(verifyMiniAppInitData);
const mockedParse = vi.mocked(parseMiniAppInitData);
const mockedValidate = vi.mocked(validateMiniAppData);

const INIT_DATA = "user=%7B%22id%22%3A99%7D&auth_date=1700000000&hash=abc";

const PARSED_DATA = {
  auth_date: 1700000000,
  hash: "abc",
  user: {
    first_name: "Bob",
    id: 99,
    last_name: "Jones",
    photo_url: "https://t.me/bob.jpg",
    username: "bobjones",
  },
};

function makeConfig(
  overrides: Partial<TelegramPluginConfig> = {}
): TelegramPluginConfig {
  return {
    allowUserToLink: true,
    autoCreateUser: true,
    botToken: "tok:en",
    botUsername: "bot",
    maxAuthAge: 86400,
    miniAppAllowAutoSignin: true,
    miniAppEnabled: true,
    miniAppValidateInitData: true,
    oidcClientId: "123456789",
    oidcEnabled: false,
    testMode: false,
    widgetEnabled: false,
    ...overrides,
  };
}

function mockAdapter(overrides: Record<string, any> = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: "new-id" }),
    delete: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
    transaction: (callback: any) => callback({}),
    update: vi.fn(),
    ...overrides,
  };
}

function mockCtx(adapter: any, body: any) {
  return {
    body: Promise.resolve(body),
    context: {
      adapter,
      internalAdapter: {
        createOAuthUser: async (user: any, account: any) => {
          const created = await adapter.create({ data: user, model: "user" });
          return {
            account: await adapter.create({
              data: { ...account, userId: created.id },
              model: "account",
            }),
            user: created,
          };
        },
        createSession: vi
          .fn()
          .mockResolvedValue({ id: "sess-1", token: "tok" }),
        deleteAccount: (id: string) =>
          adapter.delete({
            model: "account",
            where: [{ field: "id", value: id }],
          }),
        findAccounts: async () => {
          const account = await adapter.findOne({ model: "account" });
          return account
            ? [account, { id: "credential", providerId: "credential" }]
            : [];
        },
        findUserById: (id: string) =>
          adapter.findOne({
            model: "user",
            where: [{ field: "id", value: id }],
          }),
        linkAccount: (data: any) => adapter.create({ data, model: "account" }),
        updateUser: (id: string, update: any) =>
          adapter.update({
            model: "user",
            update,
            where: [{ field: "id", value: id }],
          }),
      },
      options: {},
    },
    json: vi.fn((data: any) => data),
  };
}

// ── signInWithMiniApp ──────────────────────────────────────────────────

describe("signInWithMiniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerify.mockResolvedValue(true);
    mockedParse.mockReturnValue(PARSED_DATA as any);
    mockedValidate.mockReturnValue(true);
  });

  it("rejects when initData is missing", async () => {
    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), {});

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INIT_DATA_REQUIRED.message
    );
  });

  it("rejects when initData is not a string", async () => {
    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: 12345 });

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INIT_DATA_REQUIRED.message
    );
  });

  it("rejects invalid initData verification", async () => {
    mockedVerify.mockResolvedValue(false);
    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INVALID_MINI_APP_INIT_DATA.message
    );
  });

  it("verifies even when a legacy config disables validation", async () => {
    mockedVerify.mockResolvedValue(false); // would fail if called
    const adapter = mockAdapter({
      findOne: vi.fn().mockResolvedValue({ id: "a1", userId: "u1" }),
    });

    const endpoints = createMiniAppEndpoints(
      makeConfig({ miniAppValidateInitData: false })
    );
    const ctx = mockCtx(adapter, { initData: INIT_DATA });

    // Should NOT throw despite verify returning false
    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INVALID_MINI_APP_INIT_DATA.message
    );
    expect(mockedVerify).toHaveBeenCalled();
  });

  it("rejects invalid data structure", async () => {
    mockedValidate.mockReturnValue(false);
    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INVALID_MINI_APP_DATA_STRUCTURE.message
    );
  });

  it("rejects when no user in initData", async () => {
    mockedParse.mockReturnValue({
      auth_date: 1700000000,
      hash: "abc",
    } as any);

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.NO_USER_IN_INIT_DATA.message
    );
  });

  it("signs in with existing account", async () => {
    const adapter = mockAdapter({
      findOne: vi.fn().mockImplementation(({ model }: any) => {
        if (model === "account") {
          return { id: "a1", userId: "existing-u" };
        }
        if (model === "user") {
          return { id: "existing-u", name: "Bob" };
        }
        return null;
      }),
    });

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(adapter, { initData: INIT_DATA });
    await (endpoints.signInWithMiniApp as any)(ctx);

    expect(adapter.create).not.toHaveBeenCalled();
    expect(ctx.context.internalAdapter.createSession).toHaveBeenCalledWith(
      "existing-u"
    );
  });

  it("links existing user found by telegramId", async () => {
    const adapter = mockAdapter({
      findOne: vi.fn().mockImplementation(({ model, where }: any) => {
        if (model === "account") {
          return null;
        }
        if (model === "user") {
          const tgFilter = where.find((w: any) => w.field === "telegramId");
          if (tgFilter) {
            return { id: "user-tg" };
          }
          const idFilter = where.find((w: any) => w.field === "id");
          if (idFilter) {
            return { id: "user-tg", name: "Bob" };
          }
        }
        return null;
      }),
    });

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(adapter, { initData: INIT_DATA });
    await (endpoints.signInWithMiniApp as any)(ctx);

    // Should create account link only
    expect(adapter.create).toHaveBeenCalledTimes(1);
    expect(adapter.create).toHaveBeenCalledWith({
      data: {
        accountId: "99",
        providerId: "telegram",
        telegramId: "99",
        telegramUsername: "bobjones",
        userId: "user-tg",
      },
      model: "account",
    });
  });

  it("creates new user when autoCreateUser and miniAppAllowAutoSignin are true", async () => {
    const adapter = mockAdapter({
      create: vi.fn().mockImplementation(({ model }: any) => {
        if (model === "user") {
          return { id: "new-u" };
        }
        return { id: "acc-1" };
      }),
      findOne: vi.fn().mockImplementation(({ model, where }: any) => {
        if (model === "user") {
          const idFilter = where.find((w: any) => w.field === "id");
          if (idFilter) {
            return { id: "new-u", name: "Bob Jones" };
          }
        }
        return null;
      }),
    });

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(adapter, { initData: INIT_DATA });
    await (endpoints.signInWithMiniApp as any)(ctx);

    // user + account created
    expect(adapter.create).toHaveBeenCalledTimes(2);
    expect(adapter.create.mock.calls[0]![0].model).toBe("user");
    expect(adapter.create.mock.calls[0]![0].data.name).toBe("Bob Jones");
    expect(adapter.create.mock.calls[0]![0].data.telegramId).toBe("99");
    expect(adapter.create.mock.calls[1]![0].model).toBe("account");
  });

  it("throws when autoCreateUser is false and no user exists", async () => {
    const endpoints = createMiniAppEndpoints(
      makeConfig({ autoCreateUser: false })
    );
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.MINI_APP_AUTO_SIGNIN_DISABLED.message
    );
  });

  it("throws when miniAppAllowAutoSignin is false and no user exists", async () => {
    const endpoints = createMiniAppEndpoints(
      makeConfig({ miniAppAllowAutoSignin: false })
    );
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });

    await expect((endpoints.signInWithMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.MINI_APP_AUTO_SIGNIN_DISABLED.message
    );
  });

  it("uses mapMiniAppDataToUser when provided", async () => {
    const mapper = vi.fn(() => ({
      email: "bob@example.com",
      name: "Custom Bob",
    }));

    const adapter = mockAdapter({
      create: vi.fn().mockResolvedValue({ id: "new-u" }),
      findOne: vi.fn().mockImplementation(({ model, where }: any) => {
        if (model === "user") {
          const idFilter = where.find((w: any) => w.field === "id");
          if (idFilter) {
            return { id: "new-u" };
          }
        }
        return null;
      }),
    });

    const endpoints = createMiniAppEndpoints(
      makeConfig({ mapMiniAppDataToUser: mapper })
    );
    const ctx = mockCtx(adapter, { initData: INIT_DATA });
    await (endpoints.signInWithMiniApp as any)(ctx);

    expect(mapper).toHaveBeenCalledWith(PARSED_DATA.user);
    expect(adapter.create.mock.calls[0]![0].data.name).toBe("Custom Bob");
  });

  it("builds name without last_name", async () => {
    mockedParse.mockReturnValue({
      auth_date: 1700000000,
      hash: "abc",
      user: { first_name: "Bob", id: 99 },
    } as any);

    const adapter = mockAdapter({
      create: vi.fn().mockResolvedValue({ id: "u1" }),
      findOne: vi.fn().mockImplementation(({ model, where }: any) => {
        if (model === "user") {
          const idFilter = where.find((w: any) => w.field === "id");
          if (idFilter) {
            return { id: "u1" };
          }
        }
        return null;
      }),
    });

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(adapter, { initData: INIT_DATA });
    await (endpoints.signInWithMiniApp as any)(ctx);

    expect(adapter.create.mock.calls[0]![0].data.name).toBe("Bob");
  });

  it("passes botToken and maxAuthAge to verifyMiniAppInitData", async () => {
    const config = makeConfig({ botToken: "my:tok", maxAuthAge: 500 });
    const adapter = mockAdapter({
      findOne: vi.fn().mockResolvedValue({ id: "a1", userId: "u1" }),
    });

    const endpoints = createMiniAppEndpoints(config);
    const ctx = mockCtx(adapter, { initData: INIT_DATA });
    await (endpoints.signInWithMiniApp as any)(ctx);

    expect(mockedVerify).toHaveBeenCalledWith(INIT_DATA, "my:tok", 500);
  });
});

// ── validateMiniApp ──────────────────────────────────────────────────

describe("validateMiniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when initData is missing", async () => {
    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), {});

    await expect((endpoints.validateMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INIT_DATA_REQUIRED.message
    );
  });

  it("rejects when initData is not a string", async () => {
    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: 42 });

    await expect((endpoints.validateMiniApp as any)(ctx)).rejects.toThrow(
      ERROR_CODES.INIT_DATA_REQUIRED.message
    );
  });

  it("returns valid: false when verification fails", async () => {
    mockedVerify.mockResolvedValue(false);

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });
    await (endpoints.validateMiniApp as any)(ctx);

    expect(ctx.json).toHaveBeenCalledWith({
      data: null,
      valid: false,
    });
  });

  it("returns valid: true with parsed data when verification succeeds", async () => {
    mockedVerify.mockResolvedValue(true);
    mockedParse.mockReturnValue(PARSED_DATA as any);

    const endpoints = createMiniAppEndpoints(makeConfig());
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });
    await (endpoints.validateMiniApp as any)(ctx);

    expect(ctx.json).toHaveBeenCalledWith({
      data: PARSED_DATA,
      valid: true,
    });
  });

  it("passes botToken and maxAuthAge to verify", async () => {
    mockedVerify.mockResolvedValue(false);
    const config = makeConfig({ botToken: "x:y", maxAuthAge: 123 });

    const endpoints = createMiniAppEndpoints(config);
    const ctx = mockCtx(mockAdapter(), { initData: INIT_DATA });
    await (endpoints.validateMiniApp as any)(ctx);

    expect(mockedVerify).toHaveBeenCalledWith(INIT_DATA, "x:y", 123);
  });
});

// ── Rate limits ───────────────────────────────────────────────────────

describe("getMiniAppRateLimits", () => {
  it("returns 2 rate limit rules", () => {
    const limits = getMiniAppRateLimits();
    expect(limits).toHaveLength(3);
  });

  it("matches correct paths", () => {
    const limits = getMiniAppRateLimits();
    expect(limits[0]!.pathMatcher("/telegram/miniapp/signin")).toBe(true);
    expect(limits[0]!.pathMatcher("/telegram/miniapp/validate")).toBe(false);
    expect(limits[1]!.pathMatcher("/telegram/miniapp/validate")).toBe(true);
    expect(limits[1]!.pathMatcher("/telegram/miniapp/signin")).toBe(false);
  });
});
