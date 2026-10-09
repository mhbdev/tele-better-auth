"use client";

import { useEffect, useState } from "react";

export default function TelegramComplete() {
  const [message, setMessage] = useState("Completing Telegram authentication…");
  useEffect(() => {
    const success = !new URLSearchParams(window.location.search).has("error");
    setMessage(
      success
        ? "Authentication complete. You can close this window."
        : "Authentication failed. You can close this window."
    );
    if (window.opener) {
      window.opener.postMessage(
        { success, type: "telegram-oidc-complete" },
        window.location.origin
      );
      window.close();
    }
  }, []);
  return <p role="status">{message}</p>;
}
