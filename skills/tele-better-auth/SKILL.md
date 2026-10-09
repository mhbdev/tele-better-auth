---
name: tele-better-auth
description: Integrate Telegram sign-in and account linking into Better Auth projects using tele-better-auth. Use for Telegram OIDC, Generic OAuth, Telegram Login JS, legacy Login Widget, or Mini App initData; includes popup behavior and schema migration guidance.
license: MIT
metadata:
  author: mhbdev
  version: "1.7.0"
---

# Integrate Telegram with Better Auth

Use the developer's existing auth setup and chosen framework. Inspect the installed Better Auth version, auth handler, database adapter, server plugins, client plugins, session UI, and account-linking policy before editing. This package requires Better Auth 1.7.7+. Preserve other login methods and project conventions.

## Choose the integration

- New web login: Telegram OIDC authorization code flow, with PKCE and server-managed state and nonce.
- Existing Generic OAuth setup: `telegramOAuth()` inside `genericOAuth({ config: [...] })`. Do not also enable the Telegram plugin's OIDC provider with the same provider ID.
- Telegram's current JS login library: prepare `initTelegramLogin()` before a click, open it with `openTelegramLogin()`, submit its `id_token` through the server-backed helper.
- Existing iframe Login Widget: HMAC flow via `signInWithTelegram()` or `linkTelegram()`.
- Inside Telegram Mini Apps: submit raw `Telegram.WebApp.initData`; never authenticate `initDataUnsafe`.

Widget and Mini App share provider `telegram`. OIDC and Generic OAuth share `telegram-oidc`. OIDC `sub` is a different identifier from Telegram's numeric `id`. Explicitly link to the signed-in local user to connect these identities; never merge by mutable username, phone, or placeholder email.

## Server and client setup

```ts
import { betterAuth } from "better-auth";
import { telegram } from "tele-better-auth";

const auth = betterAuth({
  // Retain the project's database, secret, baseURL, route handler, and other plugins.
  plugins: [telegram({
    loginWidget: false,
    oidc: {
      enabled: true,
      clientId: process.env.TELEGRAM_OIDC_CLIENT_ID!,
      clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
    },
  })],
});
```

The OIDC client secret is a separate Web Login secret from BotFather, not the bot token. Register the exact callback `<auth-baseURL>/callback/telegram-oidc` and application origin in BotFather. An OIDC-only installation needs no bot token, bot username, or additional Telegram columns.

```ts
import { createAuthClient } from "better-auth/client"; // Or the project's React/Vue/Svelte client.
import { telegramClient } from "tele-better-auth/client";
const authClient = createAuthClient({ plugins: [telegramClient()] });
```

Only import the `/client` entry on the browser side. Never expose the bot token or OIDC secret in public environment variables, client bundles, logs, or config responses.

For Generic OAuth use `genericOAuth` from `better-auth/plugins/generic-oauth` and `telegramOAuth` from `tele-better-auth`:

```ts
const plugins = [genericOAuth({ config: [telegramOAuth({
  clientId: process.env.TELEGRAM_OIDC_CLIENT_ID!,
  clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
})] })];
```

Both OIDC integrations use the core social routes in Better Auth 1.7. Use `signIn.social({ provider: "telegram-oidc" })`, `linkSocial`, or the package's OIDC helpers.

## Linking policy

Telegram supplies no email. The OIDC placeholder `{sub}@telegram.oidc` is unverified. For explicit linking to an existing user with another email, the application must intentionally configure:

```ts
account: { accountLinking: {
  enabled: true,
  trustedProviders: ["telegram-oidc"],
  disableImplicitLinking: true,
  allowDifferentEmails: true,
} }
```

Preserve existing trusted providers. Describe the effect of these choices to the developer; do not silently broaden their existing policy. Respect a request that disables linking. Plugin `allowUserToLink: false` blocks its linking helpers; global `accountLinking.enabled: false` is respected too.

For Widget/Mini App add `botToken` on the server, `botUsername` for Widget, and `miniApp: { enabled: true }` for Mini Apps. Regenerate the auth schema with the project's Better Auth CLI and database migration workflow. These flows add server-owned user fields `telegramId`, `telegramUsername`, `telegramPhoneNumber` and account fields `telegramId`, `telegramUsername`.

## Browser behavior

- OIDC sign-in: `signInWithTelegramOIDC({ callbackURL, flow: "redirect" | "popup" })`.
- OIDC linking: `linkTelegramOIDC({ callbackURL, flow, scopes })`.
- JS token sign-in/link: `signInWithTelegramOIDCIdToken(idToken)` / `linkTelegramOIDCIdToken(idToken)`.
- Widget sign-in/link: `signInWithTelegram(authData)` / `linkTelegram(authData)`.
- Mini App sign-in/link: `signInWithMiniApp(initData)` / `linkMiniApp(initData)`.

Call popup helpers directly from the user's click. They reserve one window synchronously and use `disableRedirect: true`; do not manually open another window or navigate the opener. Handle both returned `{ error }` and thrown popup/network failures. The promise reports authorization initiation, not authentication completion.

Implement the developer's completion page if popup completion is needed. It may close the popup and signal the opener using `postMessage`; validate exact origins and expected message contents, then refresh the session. Configure an error completion page too. A browser can choose a tab instead of a window.

Prepare `initTelegramLogin()` before a click. `openTelegramLogin()` uses the prepared SDK. `authWithTelegramLogin()` is a one-shot convenience; preparation avoids waiting for script/config requests during the click. The SDK has one global active login configuration. Its cross-window communication requires compatible COOP headers, such as `same-origin-allow-popups`.

Legacy Widget initialization returns a disposer. Call it on component unmount and use `destroyTelegramWidget()` when necessary. Preserve repeatable callback behavior. `telegramClient({ scriptNonce, scriptTimeoutMs })` supports CSP and bounded loading. Custom buttons should be native buttons with labels, visible focus, a busy state, and accessible error/status feedback.

Client-provided nonce equality is not a server-issued single-use replay challenge. Prefer the OIDC code flow when replay binding matters. Mini App and Widget HMAC payloads can be replayed during `maxAuthAge`; choose a suitable interval without disabling verification.

## Verify the integration

Run the host project's type checks and relevant tests. Test sign-in, linking to a signed-in user, unauthenticated rejection, identity conflicts, and unlinking. Widget/Mini App unlink uses `unlinkTelegram()` or `unlinkMiniApp()`; OIDC uses core `unlinkAccount({ accountId })` with the local row ID. Last-account unlink is blocked unless the application explicitly allows it.

Test popup clicks with the actual Better Auth client and its redirect hooks, including blocked popups, request failures, completion, and main-tab URL stability. Verify the exact BotFather callback registration in a credential-backed environment when credentials are available. Do not claim a live Telegram end-to-end test from mocked provider responses.

Read the maintained [README](https://github.com/mhbdev/tele-better-auth#readme), [API reference](https://github.com/mhbdev/tele-better-auth/blob/main/docs/api-reference.md), and [security notes](https://github.com/mhbdev/tele-better-auth/blob/main/docs/security.md) for detailed configuration. Official protocol documentation: [Telegram Login](https://core.telegram.org/bots/telegram-login), [Mini Apps](https://core.telegram.org/bots/webapps), and [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth).
