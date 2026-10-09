# API reference

Server exports: `telegram`, `createTelegramOIDCProvider`, `telegramOAuth`, and Telegram data/configuration types. Browser exports: `telegramClient` and its options/result types.

## HTTP endpoints

Paths are relative to Better Auth's base path, normally `/api/auth`.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/telegram/config` | public | Non-secret bot and enabled-flow configuration |
| POST | `/telegram/signin` | signed Widget data | Create a session |
| POST | `/telegram/link` | session + signed Widget data | Link numeric Telegram identity |
| POST | `/telegram/unlink` | fresh session | Unlink the shared Widget/Mini App identity |
| POST | `/telegram/miniapp/signin` | signed initData | Create a session |
| POST | `/telegram/miniapp/validate` | signed initData | Return `{ valid, data }`; no session |
| POST | `/telegram/miniapp/link` | session + signed initData | Link numeric Telegram identity |
| POST | `/telegram/miniapp/unlink` | fresh session | Unlink the shared identity |

Widget routes require `loginWidget !== false`; Mini App routes require `miniApp.enabled`. Mini App POST bodies contain `{ initData: string }`. Widget sign-in/link bodies are the original signed `TelegramAuthData`. Unlink actions need no body.

OIDC and Generic OAuth use Better Auth's social endpoints with `provider: "telegram-oidc"`: `POST /sign-in/social`, `POST /link-social`, `GET /callback/telegram-oidc`. Use the core `/unlink-account` endpoint to unlink OIDC.

Invalid input uses 400; invalid authentication/session uses 401; policy-disabled linking uses 403; missing identities/routes use 404; conflicting linked identities use 409. The Mini App validate action reports invalid signatures as `valid: false`. Better Auth determines OAuth errors and redirects.

## Client actions

All fetch actions accept typed Better Fetch options as their final argument. Unless `throw: true` is set, inspect both `result.data` and `result.error`. Sign-in success includes `{ session, user }`; link/unlink success includes `{ success: true, message }`.

| Action | Arguments |
| --- | --- |
| `getTelegramConfig` | fetch options |
| `signInWithTelegram` / `linkTelegram` | signed Widget data, fetch options |
| `unlinkTelegram` | fetch options |
| `signInWithMiniApp` / `linkMiniApp` / `validateMiniApp` | raw initData, fetch options |
| `autoSignInFromMiniApp` | fetch options |
| `unlinkMiniApp` | fetch options |
| `signInWithTelegramOIDC` / `linkTelegramOIDC` | flow options, fetch options |
| `signInWithTelegramOIDCIdToken` / `linkTelegramOIDCIdToken` | ID token, nonce/options, fetch options |
| `initTelegramWidget` | container ID, Widget options, callback; returns disposer |
| `initTelegramWidgetRedirect` | container ID, redirect URL, Widget options |
| `destroyTelegramWidget` | container ID |
| `initTelegramLogin` / `authWithTelegramLogin` | SDK options, callback |
| `openTelegramLogin` | callback |
| `closeTelegramLogin` | no arguments |
| `renderTelegramLoginButton` | container ID, button options, callback; returns button |

The public config contains `botUsername`, `loginWidgetEnabled`, `miniAppEnabled`, `oidcEnabled`, `oidcClientId`, and `testMode`. It never contains the bot token or client secret.

See the exported interfaces and [configuration](./configuration.md) for optional properties.

