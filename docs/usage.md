# Usage

## Login Widget

Mount a container and dispose the widget when your component unmounts:

```ts
const dispose = await authClient.initTelegramWidget(
  "telegram-widget",
  { size: "large", lang: "en", requestAccess: false },
  async (data) => {
    const result = await authClient.signInWithTelegram(data);
    if (result.error) showError(result.error.message);
  },
);
// On unmount:
dispose();
```

For account linking, pass the same signed Widget payload to `authClient.linkTelegram(data)` while signed in. Use `authClient.unlinkTelegram()` to remove it. The Widget and Mini App use a shared `telegram` account keyed by numeric Telegram ID.

`initTelegramWidgetRedirect(containerId, redirectUrl, options)` creates the legacy redirect widget. Its URL receives authentication parameters, which your server must validate before setting a session. Rendering this widget alone does not implement your redirect handler.

## OIDC social login and linking

Enable `telegram({ loginWidget: false, oidc: { enabled: true, clientId, clientSecret } })` on the server. Register the callback URL in BotFather.

```ts
await authClient.signInWithTelegramOIDC({
  callbackURL: "/dashboard",
  errorCallbackURL: "/login-error",
});
await authClient.linkTelegramOIDC({ callbackURL: "/settings/accounts" });
```

These call Better Auth's `/sign-in/social` and `/link-social`. OIDC unlinking uses Better Auth's `unlinkAccount` with the local account record's ID. Configure [account linking policy](./configuration.md#account-policy) before linking.

For popup flow, call the action directly from a user click:

```ts
button.addEventListener("click", async () => {
  try {
    const result = await authClient.signInWithTelegramOIDC({
      flow: "popup",
      callbackURL: "/auth/telegram-complete",
      errorCallbackURL: "/auth/telegram-error",
      popup: { width: 520, height: 720 },
    });
    if (result.error) showError(result.error.message);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unable to open Telegram");
  }
});
```

The returned authorization response indicates that authorization started, not that a session has been created. Complete it in the callback page: notify the opener using `postMessage` with an exact origin and then close the popup. The opener must check both origin and message shape before refreshing its session. Use a distinct message for the error callback; never post ID tokens or access tokens. See the complete example in the [README](../README.md).

Popup blockers cause an explicit error. The package does not navigate the main page as a fallback. Keep `Cross-Origin-Opener-Policy` compatible with popup communication; Telegram recommends `same-origin-allow-popups`.

## Telegram Login JavaScript library

The current `telegram-login.js` library returns an OIDC ID token. It is distinct from the legacy signed Widget payload.

```ts
await authClient.initTelegramLogin({ requestAccess: ["profile"] }, async (result) => {
  if ("error" in result) return showError(result.error);
  const response = await authClient.signInWithTelegramOIDCIdToken(result.id_token);
  if (response.error) showError(response.error.message);
});
// Call from a click after initialization finishes:
await authClient.openTelegramLogin();
```

For linking, use `linkTelegramOIDCIdToken`. `renderTelegramLoginButton` prepares the library and returns a native button with keyboard behavior and an accessible label. Initialize before the click to retain browser user activation. For standalone Generic OAuth, supply `clientId` explicitly so SDK initialization does not require the Telegram plugin's config route.

Direct ID-token login still requires server signature, issuer, audience and expiry verification. If you use an application nonce, make it unpredictable and associate it with the browser's authentication attempt; matching an arbitrary client-supplied nonce alone is not replay prevention. Prefer the authorization-code flow for Better Auth-managed state, PKCE and nonce.

## Generic OAuth alternative

```ts
import { genericOAuth } from "better-auth/plugins";
import { telegramOAuth } from "tele-better-auth";

plugins: [
  genericOAuth({
    config: [telegramOAuth({ clientId, clientSecret })],
  }),
],
```

In Better Auth 1.7, Generic OAuth providers use the same social routes. Use the Telegram client OIDC actions above or `signIn.social({ provider: "telegram-oidc" })` and `linkSocial({ provider: "telegram-oidc" })`. Install either the provider factory or the Telegram plugin's enabled OIDC integration for this provider ID, not both. You may separately enable the Telegram plugin's Widget/Mini App flows with OIDC disabled.

The helper requires discovery-based ID-token verification, PKCE, Basic client authentication and a separately verified profile. It never falls back to unsigned JWT decoding.

