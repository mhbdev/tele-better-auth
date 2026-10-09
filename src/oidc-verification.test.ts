/** @vitest-environment node */

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { genericOAuth } from "better-auth/plugins";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { TELEGRAM_OIDC_ISSUER } from "./constants";
import { telegram } from "./index";
import { buildScopes, createTelegramOIDCProvider, telegramOAuth } from "./oidc";

const credentials = { clientId: "123456789", clientSecret: "oidc-secret" };
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
const fetchMock = vi.fn();
beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  jwk = {
    ...(await exportJWK(keys.publicKey)),
    alg: "RS256",
    kid: "key-1",
    use: "sig",
  };
});
beforeEach(() => {
  fetchMock
    .mockReset()
    .mockImplementation(async () => Response.json({ keys: [jwk] }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function provider(extra = {}) {
  return createTelegramOIDCProvider("123456789:bot", {
    ...credentials,
    ...extra,
  });
}
function token(
  claims: Record<string, unknown> = {},
  signingKey = keys.privateKey
) {
  return new SignJWT({ id: 42, name: "Alice", sub: "subject-42", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "key-1" })
    .setIssuer(TELEGRAM_OIDC_ISSUER)
    .setAudience(credentials.clientId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(signingKey);
}

describe("OIDC verification and mapping", () => {
  it.each([false, true])(
    "supports real social sign-in, link and unlink with genericOAuth=%s",
    async (generic) => {
      const db: {
        user: any[];
        account: any[];
        session: any[];
        verification: any[];
      } = { account: [], session: [], user: [], verification: [] };
      fetchMock.mockImplementation((input) => {
        const url = String(input);
        if (url.includes("openid-configuration")) {
          return Promise.resolve(
            Response.json({
              authorization_endpoint: `${TELEGRAM_OIDC_ISSUER}/auth`,
              id_token_signing_alg_values_supported: ["RS256"],
              issuer: TELEGRAM_OIDC_ISSUER,
              jwks_uri: `${TELEGRAM_OIDC_ISSUER}/.well-known/jwks.json`,
              token_endpoint: `${TELEGRAM_OIDC_ISSUER}/token`,
            })
          );
        }
        return Promise.resolve(Response.json({ keys: [jwk] }));
      });
      const auth = betterAuth({
        account: {
          accountLinking: {
            allowDifferentEmails: true,
            disableImplicitLinking: true,
            enabled: true,
            trustedProviders: ["telegram-oidc"],
          },
        },
        baseURL: "https://app.test",
        database: memoryAdapter(db),
        emailAndPassword: { enabled: true },
        plugins: [
          generic
            ? genericOAuth({ config: [telegramOAuth(credentials)] })
            : telegram({
                loginWidget: false,
                oidc: { ...credentials, enabled: true },
              }),
        ],
        secret: "a-reliable-secret-with-at-least-32-characters",
      });
      const post = (path: string, body: unknown, sessionCookie = "") =>
        auth.handler(
          new Request(`https://app.test/api/auth${path}`, {
            body: JSON.stringify(body),
            headers: {
              "Content-Type": "application/json",
              cookie: sessionCookie,
              Origin: "https://app.test",
            },
            method: "POST",
          })
        );
      const signup = await post("/sign-up/email", {
        email: "alice@example.com",
        name: "Alice",
        password: "secret-pass-123",
      });
      const cookie = signup.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const jwt = await token();
      const linked = await post(
        "/link-social",
        { idToken: { token: jwt }, provider: "telegram-oidc" },
        cookie
      );
      expect(linked.status, await linked.clone().text()).toBe(200);
      expect(db.account).toHaveLength(2);
      const account = db.account.find(
        (item) => item.providerId === "telegram-oidc"
      )!;
      expect(account.accountId).toBe("subject-42");
      const signin = await post("/sign-in/social", {
        idToken: { token: jwt },
        provider: "telegram-oidc",
      });
      expect(signin.status).toBe(200);
      expect((await signin.json()).user.id).toBe(db.user[0].id);
      const unlinked = await post(
        "/unlink-account",
        { accountId: account.id },
        cookie
      );
      expect(unlinked.status).toBe(200);
      expect(db.account).toHaveLength(1);
      expect(
        (
          await post("/sign-in/social", {
            idToken: { token: "forged" },
            provider: "telegram-oidc",
          })
        ).status
      ).toBe(401);
    }
  );
  it("enforces plugin policy on social linking", async () => {
    const auth = betterAuth({
      baseURL: "https://app.test",
      plugins: [
        telegram({
          allowUserToLink: false,
          loginWidget: false,
          oidc: { ...credentials, enabled: true },
        }),
      ],
      secret: "a-reliable-secret-with-at-least-32-characters",
    });
    const response = await auth.handler(
      new Request("https://app.test/api/auth/link-social", {
        body: JSON.stringify({ provider: "telegram-oidc" }),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.test",
        },
        method: "POST",
      })
    );
    expect(response.status).toBe(403);
  });
  it("requires the separate Web Login secret", () => {
    expect(() => createTelegramOIDCProvider("123:bot")).toThrow("clientSecret");
  });
  it("validates a real signature and caches the JWKS across calls", async () => {
    const p = provider();
    const jwt = await token();
    expect(await verifyProviderIdToken(p, jwt)).toBe(true);
    const info = await p.getUserInfo({ idToken: jwt });
    expect(info?.user).toMatchObject({
      email: "subject-42@telegram.oidc",
      emailVerified: false,
      name: "Alice",
    });
    expect(await p.accountSubject({ profile: info!.data, tokens: {} })).toBe(
      "subject-42"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects forged signatures in both direct and code-callback profiles", async () => {
    const other = await generateKeyPair("RS256");
    const jwt = await token({}, other.privateKey);
    const p = provider();
    expect(await verifyProviderIdToken(p, jwt)).toBe(false);
    expect(await p.getUserInfo({ idToken: jwt })).toBeNull();
  });
  it("rejects a wrong nonce and binds callback profiles to server state", async () => {
    const jwt = await token({ nonce: "server-nonce" });
    const p = provider();
    expect(await verifyProviderIdToken(p, jwt, "wrong")).toBe(false);
    expect(await verifyProviderIdToken(p, jwt, "server-nonce")).toBe(true);
    expect(
      await p.getUserInfo({ expectedIdTokenNonce: "wrong", idToken: jwt })
    ).toBeNull();
  });
  it.each([
    "issuer",
    "audience",
    "expired",
    "missing-exp",
    "missing-sub",
    "future-iat",
    "algorithm",
  ])("rejects %s", async (kind) => {
    let jwt = new SignJWT({ sub: kind === "missing-sub" ? undefined : "42" })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer(
        kind === "issuer" ? "https://attacker.invalid" : TELEGRAM_OIDC_ISSUER
      )
      .setAudience(kind === "audience" ? "wrong" : credentials.clientId)
      .setIssuedAt(
        kind === "future-iat" ? Math.floor(Date.now() / 1000) + 300 : undefined
      );
    if (kind !== "missing-exp") {
      jwt = jwt.setExpirationTime(kind === "expired" ? "-1h" : "1h");
    }
    const p = provider(kind === "algorithm" ? { algorithms: ["ES256"] } : {});
    expect(
      await verifyProviderIdToken(p, await jwt.sign(keys.privateKey))
    ).toBe(false);
  });
  it("fails closed on unavailable keys and malformed tokens", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const p = provider();
    expect(await verifyProviderIdToken(p, await token())).toBe(false);
    expect(await p.getUserInfo({ idToken: "not-a-jwt" })).toBeNull();
    expect(await p.getUserInfo({})).toBeNull();
  });
  it("mapping cannot redefine the subject or mark placeholder emails verified", async () => {
    const p = provider({
      mapOIDCProfileToUser: () => ({
        emailVerified: true,
        id: "attacker",
        name: "Custom",
      }),
    });
    const info = await p.getUserInfo({ idToken: await token() });
    expect(info?.user.emailVerified).toBe(false);
    expect(await p.accountSubject({ profile: info!.data, tokens: {} })).toBe(
      "subject-42"
    );
  });
  it("uses a usable display name when profile scope is absent", async () => {
    const info = await provider().getUserInfo({
      idToken: await token({ name: undefined }),
    });
    expect(info?.user.name).toBe("Telegram subject-42");
  });
  it("builds PKCE authorization with state, nonce and unique scopes", async () => {
    const url = await provider().createAuthorizationURL({
      codeVerifier: "a".repeat(64),
      idTokenNonce: "nonce",
      redirectURI: "https://app.test/api/auth/callback/telegram-oidc",
      scopes: ["profile"],
      state: "state",
    });
    expect(url.searchParams.get("state")).toBe("state");
    expect(url.searchParams.get("nonce")).toBe("nonce");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("openid profile");
  });
  it("exchanges codes using Basic authentication and the code verifier", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ access_token: "at", expires_in: 3600, id_token: "it" })
    );
    const tokens = await provider().validateAuthorizationCode({
      code: "code",
      codeVerifier: "verifier",
      redirectURI: "https://app.test/callback",
    });
    expect(tokens?.idToken).toBe("it");
    const request = fetchMock.mock.calls[0]!;
    const headers = new Headers(request[1].headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("123456789:oidc-secret").toString("base64")}`
    );
    expect(request[1].body.get("code_verifier")).toBe("verifier");
  });
  it("supports Generic OAuth with discovery, verified subjects and Basic authentication", async () => {
    const config = telegramOAuth(credentials);
    expect(config).toMatchObject({
      authentication: "basic",
      pkce: true,
      providerId: "telegram-oidc",
      requireIdTokenVerification: true,
    });
    const info = await config.getUserInfo!({ idToken: await token() });
    expect(info?.sub).toBe("subject-42");
    expect(await config.getUserInfo!({ idToken: "forged" })).toBeNull();
  });
  it("constructs configurable scopes", () => {
    expect(buildScopes({})).toEqual(["openid", "profile"]);
    expect(
      buildScopes({ requestBotAccess: true, requestPhone: true, scopes: [] })
    ).toEqual(["openid", "phone", "telegram:bot_access"]);
  });
});
