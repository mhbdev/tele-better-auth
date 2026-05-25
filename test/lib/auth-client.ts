"use client";

import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/client";
import { telegramClient } from "tele-better-auth/client";

type TelegramClientActions = ReturnType<
  ReturnType<typeof telegramClient>["getActions"]
>;

type TelegramTestAuthClient = ReturnType<typeof createAuthClient> &
  TelegramClientActions;

const baseClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [telegramClient() as BetterAuthClientPlugin],
});

export const authClient = baseClient as TelegramTestAuthClient;

export type { Session } from "./auth";
