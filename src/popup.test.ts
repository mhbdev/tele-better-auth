/** @vitest-environment happy-dom */
import { createAuthClient } from "better-auth/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { telegramClient } from "./client";

const url = "https://oauth.telegram.org/auth?client_id=123";
let popup: {
  location: { href: string };
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  popup = { close: vi.fn(), focus: vi.fn(), location: { href: "about:blank" } };
  vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
});
afterEach(() => vi.restoreAllMocks());

describe("popup flow with Better Auth's real client hooks", () => {
  it.each(["signInWithTelegramOIDC", "linkTelegramOIDC"] as const)(
    "%s reserves synchronously and never redirects the opener",
    async (method) => {
      let release!: (response: Response) => void;
      const fetchMock = vi.fn(
        (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Promise<Response>((resolve) => {
            release = resolve;
          })
      );
      const onSuccess = vi.fn();
      const locationBefore = window.location.href;
      const client = createAuthClient({
        baseURL: "https://app.test",
        fetchOptions: { customFetchImpl: fetchMock },
        plugins: [telegramClient()],
      });
      const pending = client[method](
        { callbackURL: "/done", flow: "popup" },
        { onSuccess }
      );
      expect(window.open).toHaveBeenCalledOnce();
      expect(window.open).toHaveBeenCalledWith(
        "about:blank",
        "telegram-oidc-login",
        expect.not.stringContaining("noopener")
      );
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(JSON.parse(init.body as string).disableRedirect).toBe(true);
      release(Response.json({ redirect: false, url }));
      const result = await pending;
      expect(result.data?.url).toBe(url);
      expect(popup.location.href).toBe(url);
      expect(window.location.href).toBe(locationBefore);
      expect(onSuccess).toHaveBeenCalledOnce();
    }
  );
  it("rejects blocked popups without starting authorization or navigating", async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const fetchMock = vi.fn();
    const actions = telegramClient().getActions(fetchMock);
    await expect(
      actions.signInWithTelegramOIDC({ flow: "popup" })
    ).rejects.toThrow("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["_self", "_parent", "_top"])(
    "rejects a popup target of %s",
    async (name) => {
      await expect(
        telegramClient()
          .getActions(vi.fn())
          .signInWithTelegramOIDC({ flow: "popup", popup: { name } })
      ).rejects.toThrow("separate window");
      expect(window.open).not.toHaveBeenCalled();
    }
  );
  it("closes the reserved window on network failure", async () => {
    const actions = telegramClient().getActions(
      vi.fn().mockRejectedValue(new Error("offline"))
    );
    await expect(
      actions.signInWithTelegramOIDC({ flow: "popup" })
    ).rejects.toThrow("offline");
    expect(popup.close).toHaveBeenCalledOnce();
  });
  it.each([{ error: { message: "Unauthorized" } }, { data: {} }])(
    "closes when authorization has no URL: %j",
    async (result) => {
      await telegramClient()
        .getActions(vi.fn().mockResolvedValue(result))
        .linkTelegramOIDC({ flow: "popup" });
      expect(popup.close).toHaveBeenCalledOnce();
    }
  );
  it("rejects a URL from a different provider", async () => {
    const actions = telegramClient().getActions(
      vi.fn().mockResolvedValue({ data: { url: "https://attacker.test" } })
    );
    await expect(
      actions.signInWithTelegramOIDC({ flow: "popup" })
    ).rejects.toThrow("Unexpected");
    expect(popup.close).toHaveBeenCalledOnce();
  });
  it("uses explicit popup geometry and preserves headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ data: { url } });
    await telegramClient()
      .getActions(fetchMock)
      .linkTelegramOIDC(
        {
          flow: "popup",
          popup: { features: "popup,width=600", name: "custom" },
          scopes: ["phone"],
        },
        { headers: { "X-App": "test" } }
      );
    expect(window.open).toHaveBeenCalledWith(
      "about:blank",
      "custom",
      "popup,width=600"
    );
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      body: { disableRedirect: true, scopes: ["phone"] },
      headers: { "X-App": "test" },
    });
  });
  it("retains Better Auth's redirect behavior for redirect flow", async () => {
    const client = createAuthClient({
      baseURL: "https://app.test",
      fetchOptions: {
        customFetchImpl: async () => Response.json({ redirect: true, url }),
      },
      plugins: [telegramClient()],
    });
    await client.signInWithTelegramOIDC({ flow: "redirect" });
    expect(window.location.href).toBe(url);
    expect(window.open).not.toHaveBeenCalled();
  });
});
