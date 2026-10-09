/** @vitest-environment node */
import { createHash, createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { telegram } from "./index";

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
function miniApp(id = 42, overrides = {}) {
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
      createHmac("sha256", "WebAppData").update(botToken).digest()
    )
      .update(check)
      .digest("hex")
  );
  return params.toString();
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
  const post = (path: string, body: unknown, cookie = "") =>
    auth.handler(
      new Request(`https://app.test/api/auth${path}`, {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          cookie,
          Origin: "https://app.test",
        },
        method: "POST",
      })
    );
  return { afterCreate, db, post };
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("real Better Auth endpoint integration", () => {
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
