import type { GenericEndpointContext } from "@better-auth/core";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  freshSessionMiddleware,
  sensitiveSessionMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import { ERROR_CODES } from "./constants";
import {
  linkTelegramIdentity,
  signInTelegramIdentity,
  unlinkTelegramIdentity,
} from "./identity";
import type { TelegramPluginConfig } from "./plugin-config";
import type {
  TelegramMiniAppData,
  TelegramMiniAppVerificationResult,
} from "./types";
import {
  parseMiniAppInitData,
  validateMiniAppData,
  validateMiniAppInitDataPayload,
  verifyMiniAppInitData,
} from "./verify";

async function verifiedData(
  body: Record<string, unknown> | undefined,
  config: TelegramPluginConfig,
  ctx: GenericEndpointContext
) {
  const initData = body?.initData;
  if (!initData || typeof initData !== "string") {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.INIT_DATA_REQUIRED);
  }

  if (config.verifyMiniAppInitData) {
    if (!validateMiniAppInitDataPayload(initData, config.maxAuthAge)) {
      return null;
    }
    const extraFields = Object.fromEntries(
      Object.entries(body ?? {}).filter(([key]) => key !== "initData")
    );
    const result = await config.verifyMiniAppInitData(
      initData,
      ctx,
      extraFields
    );
    if (result === false || result === null || result === undefined) {
      return null;
    }

    const parsed = parseMiniAppInitData(initData);
    if (!validateMiniAppData(parsed)) {
      return null;
    }
    if (isMiniAppData(result)) {
      if (
        !validateMiniAppData(result) ||
        result.auth_date !== parsed.auth_date ||
        result.hash !== parsed.hash ||
        result.user?.id !== parsed.user?.id
      ) {
        return null;
      }
      return result;
    }

    if (
      !parsed.user ||
      result.id !== parsed.user.id ||
      !validateMiniAppData({ ...parsed, user: result })
    ) {
      return null;
    }
    return { ...parsed, user: result };
  }

  if (
    !(await verifyMiniAppInitData(initData, config.botToken, config.maxAuthAge))
  ) {
    return null;
  }
  return parseMiniAppInitData(initData);
}

function isMiniAppData(
  result: TelegramMiniAppVerificationResult
): result is TelegramMiniAppData {
  return typeof result === "object" && result !== null && "auth_date" in result;
}

async function verifiedUser(
  body: Record<string, unknown> | undefined,
  config: TelegramPluginConfig,
  ctx: GenericEndpointContext
) {
  const data = await verifiedData(body, config, ctx);
  if (!data) {
    throw APIError.from("UNAUTHORIZED", ERROR_CODES.INVALID_MINI_APP_INIT_DATA);
  }
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
        use: [sessionMiddleware, sensitiveSessionMiddleware],
      },
      async (ctx) => {
        const user = await verifiedUser(await ctx.body, config, ctx);
        return linkTelegramIdentity(ctx, config, user);
      }
    ),
    signInWithMiniApp: createAuthEndpoint(
      "/telegram/miniapp/signin",
      {
        method: "POST",
        // Validate browser origin even for first sign-in without cookies.
        use: [formCsrfMiddleware],
      },
      async (ctx) => {
        const user = await verifiedUser(await ctx.body, config, ctx);
        return signInTelegramIdentity(
          ctx,
          config,
          user,
          await config.mapMiniAppDataToUser?.(user),
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
        use: [
          sessionMiddleware,
          sensitiveSessionMiddleware,
          freshSessionMiddleware,
        ],
      },
      unlinkTelegramIdentity
    ),
    validateMiniApp: createAuthEndpoint(
      "/telegram/miniapp/validate",
      { method: "POST" },
      async (ctx) => {
        const body = await ctx.body;
        const initData = body?.initData;
        if (!initData || typeof initData !== "string") {
          throw APIError.from("BAD_REQUEST", ERROR_CODES.INIT_DATA_REQUIRED);
        }
        const data = await verifiedData(body, config, ctx);
        if (!data) {
          return ctx.json({ data: null, valid: false });
        }
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
