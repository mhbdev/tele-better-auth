// Client-side auth configuration
// app/lib/auth-client.ts

"use client";

import { createAuthClient } from "better-auth/client";
import { telegramClient } from "tele-better-auth/client";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      : window.location.origin,
  fetchOptions: {
    credentials: "include", // required for link/unlink session cookies
  },
  plugins: [telegramClient()],
});
