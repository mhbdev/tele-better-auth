# Installation

Requires Node.js 22.12+ and Better Auth 1.7.7+.

```sh
npm install better-auth tele-better-auth
```

## Telegram credentials

Create a bot with [BotFather](https://t.me/BotFather). Widget and Mini App authentication require its bot token. The Widget also requires its username, without `@`, and a configured website domain.

For OIDC, configure Web Login in BotFather with your application's allowed origins and callback URL, normally `https://your-app.example/api/auth/callback/telegram-oidc`. Save the numeric client ID and **Web Login client secret**. This is a separate credential from the bot token. Keep both on the server.

```env
TELEGRAM_BOT_TOKEN=123456789:server-only-token
TELEGRAM_BOT_USERNAME=your_bot
TELEGRAM_OIDC_CLIENT_ID=123456789
TELEGRAM_OIDC_CLIENT_SECRET=server-only-web-login-secret
```

Use a public HTTPS development origin registered in BotFather when testing Telegram authentication. Configure Better Auth's base URL and trusted origins for that origin.

## Server and client

```ts
import { betterAuth } from "better-auth";
import { telegram } from "tele-better-auth";

export const auth = betterAuth({
  // Configure your database adapter, secret and baseURL here.
  plugins: [telegram({
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    botUsername: process.env.TELEGRAM_BOT_USERNAME!,
    miniApp: { enabled: true },
    oidc: {
      enabled: true,
      clientId: process.env.TELEGRAM_OIDC_CLIENT_ID!,
      clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
    },
  })],
});
```

```ts
import { createAuthClient } from "better-auth/client";
import { telegramClient } from "tele-better-auth/client";

export const authClient = createAuthClient({ plugins: [telegramClient()] });
```

Mount the Better Auth handler using its framework integration. Browser code imports only `tele-better-auth/client`.

## Database migration

Generate and apply a migration using the Better Auth CLI or your ORM. Widget/Mini App installations add nullable string fields `telegramId`, `telegramUsername`, and `telegramPhoneNumber` to `user`, plus `telegramId` and `telegramUsername` to `account`. User fields are non-input: clients cannot set their own Telegram identity.

OIDC-only installations with `loginWidget: false` and Mini App disabled do not add these fields. OIDC identity lives in Better Auth's account table. OIDC `sub` and numeric Widget/Mini App `id` are separate identifiers; never join them by username or assumed equality.

See [usage](./usage.md), [configuration](./configuration.md), and the [1.7 migration notes](../README.md#upgrading-to-17).


