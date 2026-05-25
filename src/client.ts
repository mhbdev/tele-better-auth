import type { BetterAuthClientPlugin } from "better-auth/client";
import type { telegram } from "./index";
import type { TelegramAuthData, TelegramOIDCClaims } from "./types";

type TelegramPlugin = typeof telegram;

/**
 * Options that can be passed to fetch calls for customization
 * (e.g., custom headers, cache control, credentials)
 */
type FetchOptions = Record<string, any>;

/**
 * Legacy Telegram Login Widget script URL
 * (iframe-based widget documented in /widgets/login-legacy)
 */
const TELEGRAM_WIDGET_SCRIPT = "https://telegram.org/js/telegram-widget.js?22";

/**
 * New Telegram Login library script URL
 * (documented in /bots/telegram-login)
 */
const TELEGRAM_LOGIN_SCRIPT = "https://telegram.org/js/telegram-login.js";

type TelegramLoginRequestAccess = "phone" | "write";

const DEFAULT_OIDC_POPUP_HEIGHT = 720;
const DEFAULT_OIDC_POPUP_NAME = "telegram-oidc-login";
const DEFAULT_OIDC_POPUP_WIDTH = 520;

/**
 * Style variants supported by telegram-login.js buttons.
 * "rounded" is the default style.
 */
export type TelegramLoginButtonStyle =
  | "rounded"
  | "square"
  | "outlined"
  | "icon"
  | "shine";

/**
 * Success payload returned by Telegram Login library callbacks.
 */
export interface TelegramLoginAuthSuccess {
  id_token: string;
  user: TelegramOIDCClaims & Record<string, any>;
}

/**
 * Error payload returned by Telegram Login library callbacks.
 */
export interface TelegramLoginAuthError {
  error: string;
}

/**
 * Result payload returned by Telegram Login library callbacks.
 */
export type TelegramLoginAuthResult =
  | TelegramLoginAuthSuccess
  | TelegramLoginAuthError;

/**
 * Options for Telegram.Login.init/auth methods.
 */
export interface TelegramLoginOptions {
  /**
   * Telegram Client ID from @BotFather.
   * If omitted, fetched from /telegram/config (oidcClientId).
   */
  clientId?: number | string;

  /**
   * UI language code (e.g. "en", "es", "fa").
   */
  lang?: string;

  /**
   * Optional nonce for replay protection.
   */
  nonce?: string;

  /**
   * Requested scopes for login library popup.
   * "write" maps to "telegram:bot_access" in OIDC scopes.
   */
  requestAccess?: TelegramLoginRequestAccess | TelegramLoginRequestAccess[];
}

/**
 * Options for rendering a Telegram login button using telegram-login.js.
 */
export interface TelegramLoginButtonOptions extends TelegramLoginOptions {
  /**
   * Accessible label for the button.
   * @default "Log in with Telegram"
   */
  ariaLabel?: string;

  /**
   * Extra class names to add to the generated button.
   */
  className?: string;
  /**
   * Button styles from Telegram login library.
   * "rounded" is default and can be combined with "shine".
   */
  style?: TelegramLoginButtonStyle | TelegramLoginButtonStyle[];

  /**
   * Button text
   * @default "Log in with Telegram"
   */
  text?: string;
}

/**
 * Options for the legacy Telegram Login Widget
 * (iframe-based data-telegram-login integration)
 */
export interface TelegramWidgetOptions {
  /**
   * Corner radius of the button
   * @default 20
   */
  cornerRadius?: number;

  /**
   * Language code (e.g., "en", "pl")
   */
  lang?: string;

  /**
   * Request write access permission
   * @default false
   */
  requestAccess?: boolean;

  /**
   * Whether to show user photo
   * @default true
   */
  showUserPhoto?: boolean;
  /**
   * Size of the login button
   * @default "large"
   */
  size?: "large" | "medium" | "small";
}

interface TelegramConfigResponse {
  botUsername: string;
  loginWidgetEnabled: boolean;
  miniAppEnabled: boolean;
  oidcClientId: string;
  oidcEnabled: boolean;
  testMode: boolean;
}

interface TelegramIdTokenSignInOptions {
  accessToken?: string;
  callbackURL?: string;
  disableRedirect?: boolean;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
  nonce?: string;
  refreshToken?: string;
  requestSignUp?: boolean;
}

/**
 * OIDC authorization flow mode.
 * - redirect: navigate the current tab (default behavior)
 * - popup: open Telegram OAuth in a popup window
 */
export type TelegramOIDCFlow = "popup" | "redirect";

/**
 * Popup behavior for OIDC sign-in flow.
 */
export interface TelegramOIDCPopupOptions {
  /**
   * Full window features string passed to window.open.
   * If provided, width/height/top/left are ignored.
   */
  features?: string;

  /**
   * Popup height in pixels.
   * @default 720
   */
  height?: number;

  /**
   * Left offset in pixels.
   * By default, the popup is horizontally centered.
   */
  left?: number;

  /**
   * Popup window name/target.
   * @default "telegram-oidc-login"
   */
  name?: string;

  /**
   * Top offset in pixels.
   * By default, the popup is vertically centered.
   */
  top?: number;

  /**
   * Popup width in pixels.
   * @default 520
   */
  width?: number;
}

/**
 * Options for Telegram OIDC redirect/popup sign-in.
 */
export interface TelegramOIDCSignInOptions {
  /**
   * URL to redirect after authentication.
   */
  callbackURL?: string;

  /**
   * URL to redirect if authentication fails.
   */
  errorCallbackURL?: string;

  /**
   * OAuth flow mode.
   * @default "redirect"
   */
  flow?: TelegramOIDCFlow;

  /**
   * Popup options, used when flow is "popup".
   */
  popup?: TelegramOIDCPopupOptions;
}

interface OAuthRedirectResponse {
  redirect?: boolean;
  url?: string;
}

interface TelegramLoginInitOptions {
  client_id: number;
  lang?: string;
  nonce?: string;
  request_access?: TelegramLoginRequestAccess[];
}

interface TelegramLoginApi {
  auth: (
    options: TelegramLoginInitOptions,
    callback?: (result: TelegramLoginAuthResult) => void
  ) => void;
  close: () => void;
  init: (
    options: TelegramLoginInitOptions,
    callback?: (result: TelegramLoginAuthResult) => void
  ) => void;
  open: (callback?: (result: TelegramLoginAuthResult) => void) => void;
}

type WidgetContainer = HTMLElement;

function normalizeRequestAccess(
  requestAccess?: TelegramLoginRequestAccess | TelegramLoginRequestAccess[]
): TelegramLoginRequestAccess[] | undefined {
  if (!requestAccess) {
    return undefined;
  }

  const scopes = Array.isArray(requestAccess) ? requestAccess : [requestAccess];
  return Array.from(new Set(scopes));
}

function normalizeButtonStyles(
  style?: TelegramLoginButtonStyle | TelegramLoginButtonStyle[]
): Exclude<TelegramLoginButtonStyle, "rounded">[] {
  if (!style) {
    return [];
  }

  const styles = Array.isArray(style) ? style : [style];
  return Array.from(
    new Set(
      styles.filter(
        (value): value is Exclude<TelegramLoginButtonStyle, "rounded"> =>
          value !== "rounded"
      )
    )
  );
}

function loadScript(
  scriptUrl: string,
  errorMessage: string,
  isLoaded: () => boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isLoaded()) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error(errorMessage)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(errorMessage));
    document.head.appendChild(script);
  });
}

/**
 * Helper to load legacy Telegram Widget script.
 */
function loadTelegramWidgetScript(): Promise<void> {
  return loadScript(
    TELEGRAM_WIDGET_SCRIPT,
    "Failed to load Telegram widget script",
    () => typeof (window as any).Telegram?.Login !== "undefined"
  );
}

function isTelegramLoginLibraryLoaded() {
  const login = (window as any).Telegram?.Login as TelegramLoginApi | undefined;
  return (
    typeof login?.init === "function" &&
    typeof login.open === "function" &&
    typeof login.auth === "function" &&
    typeof login.close === "function"
  );
}

/**
 * Helper to load new Telegram login library script.
 */
function loadTelegramLoginScript(): Promise<void> {
  return loadScript(
    TELEGRAM_LOGIN_SCRIPT,
    "Failed to load Telegram login script",
    isTelegramLoginLibraryLoaded
  );
}

function getTelegramLoginApi(): TelegramLoginApi {
  const login = (window as any).Telegram?.Login as TelegramLoginApi | undefined;

  if (!(login && isTelegramLoginLibraryLoaded())) {
    throw new Error("Telegram login library is not initialized");
  }

  return login;
}

function buildTelegramLoginInitOptions(
  clientId: string | number,
  options: TelegramLoginOptions = {}
): TelegramLoginInitOptions {
  const numericClientId =
    typeof clientId === "number" ? clientId : Number(clientId);

  if (!Number.isFinite(numericClientId)) {
    throw new Error("Telegram clientId must be a valid number");
  }

  const initOptions: TelegramLoginInitOptions = {
    client_id: numericClientId,
  };

  const requestAccess = normalizeRequestAccess(options.requestAccess);
  if (requestAccess && requestAccess.length > 0) {
    initOptions.request_access = requestAccess;
  }

  if (options.lang) {
    initOptions.lang = options.lang;
  }

  if (options.nonce) {
    initOptions.nonce = options.nonce;
  }

  return initOptions;
}

function resolveTelegramLoginClientId(
  config: TelegramConfigResponse,
  options?: TelegramLoginOptions
) {
  return options?.clientId ?? config.oidcClientId;
}

function getContainerOrThrow(containerId: string): WidgetContainer {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container with id "${containerId}" not found`);
  }
  return container;
}

function buildOIDCPopupFeatures(
  popupOptions?: TelegramOIDCPopupOptions
): string {
  if (popupOptions?.features) {
    return popupOptions.features;
  }

  const width = popupOptions?.width ?? DEFAULT_OIDC_POPUP_WIDTH;
  const height = popupOptions?.height ?? DEFAULT_OIDC_POPUP_HEIGHT;
  const left =
    popupOptions?.left ??
    Math.max(window.screenX + (window.outerWidth - width) / 2, 0);
  const top =
    popupOptions?.top ??
    Math.max(window.screenY + (window.outerHeight - height) / 2, 0);

  return [
    "popup=yes",
    `width=${Math.round(width)}`,
    `height=${Math.round(height)}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    "noopener=yes",
  ].join(",");
}

function openOIDCPopup(url: string, popupOptions?: TelegramOIDCPopupOptions) {
  if (typeof window === "undefined") {
    throw new Error("Telegram OIDC popup flow can only be used in browser");
  }

  const popupName = popupOptions?.name ?? DEFAULT_OIDC_POPUP_NAME;
  const popupWindow = window.open(
    url,
    popupName,
    buildOIDCPopupFeatures(popupOptions)
  );

  if (popupWindow) {
    popupWindow.focus();
    return;
  }

  // Popup blocked: gracefully fall back to same-tab navigation.
  window.location.assign(url);
}

/**
 * Client plugin for Telegram authentication
 */
export const telegramClient = () => {
  return {
    id: "telegram",
    $InferServerPlugin: {} as ReturnType<TelegramPlugin>,

    getActions: ($fetch) => {
      const fetchTelegramConfig = async (fetchOptions?: FetchOptions) => {
        const configResponse = await $fetch<TelegramConfigResponse>(
          "/telegram/config",
          {
            method: "GET",
            ...fetchOptions,
          }
        );

        if (!configResponse.data) {
          throw new Error("Failed to get Telegram config");
        }

        return configResponse.data;
      };

      const initTelegramLoginInternal = async (
        options: TelegramLoginOptions = {},
        onAuth?: (result: TelegramLoginAuthResult) => void
      ) => {
        await loadTelegramLoginScript();
        const config = await fetchTelegramConfig();
        const clientId = resolveTelegramLoginClientId(config, options);
        const loginApi = getTelegramLoginApi();
        loginApi.init(buildTelegramLoginInitOptions(clientId, options), onAuth);
      };

      return {
        /**
         * Sign in with Telegram
         * @param authData - Authentication data from Telegram Login Widget
         * @param fetchOptions - Optional fetch options (e.g., custom headers, cache control)
         */
        signInWithTelegram: async (
          authData: TelegramAuthData,
          fetchOptions?: FetchOptions
        ) => {
          const response = await $fetch("/telegram/signin", {
            method: "POST",
            body: authData,
            ...fetchOptions,
          });

          return response;
        },

        /**
         * Link current user account with Telegram
         * @param authData - Authentication data from Telegram Login Widget
         * @param fetchOptions - Optional fetch options (e.g., custom headers, cache control)
         */
        linkTelegram: async (
          authData: TelegramAuthData,
          fetchOptions?: FetchOptions
        ) => {
          const response = await $fetch("/telegram/link", {
            method: "POST",
            body: authData,
            ...fetchOptions,
          });

          return response;
        },

        /**
         * Unlink Telegram account from current user
         * @param fetchOptions - Optional fetch options (e.g., custom headers, cache control)
         */
        unlinkTelegram: async (fetchOptions?: FetchOptions) => {
          const response = await $fetch("/telegram/unlink", {
            method: "POST",
            ...fetchOptions,
          });

          return response;
        },

        /**
         * Get Telegram bot/login configuration
         * @param fetchOptions - Optional fetch options (e.g., custom headers, cache control)
         */
        getTelegramConfig: async (fetchOptions?: FetchOptions) => {
          const response = await $fetch<TelegramConfigResponse>(
            "/telegram/config",
            {
              method: "GET",
              ...fetchOptions,
            }
          );

          return response;
        },

        /**
         * Initialize Telegram Login Widget (legacy iframe widget).
         * This function creates the legacy Telegram login button and handles callback flow.
         *
         * @param containerId - ID of the container element where the widget will be rendered
         * @param options - Widget configuration options
         * @param onAuth - Callback function called when user successfully authenticates
         */
        initTelegramWidget: async (
          containerId: string,
          options: TelegramWidgetOptions = {},
          onAuth: (authData: TelegramAuthData) => void | Promise<void>
        ) => {
          await loadTelegramWidgetScript();
          const config = await fetchTelegramConfig();

          const {
            size = "large",
            showUserPhoto = true,
            cornerRadius = 20,
            requestAccess = false,
            lang,
          } = options;

          const container = getContainerOrThrow(containerId);
          container.innerHTML = "";

          const callbackName = `telegramCallback_${Date.now()}`;
          (window as any)[callbackName] = (authData: TelegramAuthData) => {
            onAuth(authData);
            delete (window as any)[callbackName];
          };

          const script = document.createElement("script");
          script.src = TELEGRAM_WIDGET_SCRIPT;
          script.async = true;
          script.setAttribute("data-telegram-login", config.botUsername);
          script.setAttribute("data-size", size);
          script.setAttribute("data-userpic", showUserPhoto.toString());
          script.setAttribute("data-radius", cornerRadius.toString());
          script.setAttribute("data-onauth", `${callbackName}(user)`);

          if (requestAccess) {
            script.setAttribute("data-request-access", "write");
          }

          if (lang) {
            script.setAttribute("data-lang", lang);
          }

          container.appendChild(script);
        },

        /**
         * Initialize legacy Telegram Login Widget with redirect flow.
         *
         * @param containerId - ID of the container element where the widget will be rendered
         * @param redirectUrl - URL to redirect after successful authentication
         * @param options - Widget configuration options
         */
        initTelegramWidgetRedirect: async (
          containerId: string,
          redirectUrl: string,
          options: TelegramWidgetOptions = {}
        ) => {
          await loadTelegramWidgetScript();
          const config = await fetchTelegramConfig();

          const {
            size = "large",
            showUserPhoto = true,
            cornerRadius = 20,
            requestAccess = false,
            lang,
          } = options;

          const container = getContainerOrThrow(containerId);
          container.innerHTML = "";

          const script = document.createElement("script");
          script.src = TELEGRAM_WIDGET_SCRIPT;
          script.async = true;
          script.setAttribute("data-telegram-login", config.botUsername);
          script.setAttribute("data-size", size);
          script.setAttribute("data-userpic", showUserPhoto.toString());
          script.setAttribute("data-radius", cornerRadius.toString());
          script.setAttribute("data-auth-url", redirectUrl);

          if (requestAccess) {
            script.setAttribute("data-request-access", "write");
          }

          if (lang) {
            script.setAttribute("data-lang", lang);
          }

          container.appendChild(script);
        },

        /**
         * Initialize the new Telegram Login JS API (telegram-login.js).
         * Call this once, then trigger popup with openTelegramLogin().
         */
        initTelegramLogin: async (
          options: TelegramLoginOptions = {},
          onAuth?: (result: TelegramLoginAuthResult) => void
        ) => {
          await initTelegramLoginInternal(options, onAuth);
        },

        /**
         * Open the Telegram Login popup with previously initialized options.
         */
        openTelegramLogin: async (
          onAuth?: (result: TelegramLoginAuthResult) => void
        ) => {
          await loadTelegramLoginScript();
          const loginApi = getTelegramLoginApi();
          loginApi.open(onAuth);
        },

        /**
         * One-shot login popup call with explicit options (Telegram.Login.auth).
         */
        authWithTelegramLogin: async (
          options: TelegramLoginOptions = {},
          onAuth?: (result: TelegramLoginAuthResult) => void
        ) => {
          await loadTelegramLoginScript();
          const config = await fetchTelegramConfig();
          const clientId = resolveTelegramLoginClientId(config, options);
          const loginApi = getTelegramLoginApi();
          loginApi.auth(
            buildTelegramLoginInitOptions(clientId, options),
            onAuth
          );
        },

        /**
         * Render a Telegram login button compatible with telegram-login.js.
         * The button uses Telegram's expected `.tg-auth-button` class.
         */
        renderTelegramLoginButton: async (
          containerId: string,
          options: TelegramLoginButtonOptions = {},
          onAuth?: (result: TelegramLoginAuthResult) => void
        ) => {
          const container = getContainerOrThrow(containerId);
          container.innerHTML = "";

          const button = document.createElement("button");
          button.type = "button";
          button.className = options.className
            ? `tg-auth-button ${options.className}`
            : "tg-auth-button";
          button.textContent = options.text || "Log in with Telegram";
          button.setAttribute(
            "aria-label",
            options.ariaLabel || "Log in with Telegram"
          );

          const styleTokens = normalizeButtonStyles(options.style);
          if (styleTokens.length > 0) {
            button.setAttribute("data-style", styleTokens.join(" "));
          }

          container.appendChild(button);

          await initTelegramLoginInternal(options, onAuth);
        },

        /**
         * Close the Telegram Login popup and remove active message listeners.
         */
        closeTelegramLogin: async () => {
          await loadTelegramLoginScript();
          const loginApi = getTelegramLoginApi();
          loginApi.close();
        },

        /**
         * Sign in to Better Auth using an ID token from telegram-login.js callback.
         * Requires `oidc.enabled: true` and Telegram OIDC provider setup on the server.
         */
        signInWithTelegramOIDCIdToken: async (
          idToken: string,
          options?: TelegramIdTokenSignInOptions,
          fetchOptions?: FetchOptions
        ) => {
          return await $fetch("/sign-in/social", {
            method: "POST",
            body: {
              provider: "telegram-oidc",
              callbackURL: options?.callbackURL,
              errorCallbackURL: options?.errorCallbackURL,
              newUserCallbackURL: options?.newUserCallbackURL,
              disableRedirect: options?.disableRedirect,
              requestSignUp: options?.requestSignUp,
              idToken: {
                token: idToken,
                nonce: options?.nonce,
                accessToken: options?.accessToken,
                refreshToken: options?.refreshToken,
              },
            },
            ...fetchOptions,
          });
        },

        /**
         * Sign in with Telegram Mini App
         * @param initData - Raw initData string from Telegram.WebApp.initData
         */
        signInWithMiniApp: async (
          initData: string,
          fetchOptions?: FetchOptions
        ) => {
          const response = await $fetch("/telegram/miniapp/signin", {
            method: "POST",
            body: { initData },
            ...fetchOptions,
          });

          return response;
        },

        /**
         * Validate Telegram Mini App initData
         * @param initData - Raw initData string from Telegram.WebApp.initData
         * @returns Object with valid status and parsed data if valid
         */
        validateMiniApp: async (
          initData: string,
          fetchOptions?: FetchOptions
        ) => {
          const response = await $fetch<{
            data: any;
            valid: boolean;
          }>("/telegram/miniapp/validate", {
            method: "POST",
            body: { initData },
            ...fetchOptions,
          });

          return response;
        },

        /**
         * Auto sign-in from Telegram Mini App
         * Automatically retrieves initData from Telegram.WebApp and signs in
         * Only works when running inside a Telegram Mini App
         */
        autoSignInFromMiniApp: async (fetchOptions?: FetchOptions) => {
          if (typeof window === "undefined") {
            throw new Error("This method can only be called in browser");
          }

          const Telegram = (window as any).Telegram;
          if (!Telegram?.WebApp?.initData) {
            throw new Error(
              "Not running in Telegram Mini App or initData not available"
            );
          }

          const initData = Telegram.WebApp.initData;
          return await $fetch("/telegram/miniapp/signin", {
            method: "POST",
            body: { initData },
            ...fetchOptions,
          });
        },

        /**
         * Sign in with Telegram OIDC (OpenID Connect)
         * Initiates the standard OAuth 2.0 Authorization Code flow with PKCE
         * via oauth.telegram.org. Requires `oidc.enabled: true` on the server.
         *
         * @param options - Callback URLs for redirect after authentication
         * @param fetchOptions - Optional fetch options
         */
        signInWithTelegramOIDC: async (
          options?: TelegramOIDCSignInOptions,
          fetchOptions?: FetchOptions
        ) => {
          const flow = options?.flow ?? "redirect";
          const usePopup = flow === "popup";

          const response = await $fetch<OAuthRedirectResponse>(
            "/sign-in/social",
            {
              method: "POST",
              body: {
                provider: "telegram-oidc",
                callbackURL: options?.callbackURL,
                errorCallbackURL: options?.errorCallbackURL,
                disableRedirect: usePopup ? true : undefined,
              },
              ...fetchOptions,
            }
          );

          if (usePopup && response?.data?.url) {
            openOIDCPopup(response.data.url, options?.popup);
          }

          return response;
        },
      };
    },
  } satisfies BetterAuthClientPlugin;
};

export default telegramClient;
