// Server-side auth configuration
// app/lib/auth.ts

import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { telegram } from "tele-better-auth";

export const auth = betterAuth({
  account: {
    accountLinking: {
      allowDifferentEmails: true,
      disableImplicitLinking: true,
      enabled: true,
      trustedProviders: ["telegram-oidc"],
    },
  },
  database: new Pool({ connectionString: process.env.DATABASE_URL! }),

  plugins: [
    telegram({
      // Optional: configuration
      allowUserToLink: true,
      autoCreateUser: true,
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      botUsername: process.env.TELEGRAM_BOT_USERNAME!,

      // Optional: custom user mapping
      mapTelegramDataToUser: (data) => ({
        image: data.photo_url,
        name: data.username || data.first_name,
      }),
      maxAuthAge: 86400, // 24 hours

      // Mini Apps — enable if you're building a Telegram Mini App
      miniApp: {
        allowAutoSignin: true,
        enabled: true,
        validateInitData: true,
      },

      // OIDC — OAuth 2.0 flow via oauth.telegram.org
      // Requires BotFather Web Login setup. See README prerequisites.
      oidc: {
        clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
        enabled: true,
        requestPhone: true,
      },
    }),
  ],
});
