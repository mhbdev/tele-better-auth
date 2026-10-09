/**
 * Data returned by Telegram Login Widget
 */
export interface TelegramAuthData {
  auth_date: number;
  first_name: string;
  hash: string;
  id: number;
  last_name?: string;
  photo_url?: string;
  username?: string;
}

/**
 * User object from Telegram Mini Apps
 */
export interface TelegramMiniAppUser {
  allows_write_to_pm?: boolean;
  first_name: string;
  id: number;
  is_bot?: boolean;
  is_premium?: boolean;
  language_code?: string;
  last_name?: string;
  photo_url?: string;
  username?: string;
}

/**
 * Chat object from Telegram Mini Apps
 */
export interface TelegramMiniAppChat {
  id: number;
  photo_url?: string;
  title?: string;
  type: string;
  username?: string;
}

/**
 * Complete data from Telegram Mini Apps initData
 */
export interface TelegramMiniAppData {
  auth_date: number;
  can_send_after?: number;
  chat?: TelegramMiniAppChat;
  chat_instance?: string;
  chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
  hash: string;
  query_id?: string;
  receiver?: TelegramMiniAppUser;
  start_param?: string;
  user?: TelegramMiniAppUser;
}

/**
 * JWT ID token claims from Telegram OIDC
 */
export interface TelegramOIDCClaims {
  aud: string;
  exp: number;
  iat: number;
  id?: number;
  iss: string;
  name?: string;
  nonce?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  picture?: string;
  preferred_username?: string;
  sub: string;
}

/**
 * Configuration options for Telegram OIDC authentication
 */
export interface TelegramOIDCOptions {
  /** Allowed token signing algorithms. Must match BotFather configuration. */
  algorithms?: ("RS256" | "ES256" | "EdDSA")[];
  /**
   * Client ID from @BotFather's Web Login settings.
   * If omitted, extracted from the main botToken (first part before colon).
   * Use this when your OIDC bot is different from your Login Widget bot.
   */
  clientId?: string;

  /**
   * Client Secret from @BotFather's Web Login settings.
   * This is NOT your bot token — BotFather provides a separate secret
   * when you configure Web Login under Bot Settings > Web Login.
   *
   * Required when OIDC is enabled. The bot token is never used as a fallback.
   */
  clientSecret?: string;
  /** Require explicit signup intent for new OIDC users. */
  disableImplicitSignUp?: boolean;
  /** Disable new OIDC users, while allowing existing accounts to sign in. */
  disableSignUp?: boolean;

  /**
   * Enable Telegram OIDC support
   * @default false
   */
  enabled?: boolean;

  /**
   * Custom function to map OIDC claims to user object
   */
  mapOIDCProfileToUser?: (claims: TelegramOIDCClaims) => {
    name?: string;
    email?: string;
    image?: string;
    [key: string]: any;
  };

  /**
   * Request bot access (adds "telegram:bot_access" scope)
   * @default false
   */
  requestBotAccess?: boolean;

  /**
   * Request phone number (adds "phone" scope)
   * @default false
   */
  requestPhone?: boolean;

  /**
   * Additional scopes beyond "openid"
   * @default ["profile"]
   */
  scopes?: string[];
}

/**
 * Configuration options for the Telegram plugin
 */
export interface TelegramPluginOptions {
  /**
   * Allow users to link their Telegram account to existing account
   * @default true
   */
  allowUserToLink?: boolean;

  /**
   * Automatically create user if doesn't exist
   * @default true
   */
  autoCreateUser?: boolean;
  /**
   * Bot token obtained from @BotFather
   * Used for verifying authentication data
   */
  botToken?: string;

  /**
   * Bot username (without @)
   * Used for generating the login widget
   */
  botUsername?: string;

  /**
   * Enable Login Widget endpoints (signin, link, unlink).
   * When false, Widget endpoints are not registered and Telegram-specific
   * user/account schema fields are omitted (unless Mini App is enabled).
   * @default true
   */
  loginWidget?: boolean;

  /**
   * Custom function to map Telegram data to user object
   */
  mapTelegramDataToUser?: (data: TelegramAuthData) => {
    name?: string;
    email?: string;
    image?: string;
    [key: string]: any;
  };

  /**
   * Maximum age of auth_date in seconds
   * Bounds replay exposure; accepted payloads are not single-use.
   * @default 86400 (24 hours)
   */
  maxAuthAge?: number;

  /**
   * Telegram Mini Apps configuration
   */
  miniApp?: {
    /**
     * Enable Telegram Mini Apps support
     * @default false
     */
    enabled?: boolean;

    /**
     * Validate initData from Mini Apps. Disabling verification is unsupported.
     * @deprecated Authentication always verifies initData.
     * @default true
     */
    validateInitData?: boolean;

    /**
     * Allow automatic sign-in from Mini Apps
     * @default true
     */
    allowAutoSignin?: boolean;

    /**
     * Custom function to map Mini App user data to user object
     */
    mapMiniAppDataToUser?: (data: TelegramMiniAppUser) => {
      name?: string;
      email?: string;
      image?: string;
      [key: string]: any;
    };
  };

  /**
   * Telegram OIDC (OpenID Connect) configuration
   * Uses standard OAuth 2.0 Authorization Code flow with PKCE
   * via oauth.telegram.org
   */
  oidc?: TelegramOIDCOptions;

  /**
   * Legacy informational flag. Does not change Telegram's SDK host.
   * Use the appropriate bot token for Telegram's test environment.
   * Note: OIDC (oauth.telegram.org) has no documented test variant;
   * a warning is logged if both testMode and oidc are enabled.
   * @default false
   */
  testMode?: boolean;
}

/**
 * Additional fields to add to the user table
 */
export interface TelegramUserFields {
  telegramId?: string;
  telegramPhoneNumber?: string;
  telegramUsername?: string;
}

/**
 * Additional fields to add to the account table
 */
export interface TelegramAccountFields {
  telegramId: string;
  telegramUsername?: string;
}

/**
 * Account record as returned by the Better Auth adapter
 */
export interface TelegramAccountRecord {
  accountId: string;
  id: string;
  providerId: string;
  telegramId?: string;
  telegramUsername?: string;
  userId: string;
}
