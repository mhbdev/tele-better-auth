/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("better-auth/api", () => ({
  createAuthEndpoint: vi.fn(
    (_path: string, _options: any, handler: any) => handler
  ),
}));

import { createConfigEndpoint } from "./config-endpoint";
import type { TelegramPluginConfig } from "./plugin-config";

function makeConfig(
  overrides: Partial<TelegramPluginConfig> = {}
): TelegramPluginConfig {
  return {
    allowUserToLink: true,
    autoCreateUser: true,
    botToken: "tok:en",
    botUsername: "my_bot",
    maxAuthAge: 86400,
    miniAppAllowAutoSignin: true,
    miniAppEnabled: false,
    miniAppValidateInitData: true,
    oidcClientId: "123456789",
    oidcEnabled: false,
    testMode: false,
    widgetEnabled: true,
    ...overrides,
  };
}

function mockCtx() {
  return { json: vi.fn((data: any) => data) };
}

describe("createConfigEndpoint", () => {
  it("returns endpoint object with getTelegramConfig key", () => {
    const result = createConfigEndpoint(makeConfig());
    expect(result).toHaveProperty("getTelegramConfig");
    expect(typeof result.getTelegramConfig).toBe("function");
  });

  it("returns all config fields with defaults", async () => {
    const endpoint = createConfigEndpoint(makeConfig());
    const ctx = mockCtx();
    await (endpoint.getTelegramConfig as any)(ctx);

    expect(ctx.json).toHaveBeenCalledWith({
      botUsername: "my_bot",
      loginWidgetEnabled: true,
      miniAppEnabled: false,
      oidcClientId: "123456789",
      oidcEnabled: false,
      testMode: false,
    });
  });

  it("reflects widget disabled", async () => {
    const endpoint = createConfigEndpoint(makeConfig({ widgetEnabled: false }));
    const ctx = mockCtx();
    await (endpoint.getTelegramConfig as any)(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ loginWidgetEnabled: false })
    );
  });

  it("reflects all features enabled", async () => {
    const endpoint = createConfigEndpoint(
      makeConfig({
        miniAppEnabled: true,
        oidcEnabled: true,
        testMode: true,
        widgetEnabled: true,
      })
    );
    const ctx = mockCtx();
    await (endpoint.getTelegramConfig as any)(ctx);

    expect(ctx.json).toHaveBeenCalledWith({
      botUsername: "my_bot",
      loginWidgetEnabled: true,
      miniAppEnabled: true,
      oidcClientId: "123456789",
      oidcEnabled: true,
      testMode: true,
    });
  });

  it("never leaks botToken", async () => {
    const endpoint = createConfigEndpoint(makeConfig());
    const ctx = mockCtx();
    await (endpoint.getTelegramConfig as any)(ctx);

    const [firstCall] = ctx.json.mock.calls;
    const [response] = firstCall!;
    expect(response).not.toHaveProperty("botToken");
    expect(JSON.stringify(response)).not.toContain("tok:en");
  });
});
