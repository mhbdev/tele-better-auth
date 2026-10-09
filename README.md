# tele-better-auth

Telegram authentication and account linking for [Better Auth](https://www.better-auth.com/), maintained by [mhbdev](https://github.com/mhbdev).

[![npm](https://img.shields.io/npm/v/tele-better-auth)](https://www.npmjs.com/package/tele-better-auth)
[![CI](https://github.com/mhbdev/tele-better-auth/actions/workflows/ci.yml/badge.svg)](https://github.com/mhbdev/tele-better-auth/actions/workflows/ci.yml)

Use Telegram OIDC for new web integrations, the legacy Login Widget for existing HMAC integrations, or verified Mini App `initData` inside Telegram. Each supports sign-in and explicit account linking. The package includes a framework-independent client, TypeScript declarations, ESM and CommonJS builds, and an installable AI-agent skill.

## Requirements

- Better Auth **1.7.7 or later in the 1.x release line**.
- Node.js **22.12+**, or a compatible runtime with Web Crypto and Fetch. Repository tooling uses Node 22.18+, 24.11+, or 26+.
- A configured Better Auth database and mounted auth handler.
- Telegram credentials from [BotFather](https://t.me/BotFather). Keep all secrets on the server.

```sh
npm install better-auth tele-better-auth
```

## Choose a flow

| Flow | Server configuration | Sign in | Link an existing account |
| --- | --- | --- | --- |
| OIDC code flow | `telegram({ loginWidget: false, oidc: … })` | `signInWithTelegramOIDC()` | `linkTelegramOIDC()` |
| Telegram Login JS | Same OIDC configuration | `signInWithTelegramOIDCIdToken()` | `linkTelegramOIDCIdToken()` |
| Generic OAuth | `genericOAuth({ config: [telegramOAuth(…)] })` | `signIn.social()` or the OIDC helper | `linkSocial()` or the OIDC helper |
| Legacy Login Widget | `telegram({ botToken, botUsername })` | `signInWithTelegram()` | `linkTelegram()` |
| Mini App | `telegram({ loginWidget: false, botToken, miniApp: { enabled: true } })` | `signInWithMiniApp()` | `linkMiniApp()` |

Widget and Mini App identities share provider ID `telegram`. OIDC and Generic OAuth use `telegram-oidc`, with the immutable OIDC `sub` as the account subject. Telegram's numeric user `id` and OIDC `sub` are different identifiers; this package does not assume they match or merge accounts by username, phone, or placeholder email. To connect the flows to one application user, sign in to that user first and explicitly link the other method.

## OIDC setup

In BotFather's Web Login settings, register your application origin and exact callback URL:

```text
https://app.example.com/api/auth/callback/telegram-oidc
```

Use the **Web Login client ID and client secret**. The client secret is separate from your bot token. OIDC-only installations do not need a bot token or bot username and add no Telegram database columns.

```ts
// Server: auth.ts
import { betterAuth } from "better-auth";
import { telegram } from "tele-better-auth";

export const auth = betterAuth({
  // Add your database adapter, baseURL, and secret as usual.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["telegram-oidc"],
      disableImplicitLinking: true,
      allowDifferentEmails: true,
    },
  },
  plugins: [
    telegram({
      loginWidget: false,
      oidc: {
        enabled: true,
        clientId: process.env.TELEGRAM_OIDC_CLIENT_ID!,
        clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
      },
    }),
  ],
});
```

Telegram does not supply email. OIDC profiles receive an **unverified placeholder** `{sub}@telegram.oidc`. Better Auth requires a trusted provider to link an unverified-email identity. The settings above allow explicit linking to a user with a different email and disable implicit email-based merging. Review their effect on your other providers. Do not add placeholder-email domains to email-based account trust rules.

```ts
// Browser: auth-client.ts (React/Vue/Svelte clients work too)
import { createAuthClient } from "better-auth/client";
import { telegramClient } from "tele-better-auth/client";

export const authClient = createAuthClient({
  plugins: [telegramClient()],
});

await authClient.signInWithTelegramOIDC({ callbackURL: "/dashboard" });
await authClient.linkTelegramOIDC({ callbackURL: "/settings/accounts" });
```

### Popup mode

Call directly from a button click. The helper reserves one window before the request, sends `disableRedirect: true`, and navigates only that window. It preserves the response URL and caller fetch hooks. A blocked popup rejects with an actionable error and does not navigate the main tab.

```ts
button.addEventListener("click", async () => {
  try {
    const { error } = await authClient.signInWithTelegramOIDC({
      flow: "popup",
      callbackURL: "/auth/telegram-complete",
      errorCallbackURL: "/auth/telegram-error",
      popup: { width: 520, height: 720, name: "telegram-login" },
    });
    if (error) showError(error.message);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not open Telegram");
  }
});
```

The returned promise completes when authorization **starts**; it does not wait for the user to finish. Supply your own completion page. That page can close itself and notify the opener via `postMessage`. Validate the exact origin and expected message in the opener, then refresh `getSession()` and update your UI. Use an error completion page too. For frontends and backends on separate domains, the completion URL should be on the frontend and allowed by Better Auth's trusted-origin configuration.

For Telegram's `telegram-login.js` library, use `Cross-Origin-Opener-Policy: same-origin-allow-popups` where required; `same-origin` blocks its window communication. Browsers decide whether a requested popup appears as a window or tab. Dimensions and `features` are hints.

### Telegram Login JS and custom buttons

Prepare the library before the click so popup activation keeps the browser's user gesture:

```ts
await authClient.initTelegramLogin({
  clientId: "123456789",
  requestAccess: ["profile"],
}, async (result) => {
  if ("error" in result) return showError(result.error);
  const { error } = await authClient.signInWithTelegramOIDCIdToken(result.id_token);
  if (error) showError(error.message);
});

button.addEventListener("click", () => authClient.openTelegramLogin());
```

Use `linkTelegramOIDCIdToken()` instead for a signed-in user's account settings. The server verifies the token before trusting claims. `nonce` passed with a client-submitted token checks claim equality; it is not by itself a server-issued, single-use replay challenge. Prefer the code flow for server-managed state, PKCE, and nonce binding.

`renderTelegramLoginButton(containerId, options, callback)` returns a native button with accessible text, `aria-label`, and `type="button"`. Set `text`, `ariaLabel`, `className`, `lang`, and styles (`rounded`, `square`, `outlined`, `icon`, `shine`), or render your own button. The library uses one global `Telegram.Login` configuration; initialize one active login configuration per page.

### Generic OAuth alternative

Use this **instead of** enabling the plugin's OIDC provider. Registering both under `telegram-oidc` is ambiguous.

```ts
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { telegramOAuth } from "tele-better-auth";

const plugins = [
  genericOAuth({
    config: [telegramOAuth({
      clientId: process.env.TELEGRAM_OIDC_CLIENT_ID!,
      clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
    })],
  }),
];
```

Configure the same linking policy as above. The helper uses Telegram discovery, PKCE, Basic token-endpoint authentication, signed ID-token verification, and a custom profile reader because Telegram has no UserInfo endpoint. Better Auth 1.7 uses the core `/sign-in/social`, `/link-social`, and `/callback/telegram-oidc` routes for Generic OAuth too. Add `telegramClient()` for this package's popup and ID-token helpers; the standard `signIn.social` and `linkSocial` methods also work.

## Legacy Widget

Register the domain with BotFather's legacy Login Widget settings. Enable the plugin with `botToken` and `botUsername`, then regenerate your auth database schema.

```ts
const dispose = await authClient.initTelegramWidget(
  "telegram-widget",
  { size: "large", lang: "en", showUserPhoto: true },
  async (authData) => {
    const { error } = await authClient.signInWithTelegram(authData);
    if (error) showError(error.message);
  },
);
// When unmounting the component:
dispose();
```

For linking, send the widget callback data to `linkTelegram()`. The callback remains available for repeated authentication until disposal. Reinitialization disposes the old callback; `destroyTelegramWidget(containerId)` explicitly removes it. `initTelegramWidgetRedirect()` supports Telegram's legacy `data-auth-url` mode; your redirect handler must verify and submit the received data to the server. A redirect alone does not create a Better Auth session.

## Mini Apps

Enable `miniApp: { enabled: true }` on the server and regenerate the database schema. Use the raw SDK value, never `initDataUnsafe`:

```ts
const { error } = await authClient.signInWithMiniApp(window.Telegram.WebApp.initData);
const linked = await authClient.linkMiniApp(window.Telegram.WebApp.initData);
const validation = await authClient.validateMiniApp(window.Telegram.WebApp.initData);
```

`autoSignInFromMiniApp()` reads the raw `initData` for you. Mini App authentication and linking always verify HMAC and timestamp, even if an old internal config disables verification. Configuring `miniApp.validateInitData: false` now throws. `miniApp.allowAutoSignin: false` prevents creating new Mini App users; existing linked users can still sign in.

## Configuration and account controls

- `allowUserToLink` defaults to `true`; setting it to `false` blocks Widget, Mini App, and plugin-managed OIDC linking. Better Auth's global `accountLinking.enabled: false` also applies.
- `autoCreateUser` defaults to `true`; `false` rejects unregistered identities. OIDC also accepts `disableSignUp` and `disableImplicitSignUp`.
- `maxAuthAge` defaults to 86,400 seconds. Use a shorter interval for your use case. Invalid, expired, and future timestamps are rejected. Signed data can be reused during this interval; HMAC validation alone is not single-use replay protection.
- `mapTelegramDataToUser`, `miniApp.mapMiniAppDataToUser`, and `oidc.mapOIDCProfileToUser` customize mutable local profile fields. Placeholder emails are unverified, including after custom mapping. OIDC account identity always comes from verified `sub`.
- OIDC defaults to scopes `openid profile` and algorithm `RS256`. Set `scopes`, `requestPhone`, `requestBotAccess`, or `algorithms: ["ES256"]` to match BotFather. `EdDSA` is supported where the runtime supports Ed25519; Telegram restricts it to `openid`. `ES256K` is not supported by this Web Crypto implementation.
- `telegramClient({ scriptNonce, scriptTimeoutMs })` supports a CSP nonce and bounded script loading. Failed loads are removed for retry. Every network helper accepts typed fetch options for headers, credentials, cancellation, and hooks.

Unlink Widget/Mini App accounts with `unlinkTelegram()` or `unlinkMiniApp()`. Both remove provider `telegram`, clear its profile fields, and reject removal of the last account unless your app explicitly allows `accountLinking.allowUnlinkingAll`. Unlink OIDC with Better Auth's `unlinkAccount({ accountId })`, using the local account row ID from `listAccounts()`.

Use native buttons, visible focus styles, a disabled/busy state while starting authentication, and an accessible status/error region in your own UI. The package does not impose a component framework or stylesheet.

## Upgrading to 1.7

This minor release retains the client helpers and the two package export paths. It requires Better Auth 1.7.7 and includes deliberate security corrections: the invalid bot-token OIDC-secret fallback and unverified Mini App authentication are removed. Unlinking now protects the last account. OIDC providers use the current `idToken` and `accountSubject` API. Custom standalone provider integrations must use Better Auth's `verifyProviderIdToken()` instead of the removed provider `verifyIdToken` method.

See [migration and configuration](docs/configuration.md), [API reference](docs/api-reference.md), [security](docs/security.md), and [troubleshooting](docs/troubleshooting.md).

## AI-agent integration skill

```sh
npx skills add mhbdev/tele-better-auth --skill tele-better-auth
```

The [skill](skills/tele-better-auth/SKILL.md) helps agents select a flow, configure credentials and schema, implement sign-in and linking, and verify popup behavior. It follows the `SKILL.md` frontmatter convention used by [skills.sh](https://skills.sh/docs). `skills.sh.json` groups it on the repository page; it is not a runtime dependency or a claim of certification. A skills.sh pack is optional and can reference this skill.

## Development and releases

```sh
npm ci
npm run lint
npm run type-check
npm run build
npm run test:coverage
npm run check:package
```

CI runs on Node 22, 24, and 26 and enforces coverage thresholds. Tag releases as `v<package.json version>`. [release.yml](.github/workflows/release.yml) verifies and packs the build, publishes with npm trusted publishing and provenance in environment `npm-release`, and attaches the package to a GitHub release. No npm publishing token is used.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Security reports](https://github.com/mhbdev/tele-better-auth/security/advisories/new) · [MIT license](LICENSE)
