// Login Widget component
// app/components/TelegramLoginButton.tsx

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

export function TelegramLoginButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;
    authClient
      .initTelegramWidget(
        "telegram-login-container",
        {
          cornerRadius: 20,
          lang: "en",
          showUserPhoto: true,
          size: "large",
        },
        async (authData) => {
          if (disposed) {
            return;
          }
          setLoading(true);
          setError(null);

          try {
            const result = await authClient.signInWithTelegram(authData);
            if (result.error) {
              setError(result.error.message || "Failed to sign in");
              return;
            }
            router.push("/dashboard");
          } catch {
            setError("Failed to sign in with Telegram");
          } finally {
            setLoading(false);
          }
        }
      )
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          dispose = cleanup;
        }
      })
      .catch(() => {
        setError("Failed to load Telegram login widget");
      });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div id="telegram-login-container" />

      {loading && (
        <div className="text-gray-600 text-sm">Signing in with Telegram...</div>
      )}

      {error && (
        <div className="text-red-600 text-sm" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
