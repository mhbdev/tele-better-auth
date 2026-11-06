# Telegram Mini Apps

Enable `miniApp: { enabled: true }` in the server plugin. Supply the server-only bot token. Set `loginWidget: false` to use a Mini App without the Widget; its schema fields still apply.

Load Telegram's Mini App SDK in your embedded application. Send the exact raw `Telegram.WebApp.initData` string to your server. Never authenticate using `initDataUnsafe`.

```ts
const result = await authClient.autoSignInFromMiniApp();
if (result.error) showError(result.error.message);
```

The helper prefers `Telegram.WebApp.initData` and falls back to the signed `tgWebAppData` URL fragment if Telegram's SDK has not loaded yet. It still sends the raw value to the server for verification.

Or supply raw data explicitly:

```ts
await authClient.signInWithMiniApp(window.Telegram.WebApp.initData);
await authClient.validateMiniApp(window.Telegram.WebApp.initData);
```

The validate action checks authenticity and returns `{ valid, data }`; it does not create a session. Server-side HMAC uses `HMAC-SHA256("WebAppData", botToken)`, sorted fields excluding only `hash`, and a bounded positive integer timestamp. Duplicate parameters, future timestamps and malformed user data are rejected. If `signature` is present, it remains in this bot-token HMAC input; third-party Ed25519 verification uses a different construction.

## Telegram Web and cross-origin deployments

If the Mini App and Better Auth server use different origins, add the app origin to Better Auth's `trustedOrigins` and configure CORS for that origin. Browser sign-in requests validate their origin even before a session cookie exists.

Telegram Web can host the Mini App in a cross-site iframe, where browsers may block ordinary third-party cookies. If sign-in succeeds but the next request has no session, configure Better Auth's cookie attributes for HTTPS deployments:

```ts
advanced: {
  defaultCookieAttributes: {
    sameSite: "none",
    secure: true,
    partitioned: true,
  },
},
```

Cookie partitioning support varies by browser. Test the target Telegram clients and browsers; opening the Mini App in a browser context that allows its auth cookie may be needed.

## Link to an existing account

While the developer's user is already signed in:

```ts
await authClient.linkMiniApp(window.Telegram.WebApp.initData);
await authClient.unlinkMiniApp();
```

Links require a session and respect both `allowUserToLink` and Better Auth's linking `enabled` setting. Widget and Mini App share the same numeric Telegram identity and account record. The package rejects a link owned by another user and a second Telegram identity for a user who already has one.

Unlink requires a fresh session and preserves the last sign-in method unless Better Auth's `allowUnlinkingAll` is explicitly enabled. Mini App-only installations have their own unlink route.

`autoCreateUser: false` or `miniApp.allowAutoSignin: false` prevents new user creation; existing linked users can still sign in. Signature validation is mandatory. The deprecated `validateInitData: false` configuration throws during setup.

Age limits bound replay exposure but do not make payloads single-use. Add an application replay store if your threat model requires one, and protect raw initData as an authentication credential.
