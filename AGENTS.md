# tele-better-auth

Telegram authentication plugin for [Better Auth](https://www.better-auth.com/). Login Widget + Mini App + OIDC auth flows, published as `tele-better-auth` on npm.

## Architecture

Two entry points, two export paths:

- **`src/index.ts`** -> `tele-better-auth` -- Server plugin (`BetterAuthPlugin`)
- **`src/client.ts`** -> `tele-better-auth/client` -- Browser client plugin (widget management, Mini App auto-signin)

Supporting modules:

- **`src/verify.ts`** -- HMAC-SHA256 verification via Web Crypto API. Two paths: Login Widget (`SHA256(botToken)`) and Mini App (`HMAC-SHA256("WebAppData", botToken)`)
- **`src/oidc.ts`** -- Telegram OIDC provider factory. Creates an `OAuthProvider` for Better Auth's social login system using OAuth 2.0 Authorization Code flow with PKCE via `oauth.telegram.org`. JWT verification via cached JWKS and an explicit algorithm allowlist; Generic OAuth helper uses the same verified identity model.
- **`src/types.ts`** -- All TypeScript interfaces (`TelegramPluginOptions`, `TelegramAuthData`, Mini App types, `TelegramOIDCOptions`, `TelegramOIDCClaims`)
- **`src/constants.ts`** -- Error codes, success messages, `PLUGIN_ID`, `DEFAULT_MAX_AUTH_AGE`, OIDC endpoints/issuer constants

### Server Endpoints

| Method | Path                         | Auth    | Purpose                               |
| ------ | ---------------------------- | ------- | ------------------------------------- |
| POST   | `/telegram/signin`           | None    | Authenticate with Login Widget data   |
| POST   | `/telegram/link`             | Session | Link Telegram to current user         |
| POST   | `/telegram/unlink`           | Session | Unlink Telegram from current user     |
| GET    | `/telegram/config`           | None    | Returns bot username for widget init  |
| POST   | `/telegram/miniapp/signin`   | None    | Sign in from Mini App (optional)      |
| POST   | `/telegram/miniapp/validate` | None    | Validate Mini App initData (optional) |
| POST   | `/telegram/miniapp/link` | Session | Link a verified Mini App identity |
| POST   | `/telegram/miniapp/unlink` | Fresh session | Unlink the shared Telegram account |

OIDC (when `oidc.enabled`) uses Better Auth's built-in social login routes (`POST /sign-in/social` with `provider: "telegram-oidc"`, `GET /callback/telegram-oidc`). The plugin injects a `telegram-oidc` social provider via the `init` hook.

Schema conditionally extends `user` table with `telegramId`, `telegramUsername`, and `telegramPhoneNumber` fields, and `account` table with `telegramId` and `telegramUsername` fields — only when Login Widget or Mini App flows are enabled (default). OIDC-only setups (`loginWidget: false`) skip these fields.

## Code Style

- **Biome** via ultracite (`biome.jsonc` extends `ultracite/biome/core`)
- **lint-staged** runs `ultracite fix` on pre-commit
- Relaxed rules: `noNonNullAssertion`, `noExplicitAny`, `useNamingConvention`, `noMagicNumbers` all off
- ES modules, `verbatimModuleSyntax`, strict null checks, `noUncheckedIndexedAccess`

## Testing

- **Vitest** with `happy-dom` environment
- Tests co-located in `src/` (`*.test.ts`)
- Coverage: v8 provider, thresholds -- 90% lines/statements/branches, 80% functions
- `vitest.setup.ts` suppresses happy-dom DOMException warnings for script loading

## Commands

```bash
npm run build          # tsdown (ESM + CJS + .d.ts)
npm run dev            # tsdown --watch
npm run type-check     # tsc --noEmit
npm run test           # vitest run
npm run test:watch     # vitest (watch mode)
npm run test:coverage  # vitest run --coverage
npm run lint           # ultracite check
npm run lint:fix       # ultracite fix
```

Single test file: `npx vitest run src/verify.test.ts`

## Dependencies

**Runtime (peer):** `better-auth` (^1.7.7)

**Runtime:** `jose`; peers `better-auth` and `@better-auth/core` (^1.7.7). All runtime dependencies stay external in tsdown.

**Dev:** Biome, ultracite, tsdown, TypeScript 7, Vitest 5, happy-dom

**Runtime Node:** >= 22.12.0. Development tools: Node 22.18+, 24.11+, or 26+.

## Review Guidelines

- Verification logic in `verify.ts` is security-critical -- changes to HMAC computation or timestamp checks need extra scrutiny
- `botToken` must never leak to client-side code. Server plugin only.
- All endpoints use `createAuthEndpoint()` from `better-auth/api`. Follow that pattern.
- Session-protected endpoints use `sessionMiddleware`. Don't forget it for authenticated routes.
- Type guards (`validateTelegramAuthData`, `validateMiniAppData`) run before processing. Don't skip validation.
- Mini App endpoints are conditionally registered (`miniApp.enabled`). Test both enabled and disabled paths.
- OIDC provider is conditionally injected via `init` hook (`oidc.enabled`). JWT verification in `oidc.ts` uses `jose` library -- changes to JWKS fetching or token validation need scrutiny.
- HTTP status codes: 400 (validation), 401 (auth), 403 (disabled), 404 (not found), 409 (conflict)
- Coverage thresholds are enforced in CI. New code needs tests.
