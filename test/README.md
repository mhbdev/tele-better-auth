# Telegram integration playground

A Next.js example for Widget, Mini App and OIDC authentication. Maintained by [mhbdev](https://github.com/mhbdev).

## Setup

Build the package from the repository root, then install the example:

```sh
npm ci
npm run build
cd test
npm ci
```

Copy `.env.local.example` to `.env.local` and configure your actual server credentials. Prisma's configuration loads Next.js environment files and uses SQLite through the Prisma 7 driver adapter.

```sh
npm run db:generate
npm run db:push
npm run dev
```

Use a public HTTPS origin for Telegram testing, register it in BotFather, and set `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and trusted origins appropriately. For OIDC, register the exact callback URL `https://YOUR_ORIGIN/api/auth/callback/telegram-oidc` and supply the separate Web Login client secret. OIDC is disabled when that secret is absent.

Routes: `/widget`, `/miniapp`, `/oidc`, and `/dashboard`. Mini App must run inside Telegram with raw initData from the configured bot. OIDC popup completion uses `/oidc/complete`, exact-origin postMessage, and compatible COOP headers. Browser popup blockers are reported explicitly.

The example permits explicit OIDC social linking with trustedProviders and allowDifferentEmails, paired with disableImplicitLinking to prevent automatic email-based merging. Review that policy for your own application.

## Checks

```sh
npm run lint
npm run db:generate
npm run type-check
npm run build
```

Builds initialize the server auth configuration and require a bot token/username. CI uses explicit synthetic build placeholders; those cannot authenticate with Telegram. A successful build or mocked integration test does not demonstrate a live Telegram login.

Do not log raw Widget payloads, initData, session tokens or ID tokens. See the [main README](../README.md) for integration and migration guidance.


