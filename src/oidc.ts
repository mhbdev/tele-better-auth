import type { OAuthProvider } from "better-auth/oauth2";
import {
  createAuthorizationURL,
  validateAuthorizationCode,
} from "better-auth/oauth2";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import {
  TELEGRAM_OIDC_AUTH_ENDPOINT,
  TELEGRAM_OIDC_ISSUER,
  TELEGRAM_OIDC_JWKS_URI,
  TELEGRAM_OIDC_PROVIDER_ID,
  TELEGRAM_OIDC_TOKEN_ENDPOINT,
} from "./constants";
import type { TelegramOIDCClaims, TelegramOIDCOptions } from "./types";

/** Build Telegram scopes, always retaining the required openid scope. */
export function buildScopes(options: TelegramOIDCOptions): string[] {
  const scopes = new Set(["openid", ...(options.scopes ?? ["profile"])]);
  if (options.requestPhone) {
    scopes.add("phone");
  }
  if (options.requestBotAccess) {
    scopes.add("telegram:bot_access");
  }
  return [...scopes];
}

/**
 * Create a verified Telegram provider for Better Auth's social routes.
 * BotFather's Web Login client secret is separate from the bot token.
 */
export function createTelegramOIDCProvider(
  botToken: string,
  options: TelegramOIDCOptions = {}
): OAuthProvider<TelegramOIDCClaims> {
  const clientId = options.clientId || botToken.split(":")[0]!;
  if (!(clientId && options.clientSecret)) {
    throw new Error(
      "Telegram OIDC requires a client ID and the Web Login clientSecret from BotFather"
    );
  }
  const providerOptions = {
    clientId,
    clientSecret: options.clientSecret,
    disableImplicitSignUp: options.disableImplicitSignUp,
    disableSignUp: options.disableSignUp,
  };
  // jose caches keys, coalesces requests, and refreshes on key rotation with a cooldown.
  const jwks = createRemoteJWKSet(new URL(TELEGRAM_OIDC_JWKS_URI), {
    [customFetch]: (...args) => fetch(...args),
  });
  const verify = async (token: string, nonce?: string) => {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: options.algorithms ?? ["RS256"],
      audience: clientId,
      issuer: TELEGRAM_OIDC_ISSUER,
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.iat !== "number" ||
      payload.iat > Math.floor(Date.now() / 1000) ||
      (nonce !== undefined && payload.nonce !== nonce)
    ) {
      throw new Error("Invalid Telegram ID token claims");
    }
    return payload as unknown as TelegramOIDCClaims;
  };
  return {
    accountSubject: ({ profile }) => profile.sub,
    createAuthorizationURL({
      state,
      codeVerifier,
      scopes,
      redirectURI,
      idTokenNonce,
    }) {
      return createAuthorizationURL({
        authorizationEndpoint: TELEGRAM_OIDC_AUTH_ENDPOINT,
        codeVerifier,
        id: TELEGRAM_OIDC_PROVIDER_ID,
        nonce: idTokenNonce,
        options: providerOptions,
        redirectURI,
        scopes: [...new Set([...buildScopes(options), ...(scopes ?? [])])],
        state,
      });
    },
    async getUserInfo(tokens) {
      if (!tokens.idToken) {
        return null;
      }
      let claims: TelegramOIDCClaims;
      try {
        claims = await verify(tokens.idToken, tokens.expectedIdTokenNonce);
      } catch {
        return null;
      }
      const mapped = options.mapOIDCProfileToUser?.(claims);
      return {
        data: claims,
        user: {
          image: claims.picture,
          name:
            claims.name ??
            claims.preferred_username ??
            `Telegram ${claims.sub}`,
          ...mapped,
          email: mapped?.email ?? `${claims.sub}@telegram.oidc`,
          // Identity cannot be replaced by mutable profile mapping.
          emailVerified: false,
        },
      };
    },
    id: TELEGRAM_OIDC_PROVIDER_ID,
    idToken: {
      verify: async (token, nonce) => {
        try {
          await verify(token, nonce);
          return true;
        } catch {
          return false;
        }
      },
    },
    name: "Telegram",
    options: providerOptions,
    requiresIdTokenNonce: true,
    validateAuthorizationCode({ code, codeVerifier, redirectURI }) {
      return validateAuthorizationCode({
        authentication: "basic",
        code,
        codeVerifier,
        options: providerOptions,
        redirectURI,
        tokenEndpoint: TELEGRAM_OIDC_TOKEN_ENDPOINT,
      });
    },
  };
}

/**
 * Alternate integration with Better Auth's genericOAuth plugin.
 * Use instead of enabling telegram({ oidc: { enabled: true } }).
 */
export function telegramOAuth(
  options: TelegramOIDCOptions & {
    clientId: string;
    clientSecret: string;
  }
): GenericOAuthConfig {
  const provider = createTelegramOIDCProvider("", options);
  return {
    accountSubject: ({ profile }) => String(profile.sub),
    authentication: "basic",
    authorizationUrl: TELEGRAM_OIDC_AUTH_ENDPOINT,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    disableImplicitSignUp: options.disableImplicitSignUp,
    disableSignUp: options.disableSignUp,
    discoveryUrl: `${TELEGRAM_OIDC_ISSUER}/.well-known/openid-configuration`,
    async getUserInfo(tokens) {
      const info = await provider.getUserInfo(tokens);
      return info ? { ...info.user, sub: info.data.sub } : null;
    },
    pkce: true,
    providerId: TELEGRAM_OIDC_PROVIDER_ID,
    requireIdTokenVerification: true,
    scopes: buildScopes(options),
    tokenUrl: TELEGRAM_OIDC_TOKEN_ENDPOINT,
  };
}
