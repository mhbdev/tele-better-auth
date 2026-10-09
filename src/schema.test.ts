import { describe, expect, it } from "vitest";
import type { TelegramPluginConfig } from "./plugin-config";
import { createTelegramSchema } from "./schema";

function makeConfig(
  overrides: Partial<TelegramPluginConfig> = {}
): TelegramPluginConfig {
  return {
    allowUserToLink: true,
    autoCreateUser: true,
    botToken: "tok",
    botUsername: "bot",
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

describe("createTelegramSchema", () => {
  it("returns schema when widget is enabled", () => {
    const schema = createTelegramSchema(
      makeConfig({ miniAppEnabled: false, widgetEnabled: true })
    );
    expect(schema).toBeDefined();
    expect(schema!.user!.fields).toHaveProperty("telegramId");
    expect(schema!.user!.fields).toHaveProperty("telegramUsername");
    expect(schema!.user!.fields).toHaveProperty("telegramPhoneNumber");
    expect(schema!.account!.fields).toHaveProperty("telegramId");
    expect(schema!.account!.fields).toHaveProperty("telegramUsername");
  });

  it("returns schema when miniApp is enabled (widget disabled)", () => {
    const schema = createTelegramSchema(
      makeConfig({ miniAppEnabled: true, widgetEnabled: false })
    );
    expect(schema).toBeDefined();
    expect(schema!.user!.fields).toHaveProperty("telegramId");
  });

  it("returns schema when both widget and miniApp are enabled", () => {
    const schema = createTelegramSchema(
      makeConfig({ miniAppEnabled: true, widgetEnabled: true })
    );
    expect(schema).toBeDefined();
  });

  it("returns undefined when neither widget nor miniApp is enabled (OIDC-only)", () => {
    const schema = createTelegramSchema(
      makeConfig({ miniAppEnabled: false, widgetEnabled: false })
    );
    expect(schema).toBeUndefined();
  });

  it("user fields have correct structure (type, required, unique, input)", () => {
    const schema = createTelegramSchema(makeConfig())!;
    const userFields = schema.user!.fields;

    for (const field of Object.values(userFields)) {
      expect(field.type).toBe("string");
      expect(field.required).toBe(false);
      expect(field.unique).toBe(false);
      expect((field as any).input).toBe(false);
    }
  });

  it("account fields have correct structure (type, required, unique, no input)", () => {
    const schema = createTelegramSchema(makeConfig())!;
    const accountFields = schema.account!.fields;

    for (const field of Object.values(accountFields)) {
      expect(field.type).toBe("string");
      expect(field.required).toBe(false);
      expect(field.unique).toBe(false);
    }
  });

  it("has exactly 3 user fields and 2 account fields", () => {
    const schema = createTelegramSchema(makeConfig())!;
    expect(Object.keys(schema.user!.fields)).toHaveLength(3);
    expect(Object.keys(schema.account!.fields)).toHaveLength(2);
  });
});
