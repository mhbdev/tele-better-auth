/** @vitest-environment node */
import {
  createHash,
  createHmac,
  generateKeyPairSync,
  type KeyObject,
  sign as signEd25519,
  verify as verifyEd25519,
} from "node:crypto";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { parseMiniAppInitData, telegram } from "./index";

const botToken = "123456789:server-secret";
function widget(id = 42) {
  const data = {
    auth_date: Math.floor(Date.now() / 1000),
    first_name: "Alice",
    id,
  };
  const check = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return {
    ...data,
    hash: createHmac("sha256", createHash("sha256").update(botToken).digest())
      .update(check)
      .digest("hex"),
  };
}
function miniApp(id = 42, overrides = {}, token = botToken) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ first_name: "Alice", id }),
    ...overrides,
  });
  const check = [...params]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  params.set(
    "hash",
    createHmac(
      "sha256",
      createHmac("sha256", "WebAppData").update(token).digest()
    )
      .update(check)
      .digest("hex")
  );
  return params.toString();
}
function thirdPartyMiniApp(id: number, botId: number, privateKey: KeyObject) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: "a".repeat(64),
    user: JSON.stringify({ first_name: "Alice", id }),
  });
  const dataCheckString = [
    `${botId}:WebAppData`,
    ...Array.from(params.entries())
      .filter(([key]) => key !== "hash")
      .sort(([left], [right]) => compareKeys(left, right))
      .map(([key, value]) => `${key}=${value}`),
  ].join("\n");
  params.set(
    "signature",
    signEd25519(null, Buffer.from(dataCheckString), privateKey).toString(
      "base64url"
    )
  );
  return params.toString();
}
function compareKeys(left: string, right: string) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
function setup(extra = {}, pluginOptions = {}) {
  const db: {
    user: any[];
    account: any[];
    session: any[];
    verification: any[];
  } = { account: [], session: [], user: [], verification: [] };
  const afterCreate = vi.fn();
  const auth = betterAuth({
    baseURL: "https://app.test",
    database: memoryAdapter(db),
    databaseHooks: { user: { create: { after: afterCreate } } },
    emailAndPassword: { enabled: true },
    plugins: [
      telegram({
        botToken,
        botUsername: "test_bot",
        miniApp: { enabled: true },
        ...pluginOptions,
      }),
    ],
    secret: "a-reliable-secret-with-at-least-32-characters",
    ...extra,
  });
  const post = (
    path: string,
    body: unknown,
    cookie = "",
    origin = "https://app.test"
  ) => {
    const headers = new Headers({
      "Content-Type": "application/json",
      Origin: origin,
    });
    if (cookie) {
      headers.set("Cookie", cookie);
    }
    return auth.handler(
      new Request(`https://app.test/api/auth${path}`, {
        body: JSON.stringify(body),
        headers,
        method: "POST",
      })
    );
  };
  return { afterCreate, db, post };
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("real Better Auth endpoint integration", () => {
  it("blocks first-login requests from untrusted browser origins", async () => {
    const { db, post } = setup({ advanced: { disableOriginCheck: false } });
    const response = await post(
      "/telegram/signin",
      widget(),
      "",
      "https://attacker.test"
    );

    expect(response.status).toBe(403);
    expect(db.user).toHaveLength(0);
  });
  it("blocks untrusted-origin Mini App sign-in before creating a session", async () => {
    const { db, post } = setup({ advanced: { disableOriginCheck: false } });
    const response = await post(
      "/telegram/miniapp/signin",
      { initData: miniApp() },
      "",
      "https://attacker.test"
    );

    expect(response.status).toBe(403);
    expect(db.user).toHaveLength(0);
  });

  it("verifies publisher-owned Mini App data using the server-resolved campaign bot", async () => {
    const publisherBotId = 987654321;
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const verifier = vi.fn((initData, ctx, fields) => {
      const { campaignSlug } = fields;
      if (
        campaignSlug !== "spring-sale" ||
        ctx.request.headers.get("origin") !== "https://publisher.example"
      ) {
        return false;
      }
      const params = new URLSearchParams(initData);
      const signature = params.get("signature");
      params.delete("hash");
      params.delete("signature");
      const dataCheckString = [
        `${publisherBotId}:WebAppData`,
        ...Array.from(params.entries())
          .sort(([left], [right]) => compareKeys(left, right))
          .map(([key, value]) => `${key}=${value}`),
      ].join("\n");
      if (
        !(
          signature &&
          verifyEd25519(
            null,
            Buffer.from(dataCheckString),
            publicKey,
            Buffer.from(signature, "base64url")
          )
        )
      ) {
        return false;
      }
      return parseMiniAppInitData(initData).user;
    });
    const { db, post } = setup(
      {
        advanced: { disableOriginCheck: false },
        trustedOrigins: ["https://publisher.example"],
      },
      {
        botToken: "",
        loginWidget: false,
        miniApp: { enabled: true, verifyInitData: verifier },
      }
    );

    const accepted = await post(
      "/telegram/miniapp/signin",
      {
        botId: "client-value-is-ignored",
        campaignSlug: "spring-sale",
        initData: thirdPartyMiniApp(50, publisherBotId, privateKey),
      },
      "",
      "https://publisher.example"
    );
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).user.telegramId).toBe("50");
    expect(verifier).toHaveBeenCalledOnce();
    expect(verifier.mock.calls[0]![2]).toEqual({
      botId: "client-value-is-ignored",
      campaignSlug: "spring-sale",
    });

    const wrongBot = await post(
      "/telegram/miniapp/signin",
      {
        campaignSlug: "spring-sale",
        initData: thirdPartyMiniApp(51, publisherBotId + 1, privateKey),
      },
      "",
      "https://publisher.example"
    );
    expect(wrongBot.status).toBe(401);
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(1);
  });

  it("does not issue a session if user validation removes the Telegram account", async () => {
    let signInCalls = 0;
    const validateUserInfo = vi
      .fn()
      .mockImplementation(async ({ source }, ctx) => {
        if (source.action === "sign-in") {
          signInCalls += 1;
          if (signInCalls < 2) {
            return;
          }
          await ctx.context.adapter.delete({
            model: "account",
            where: [
              { field: "accountId", value: "42" },
              { field: "providerId", value: "telegram" },
            ],
          });
        }
      });
    const { db, post } = setup({ user: { validateUserInfo } });
    const first = await post("/telegram/signin", widget());
    expect(first.status).toBe(200);
    const second = await post("/telegram/signin", widget());

    expect(second.status).toBe(401);
    expect(db.session).toHaveLength(1);
    expect(db.account).toHaveLength(0);
  });

  it("does not issue a session if an account creation hook removes the Telegram account", async () => {
    const { db, post } = setup({
      databaseHooks: {
        account: {
          create: {
            after: async (account: any, ctx: any) => {
              await ctx.context.internalAdapter.deleteAccount(account.id);
            },
          },
        },
      },
    });
    const response = await post("/telegram/signin", widget());

    expect(response.status).toBe(401);
    expect(db.account).toHaveLength(0);
    expect(db.session).toHaveLength(0);
  });

  it("does not authenticate or update Telegram fields when an account hook rejects linking", async () => {
    const { db, post } = setup({
      databaseHooks: {
        account: {
          create: {
            before: async (account: any) => account.providerId !== "telegram",
          },
        },
      },
    });
    const signup = await post("/sign-up/email", {
      email: "local@example.com",
      name: "Local",
      password: "secret-pass-123",
    });
    const response = await post(
      "/telegram/miniapp/link",
      { initData: miniApp() },
      cookies(signup)
    );
    expect(response.status).toBe(400);
    expect(db.account).toHaveLength(1);
    expect(db.user[0].telegramId).toBeUndefined();
  });
  it("honors user validation on creation, sign-in and linking, including thrown errors", async () => {
    const validateUserInfo = vi.fn().mockImplementation(({ source }) => {
      if (source.oauth?.providerId === "telegram") {
        return {
          error: "telegram_denied",
          errorDescription: "Telegram denied by application policy",
        };
      }
    });
    const { db, post } = setup({ user: { validateUserInfo } });
    const rejected = await post("/telegram/signin", widget());
    expect(rejected.status).toBe(403);
    expect(db.user).toHaveLength(0);
    expect(validateUserInfo.mock.calls[0]![0].source.action).toBe(
      "create-user"
    );
    const signup = await post("/sign-up/email", {
      email: "local@example.com",
      name: "Local",
      password: "secret-pass-123",
    });
    const linked = await post(
      "/telegram/miniapp/link",
      { initData: miniApp() },
      cookies(signup)
    );
    expect(linked.status).toBe(403);
    expect(db.account).toHaveLength(1);
    validateUserInfo.mockReturnValue(undefined);
    const accepted = await post("/telegram/signin", widget());
    expect(accepted.status).toBe(200);
    validateUserInfo.mockImplementation(() => {
      throw new Error("Policy service unavailable");
    });
    const signin = await post("/telegram/miniapp/signin", {
      initData: miniApp(),
    });
    expect(signin.status).toBe(403);
    expect((await signin.json()).code).toBe("validation_failed");
  });
  it("protects unlinking with session freshness", async () => {
    const { db, post } = setup({
      account: { accountLinking: { allowUnlinkingAll: true } },
      session: { freshAge: 60 },
    });
    const signin = await post("/telegram/signin", widget());
    db.session[0].createdAt = new Date(Date.now() - 120_000);
    expect((await post("/telegram/unlink", {}, cookies(signin))).status).toBe(
      403
    );
    expect(db.account).toHaveLength(1);
  });
  it("rejects account linking with a revoked session kept in the cookie cache", async () => {
    const { db, post } = setup({
      session: { cookieCache: { enabled: true, maxAge: 300 } },
    });
    const signup = await post("/sign-up/email", {
      email: "revoked@example.com",
      name: "Revoked",
      password: "secret-pass-123",
    });
    const cookie = cookies(signup);
    const revoked = await post(
      "/revoke-session",
      { token: db.session[0]!.token },
      cookie
    );
    expect(revoked.status).toBe(200);
    expect(db.session).toHaveLength(0);

    const link = await post("/telegram/link", widget(), cookie);
    expect(link.status).toBe(401);
    expect(db.account).toHaveLength(1);
    expect(db.user[0]!.telegramId).toBeUndefined();
  });
  it("creates complete users, runs hooks, sets cookies and reuses identity across Widget and Mini App", async () => {
    const { db, post, afterCreate } = setup();
    const response = await post("/telegram/signin", widget());
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.user.email).toBe("42@telegram.invalid");
    expect(first.user.emailVerified).toBe(false);
    expect(db.user[0].createdAt).toBeInstanceOf(Date);
    expect(db.account[0].createdAt).toBeInstanceOf(Date);
    expect(afterCreate).toHaveBeenCalledOnce();
    expect(cookies(response)).toContain("session_token");
    const second = await post("/telegram/miniapp/signin", {
      initData: miniApp(),
    });
    expect(second.status).toBe(200);
    expect((await second.json()).user.id).toBe(first.user.id);
    expect(db.user).toHaveLength(1);
    expect(db.account).toHaveLength(1);
  });
  it("links Mini App to an existing email user and unlinks while preserving their other login", async () => {
    const { db, post } = setup();
    const signup = await post("/sign-up/email", {
      email: "local@example.com",
      name: "Local",
      password: "secret-pass-123",
    });
    expect(signup.status).toBe(200);
    const cookie = cookies(signup);
    const link = await post(
      "/telegram/miniapp/link",
      { initData: miniApp() },
      cookie
    );
    expect(link.status).toBe(200);
    expect(db.account).toHaveLength(2);
    const signin = await post("/telegram/signin", widget());
    expect((await signin.json()).user.id).toBe(db.user[0].id);
    const unlink = await post("/telegram/miniapp/unlink", {}, cookie);
    expect(unlink.status).toBe(200);
    expect(db.account).toHaveLength(1);
    expect(db.user[0].telegramId).toBeNull();
  });
  it("rejects unauthenticated links and blocks the last-account unlink", async () => {
    const { post } = setup();
    expect(
      (await post("/telegram/miniapp/link", { initData: miniApp() })).status
    ).toBe(401);
    const signin = await post("/telegram/signin", widget());
    const unlink = await post("/telegram/unlink", {}, cookies(signin));
    expect(unlink.status).toBe(400);
    expect((await unlink.json()).code).toBe("LAST_ACCOUNT");
  });
  it("honors both plugin linking policy and Better Auth linking policy", async () => {
    for (const options of [
      { extra: {}, plugin: { allowUserToLink: false } },
      {
        extra: { account: { accountLinking: { enabled: false } } },
        plugin: {},
      },
    ]) {
      const { post } = setup(options.extra, options.plugin);
      // biome-ignore lint/performance/noAwaitInLoops: Each policy fixture has an independent database.
      const signup = await post("/sign-up/email", {
        email: "local@example.com",
        name: "Local",
        password: "secret-pass-123",
      });
      expect(
        (
          await post(
            "/telegram/miniapp/link",
            { initData: miniApp() },
            cookies(signup)
          )
        ).status
      ).toBe(403);
    }
  });
  it("prevents reassignment to another user and a second Telegram identity on one user", async () => {
    const { db, post } = setup();
    const alice = await post("/telegram/signin", widget(42));
    const bob = await post("/telegram/signin", widget(43));
    expect(
      (
        await post(
          "/telegram/miniapp/link",
          { initData: miniApp(42) },
          cookies(bob)
        )
      ).status
    ).toBe(409);
    expect(
      (
        await post(
          "/telegram/miniapp/link",
          { initData: miniApp(44) },
          cookies(alice)
        )
      ).status
    ).toBe(409);
    expect(db.account).toHaveLength(2);
  });
  it("rejects invalid bodies and forged payloads before creating users", async () => {
    const { db, post } = setup();
    expect((await post("/telegram/miniapp/signin", {})).status).toBe(400);
    expect(
      (
        await post("/telegram/miniapp/signin", {
          initData: "auth_date=NaN&hash=deadbeef",
        })
      ).status
    ).toBe(401);
    expect(
      (await post("/telegram/signin", { ...widget(), hash: "0".repeat(64) }))
        .status
    ).toBe(401);
    expect(db.user).toHaveLength(0);
  });
  it("Mini App-only installs can link and unlink", async () => {
    const { post } = setup({}, { loginWidget: false });
    expect((await post("/telegram/signin", widget())).status).toBe(404);
    const signup = await post("/sign-up/email", {
      email: "local@example.com",
      name: "Local",
      password: "secret-pass-123",
    });
    expect(
      (
        await post(
          "/telegram/miniapp/link",
          { initData: miniApp() },
          cookies(signup)
        )
      ).status
    ).toBe(200);
    expect(
      (await post("/telegram/miniapp/unlink", {}, cookies(signup))).status
    ).toBe(200);
  });
  it("validate reports malformed signed user data as invalid", async () => {
    const { post } = setup();
    const response = await post("/telegram/miniapp/validate", {
      initData: miniApp(42, { user: "null" }),
    });
    expect(await response.json()).toEqual({ data: null, valid: false });
  });
});
