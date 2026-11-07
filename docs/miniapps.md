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

## Publisher-owned Mini Apps

When campaigns use different Telegram bots, resolve the owning bot on the server and verify each raw payload for that bot. Configure `miniApp.verifyInitData`; the plugin then uses it for sign-in, linking, and validation. The normal `botToken` HMAC verifier remains the default when this callback is absent. A Mini App-only setup may omit `botToken` when `loginWidget: false` and the callback is configured.

The callback receives the raw `initData`, Better Auth's request context, and extra request body fields with `initData` removed. Send those fields from the client with `extraFields`, for example `authClient.signInWithMiniApp(initData, { extraFields: { campaignSlug } })` or `authClient.autoSignInFromMiniApp({ extraFields: { campaignSlug } })`. The fields and `Origin` header are request input: resolve the campaign using the slug and an exact server-side origin allowlist, then resolve its verified Telegram bot ID from your own storage. Never select the bot from a client-supplied bot ID.

If your platform stores each bot token, verify the payload with that token using `verifyMiniAppInitData`, as in the example below. If you do not retain bot tokens, the callback can instead verify Telegram's documented third-party Ed25519 signature using the campaign's server-resolved bot ID and Telegram's public key. After authenticating the exact raw payload, return its verified `TelegramMiniAppData` or `user`. The callback performs the application's cryptographic verification; the plugin does not automatically perform Telegram's third-party signature verification.

The plugin still checks duplicate parameters, hash shape, freshness, and returned user structure. `maxAuthAge` is an upper bound even when using a custom verifier. A successful callback must return verified `TelegramMiniAppData` or its verified `user`; return `false`, `null`, or `undefined` to reject.

```ts
import {
  parseMiniAppInitData,
  telegram,
  validateMiniAppData,
  verifyMiniAppInitData,
} from "tele-better-auth";

export const telegramPlugin = telegram({
  loginWidget: false,
  maxAuthAge: 600,
  miniApp: {
    enabled: true,
    verifyInitData: async (initData, ctx, fields) => {
      const campaignSlug = fields.campaignSlug;
      const origin = ctx.request?.headers.get("origin");
      if (typeof campaignSlug !== "string" || !origin) {
        return false;
      }

      const campaign = await findCampaignForVerifiedOrigin(
        campaignSlug,
        origin
      );
      if (!campaign) return false;

      const botToken = await getServerBotToken(campaign.telegramBotId);
      if (!botToken || !(await verifyMiniAppInitData(initData, botToken, 600))) {
        return false;
      }

      const data = parseMiniAppInitData(initData);
      return validateMiniAppData(data) ? data : false;
    },
  },
});
```

`findCampaignForVerifiedOrigin` and `getServerBotToken` represent application server lookups. Check that the campaign is active and its origin is registered to the publisher before returning its bot ID. Do not accept a bot ID from `fields` as the lookup key. `verifyMiniAppInitData`, `parseMiniAppInitData`, and `validateMiniAppData` are server-side package exports for implementing token based verification. The `extraFields` option is available on Mini App sign-in, auto sign-in, validation, and linking client actions.

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
