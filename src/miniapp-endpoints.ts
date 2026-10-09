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
import {
  parseMiniAppInitData,
  validateMiniAppData,
  verifyMiniAppInitData,
} from "./verify";

async function verifiedData(
  body: { initData?: unknown } | undefined,
  config: TelegramPluginConfig
) {
  const initData = body?.initData;
  if (!initData || typeof initData !== "string") {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.INIT_DATA_REQUIRED);
  }
  if (
    !(await verifyMiniAppInitData(initData, config.botToken, config.maxAuthAge))
  ) {
    throw APIError.from("UNAUTHORIZED", ERROR_CODES.INVALID_MINI_APP_INIT_DATA);
  }
  const data = parseMiniAppInitData(initData);
  if (!validateMiniAppData(data)) {
    throw APIError.from(
      "BAD_REQUEST",
      ERROR_CODES.INVALID_MINI_APP_DATA_STRUCTURE
    );
  }
  if (!data.user) {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.NO_USER_IN_INIT_DATA);
  }
  return data.user;
}

/** Mini App authentication always verifies the raw initData on the server. */
export function createMiniAppEndpoints(config: TelegramPluginConfig) {
  return {
    linkMiniApp: createAuthEndpoint(
      "/telegram/miniapp/link",
      {
        method: "POST",
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const user = await verifiedData(await ctx.body, config);
        return linkTelegramIdentity(ctx, config, user);
      }
    ),
    signInWithMiniApp: createAuthEndpoint(
      "/telegram/miniapp/signin",
      { method: "POST" },
      async (ctx) => {
        const user = await verifiedData(await ctx.body, config);
        return signInTelegramIdentity(
          ctx,
          config,
          user,
          config.mapMiniAppDataToUser?.(user),
          config.miniAppAllowAutoSignin,
          ERROR_CODES.MINI_APP_AUTO_SIGNIN_DISABLED
        );
      }
    ),
    // Available in Mini App-only setups too. The shared provider is "telegram".
    unlinkMiniApp: createAuthEndpoint(
      "/telegram/miniapp/unlink",
      {
        method: "POST",
        use: [sessionMiddleware, freshSessionMiddleware],
      },
      unlinkTelegramIdentity
    ),
    validateMiniApp: createAuthEndpoint(
      "/telegram/miniapp/validate",
      { method: "POST" },
      async (ctx) => {
        const initData = (await ctx.body)?.initData;
        if (!initData || typeof initData !== "string") {
          throw APIError.from("BAD_REQUEST", ERROR_CODES.INIT_DATA_REQUIRED);
        }
        if (
          !(await verifyMiniAppInitData(
            initData,
            config.botToken,
            config.maxAuthAge
          ))
        ) {
          return ctx.json({ data: null, valid: false });
        }
        const data = parseMiniAppInitData(initData);
        return ctx.json(
          validateMiniAppData(data)
            ? { data, valid: true }
            : { data: null, valid: false }
        );
      }
    ),
  };
}

export function getMiniAppRateLimits() {
  return [
    {
      max: 10,
      pathMatcher: (path: string) => path === "/telegram/miniapp/signin",
      window: 60,
    },
    {
      max: 20,
      pathMatcher: (path: string) => path === "/telegram/miniapp/validate",
      window: 60,
    },
    {
      max: 5,
      pathMatcher: (path: string) =>
        path === "/telegram/miniapp/link" ||
        path === "/telegram/miniapp/unlink",
      window: 60,
    },
  ];
}
