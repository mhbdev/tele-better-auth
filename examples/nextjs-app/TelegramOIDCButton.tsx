// OIDC sign-in component
// app/components/TelegramOIDCButton.tsx

"use client";

import { useState } from "react";
import { authClient } from "../lib/auth-client";

interface TelegramOIDCButtonProps {
  flow?: "popup" | "redirect";
}

export function TelegramOIDCButton({
  flow = "redirect",
}: TelegramOIDCButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let buttonLabel = `Sign in with Telegram (${flow})`;
  if (loading) {
    buttonLabel = flow === "popup" ? "Opening popup..." : "Redirecting...";
  }

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      await authClient.signInWithTelegramOIDC({
        callbackURL: "/dashboard",
        flow,
      });
    } catch {
      setError("Failed to start OIDC flow");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <button
        className="rounded bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
        disabled={loading}
        onClick={handleSignIn}
      >
        {buttonLabel}
      </button>

      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
