import type { BetterAuthPlugin } from "better-auth";
import type { TelegramPluginConfig } from "./plugin-config";

/**
 * Creates the conditional Telegram schema extension.
 *
 * Adds `telegramId`, `telegramUsername`, `telegramPhoneNumber` to the `user` table
 * and `telegramId`, `telegramUsername` to the `account` table — but only when
 * Login Widget or Mini App flows are enabled. OIDC-only setups skip these fields.
 */
export function createTelegramSchema(
  config: TelegramPluginConfig
): BetterAuthPlugin["schema"] {
  if (!(config.widgetEnabled || config.miniAppEnabled)) {
    return undefined;
  }

  return {
    account: {
      fields: {
        telegramId: {
          required: false,
          type: "string",
          unique: false,
        },
        telegramUsername: {
          required: false,
          type: "string",
          unique: false,
        },
      },
    },
    user: {
      fields: {
        telegramId: {
          input: false,
          required: false,
          type: "string",
          unique: false,
        },
        telegramPhoneNumber: {
          input: false,
          required: false,
          type: "string",
          unique: false,
        },
        telegramUsername: {
          input: false,
          required: false,
          type: "string",
          unique: false,
        },
      },
    },
  };
}
