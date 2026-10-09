/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { telegramClient } from "./client";

const sdk = () => ({
  auth: vi.fn(),
  close: vi.fn(),
  init: vi.fn(),
  open: vi.fn(),
});
beforeEach(() => {
  document.head.replaceChildren();
  document.body.innerHTML = '<div id="login"></div>';
  delete (window as any).Telegram;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("browser lifecycle and developer controls", () => {
  it("shares script loading, applies CSP nonce, and skips config for an explicit client ID", async () => {
    const fetchMock = vi.fn();
    const actions = telegramClient({ scriptNonce: "csp" }).getActions(
      fetchMock
    );
    const first = actions.initTelegramLogin({ clientId: "123" });
    const second = actions.initTelegramLogin({ clientId: "123" });
    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.nonce).toBe("csp");
    (window as any).Telegram = { Login: sdk() };
    scripts[0]!.dispatchEvent(new Event("load"));
    await Promise.all([first, second]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("times out, removes failed scripts and permits a retry", async () => {
    vi.useFakeTimers();
    const unloaded = document.createElement("script");
    unloaded.type = "application/json";
    unloaded.src = "https://telegram.org/js/telegram-login.js";
    document.head.appendChild(unloaded);
    const actions = telegramClient({ scriptTimeoutMs: 50 }).getActions(vi.fn());
    const pending = actions.initTelegramLogin({ clientId: "123" });
    const rejection = expect(pending).rejects.toThrow("Failed to load");
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
    expect(document.head.querySelector("script")).toBeNull();
    const retry = actions.initTelegramLogin({ clientId: "123" });
    (window as any).Telegram = { Login: sdk() };
    document.head.querySelector("script")!.dispatchEvent(new Event("load"));
    await retry;
  });
  it("opens a prepared SDK popup synchronously", async () => {
    const api = sdk();
    (window as any).Telegram = { Login: api };
    const pending = telegramClient().getActions(vi.fn()).openTelegramLogin();
    expect(api.open).toHaveBeenCalledOnce();
    await pending;
  });
  it("keeps callbacks repeatable and disposes old Widgets without removing replacements", async () => {
    (window as any).Telegram = { Login: sdk() };
    const actions = telegramClient({ scriptNonce: "csp" }).getActions(
      vi.fn().mockResolvedValue({ data: { botUsername: "bot" } })
    );
    const onAuth = vi.fn();
    const first = await actions.initTelegramWidget("login", {}, onAuth);
    const callback = document
      .querySelector("#login script")!
      .getAttribute("data-onauth")!
      .split("(")[0]!;
    (window as any)[callback]({ id: 42 });
    (window as any)[callback]({ id: 42 });
    expect(onAuth).toHaveBeenCalledTimes(2);
    expect(
      document.querySelector<HTMLScriptElement>("#login script")!.nonce
    ).toBe("csp");
    const second = await actions.initTelegramWidget("login", {}, onAuth);
    expect((window as any)[callback]).toBeUndefined();
    first();
    expect(document.querySelector("#login script")).not.toBeNull();
    second();
    expect(document.getElementById("login")!.childElementCount).toBe(0);
  });
  it("returns an accessible native button and preserves customization", async () => {
    (window as any).Telegram = { Login: sdk() };
    const button = await telegramClient()
      .getActions(vi.fn())
      .renderTelegramLoginButton("login", {
        ariaLabel: "Continue with Telegram",
        className: "custom",
        clientId: "123",
        style: "outlined",
        text: "Continue",
      });
    expect(button.type).toBe("button");
    expect(button.disabled).toBe(false);
    expect(button.classList.contains("custom")).toBe(true);
    expect(button.textContent).toBe("Continue");
    expect(button.getAttribute("aria-label")).toBe("Continue with Telegram");
    expect(button.getAttribute("data-style")).toBe("outlined");
  });
});
