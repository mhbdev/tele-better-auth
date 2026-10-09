import {
  APIError,
  createAuthEndpoint,
  freshSessionMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import { ERROR_CODES } from "./constants";
import {
  linkTelegramIdentity,
  signInTelegramIdentity,
  unlinkTelegramIdentity,
} from "./identity";
import type { TelegramPluginConfig } from "./plugin-config";
import { validateTelegramAuthData, verifyTelegramAuth } from "./verify";

/** Legacy Widget endpoints, all requiring server-side HMAC verification. */
export function createWidgetEndpoints(config: TelegramPluginConfig) {
  return {
    linkTelegram: createAuthEndpoint(
      "/telegram/link",
      {
        method: "POST",
        use: [sessionMiddleware],
      },
      async (ctx) => {
        if (!config.allowUserToLink) {
          throw APIError.from("FORBIDDEN", ERROR_CODES.LINKING_DISABLED);
        }
        const data = await ctx.body;
        if (!validateTelegramAuthData(data)) {
          throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_AUTH_DATA);
        }
        if (
          !(await verifyTelegramAuth(data, config.botToken, config.maxAuthAge))
        ) {
          throw APIError.from(
            "UNAUTHORIZED",
            ERROR_CODES.INVALID_AUTHENTICATION
          );
        }
        return linkTelegramIdentity(ctx, config, data);
      }
    ),
    signInWithTelegram: createAuthEndpoint(
      "/telegram/signin",
      { method: "POST" },
      async (ctx) => {
        const data = await ctx.body;
        if (!validateTelegramAuthData(data)) {
          throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_AUTH_DATA);
        }
        if (
          !(await verifyTelegramAuth(data, config.botToken, config.maxAuthAge))
        ) {
          throw APIError.from(
            "UNAUTHORIZED",
            ERROR_CODES.INVALID_AUTHENTICATION
          );
        }
        return signInTelegramIdentity(
          ctx,
          config,
          data,
          config.mapTelegramDataToUser?.(data),
          true,
          ERROR_CODES.USER_CREATION_DISABLED
        );
      }
    ),
    unlinkTelegram: createAuthEndpoint(
      "/telegram/unlink",
      {
        method: "POST",
        use: [sessionMiddleware, freshSessionMiddleware],
      },
      unlinkTelegramIdentity
    ),
  };
}

export function getWidgetRateLimits() {
  return [
    {
      max: 10,
      pathMatcher: (path: string) => path === "/telegram/signin",
      window: 60,
    },
    {
      max: 5,
      pathMatcher: (path: string) => path === "/telegram/link",
      window: 60,
    },
    {
      max: 5,
      pathMatcher: (path: string) => path === "/telegram/unlink",
      window: 60,
    },
  ];
}
