import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { TelegramAuthData, TelegramMiniAppUser } from "tele-better-auth";
import { telegram } from "tele-better-auth";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  }),
});

export const auth = betterAuth({
  account: {
    accountLinking: {
      allowDifferentEmails: true,
      disableImplicitLinking: true,
      enabled: true,
      trustedProviders: ["telegram-oidc"],
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),

  plugins: [
    telegram({
      allowUserToLink: true,
      autoCreateUser: true,
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      botUsername: process.env.TELEGRAM_BOT_USERNAME!,

      mapTelegramDataToUser: (data: TelegramAuthData) => ({
        email: undefined, // Telegram doesn't provide email
        image: data.photo_url,
        name: data.username || data.first_name,
      }),
      maxAuthAge: 86400, // 24 hours

      // Mini Apps support
      miniApp: {
        allowAutoSignin: true,
        enabled: true,
        mapMiniAppDataToUser: (user: TelegramMiniAppUser) => ({
          email: undefined,
          image: user.photo_url,
          name: user.username || user.first_name,
        }),
        validateInitData: true,
      },

      // OIDC (OpenID Connect) support via oauth.telegram.org
      // Requires separate bot with Web Login configured in @BotFather
      oidc: {
        clientId: process.env.TELEGRAM_OIDC_CLIENT_ID,
        clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET,
        enabled: !!process.env.TELEGRAM_OIDC_CLIENT_SECRET,
        requestBotAccess: true,
        requestPhone: true,
      },
    }),
  ],

  secret: process.env.BETTER_AUTH_SECRET!,

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24h
  },
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
    : [],
});

export type Session = typeof auth.$Infer.Session;
