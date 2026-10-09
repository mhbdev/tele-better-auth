import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { createConfigEndpoint } from "./config-endpoint";
import { ERROR_CODES, PLUGIN_ID } from "./constants";
import {
  createMiniAppEndpoints,
  getMiniAppRateLimits,
} from "./miniapp-endpoints";
import { createTelegramOIDCProvider } from "./oidc";
import { createPluginConfig } from "./plugin-config";
import { createTelegramSchema } from "./schema";
import type { TelegramPluginOptions } from "./types";
import { createWidgetEndpoints, getWidgetRateLimits } from "./widget-endpoints";

// biome-ignore lint/performance/noBarrelFile: Public API re-export
export { createTelegramOIDCProvider, telegramOAuth } from "./oidc";
export type { TelegramPluginConfig } from "./plugin-config";
export type {
  TelegramAccountRecord,
  TelegramAuthData,
  TelegramMiniAppChat,
  TelegramMiniAppData,
  TelegramMiniAppUser,
  TelegramOIDCClaims,
  TelegramOIDCOptions,
  TelegramPluginOptions,
} from "./types";

/**
 * Telegram authentication plugin for Better Auth
 *
 * @example
 * ```ts
 * import { betterAuth } from "better-auth";
 * import { telegram } from "tele-better-auth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     telegram({
 *       botToken: process.env.TELEGRAM_BOT_TOKEN!,
 *       botUsername: "your_bot_username"
 *     })
 *   ]
 * });
 * ```
 */
export const telegram = (options: TelegramPluginOptions) => {
  const config = createPluginConfig(options);

  return {
    hooks: {
      before: [
        {
          handler: createAuthMiddleware(() => {
            if (!config.allowUserToLink) {
              throw APIError.from("FORBIDDEN", ERROR_CODES.LINKING_DISABLED);
            }
            return Promise.resolve();
          }),
          matcher: (ctx) =>
            ctx.path === "/link-social" &&
            ctx.body?.provider === "telegram-oidc",
        },
      ],
    },
    id: PLUGIN_ID,

    // Inject OIDC provider into better-auth's social providers
    ...(config.oidcEnabled
      ? {
          init: (ctx) => ({
            context: {
              socialProviders: [
                createTelegramOIDCProvider(config.botToken, {
                  ...config.oidc!,
                  disableSignUp:
                    config.oidc?.disableSignUp ?? !config.autoCreateUser,
                }),
                ...ctx.socialProviders,
              ],
            },
          }),
        }
      : {}),

    $ERROR_CODES: ERROR_CODES,

    endpoints: {
      ...(config.widgetEnabled ? createWidgetEndpoints(config) : {}),
      ...(config.miniAppEnabled ? createMiniAppEndpoints(config) : {}),
      ...createConfigEndpoint(config),
    },

    rateLimit: [
      ...(config.widgetEnabled ? getWidgetRateLimits() : []),
      ...(config.miniAppEnabled ? getMiniAppRateLimits() : []),
    ],

    schema: createTelegramSchema(config),
  } satisfies BetterAuthPlugin;
};

declare module "@better-auth/core" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    telegram: {
      creator: typeof telegram;
    };
  }
}
