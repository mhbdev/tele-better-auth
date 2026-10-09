# Configuration

The exported TypeScript interfaces describe the complete API. Keep secrets in the server plugin.

## Server options

| Option | Default | Behavior |
| --- | --- | --- |
| `botToken` | none | Required for Widget/Mini App HMAC verification. |
| `botUsername` | none | Required when the Widget is enabled; omit `@`. |
| `loginWidget` | `true` | Register Widget sign-in, link and unlink endpoints. |
| `autoCreateUser` | `true` | Allow verified first-time sign-ins to create users; supplies the default OIDC signup policy. |
| `allowUserToLink` | `true` | Permit explicit Widget/Mini App linking and the plugin's `telegram-oidc` social linking. |
| `maxAuthAge` | `86400` | Maximum HMAC payload age in seconds; finite and nonnegative. Future timestamps are rejected. |
| `mapTelegramDataToUser` | name and image | Map verified Widget data when creating a user. |
| `miniApp.enabled` | `false` | Register Mini App sign-in, validate, link and unlink routes. |
| `miniApp.allowAutoSignin` | `true` | Allow Mini App user creation together with `autoCreateUser`. |
| `miniApp.mapMiniAppDataToUser` | name and image | Map verified Mini App user data when creating a user. |
| `miniApp.validateInitData` | `true` | Deprecated; `false` is rejected. Verification cannot be disabled. |
| `oidc.enabled` | `false` | Register the `telegram-oidc` social provider. |
| `oidc.clientId` | bot token's numeric prefix | Web Login client ID. Required explicitly for OIDC-only installs without a bot token. |
| `oidc.clientSecret` | none | Required, separate Web Login client secret. |
| `oidc.scopes` | `openid`, `profile` | Requested scopes; `openid` is always included. |
| `oidc.requestPhone` | `false` | Add `phone` scope. |
| `oidc.requestBotAccess` | `false` | Add `telegram:bot_access` scope. |
| `oidc.algorithms` | `["RS256"]` | Allowed JWT algorithms: RS256, ES256 or EdDSA. Match BotFather configuration. |
| `oidc.disableSignUp` | inverse of `autoCreateUser` | Override OIDC user creation policy. |
| `oidc.disableImplicitSignUp` | `false` | Require an explicit signup request for new OIDC users. |
| `oidc.mapOIDCProfileToUser` | name and picture | Map verified claims. Identity always uses `sub`; mapped email remains unverified. |
| `testMode` | `false` | Legacy informational configuration; does not switch Telegram's SDK or OIDC host. |

Telegram does not verify email addresses. Without a mapping, HMAC users receive an unverified `ID@telegram.invalid` address, and OIDC users receive an unverified `SUB@telegram.oidc` address. Collect and independently verify a real address before using it for email authentication or recovery.

OIDC phone claims are available to `mapOIDCProfileToUser`; they are not automatically written into the optional legacy `telegramPhoneNumber` field. Define additional user fields through Better Auth when using OIDC-only configuration.

## Account policy

For explicit social linking with Telegram's unverified email, Better Auth requires:

```ts
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ["telegram-oidc"],
    disableImplicitLinking: true,
    allowDifferentEmails: true,
  },
},
```

Better Auth requires a trusted provider for explicit linking when its email is unverified. Pair this with `disableImplicitLinking: true` to prevent automatic email-based account merging. Review the effect of disabling implicit linking on other providers in your application. Widget/Mini App links require a session and respect `enabled: false`. Unlinking requires a fresh session and preserves the last login method unless `allowUnlinkingAll` is explicitly enabled. Standalone `genericOAuth` uses Better Auth's policy; it has no Telegram plugin `allowUserToLink` setting.

## Browser options

```ts
telegramClient({ scriptNonce: cspNonce, scriptTimeoutMs: 15_000 })
```

`scriptNonce` applies to Telegram scripts this client creates. `scriptTimeoutMs` bounds loading; failed scripts are removed so a later call can retry. Include Telegram's required origins in your CSP. Native buttons support a visible label, CSS class, style, and disabled state during SDK initialization. Widget initialization returns a disposer; `destroyTelegramWidget(containerId)` supports component cleanup.

OIDC sign-in/link actions accept `flow: "redirect" | "popup"`, callback URLs, scopes and popup name/features. Redirect is the default. Call popup actions directly in the click handler so a window can be reserved before asynchronous authorization. Typed Better Fetch options preserve hooks, headers, abort signals and error handling. Inspect `result.error` or set `throw: true`.

See [usage](./usage.md) and [troubleshooting](./troubleshooting.md).

