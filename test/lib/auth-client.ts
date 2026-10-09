"use client";

import { createAuthClient } from "better-auth/client";
import { telegramClient } from "tele-better-auth/client";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      : window.location.origin,
  plugins: [telegramClient()],
});

export type { Session } from "./auth";
