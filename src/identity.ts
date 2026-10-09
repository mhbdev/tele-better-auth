import type { GenericEndpointContext } from "@better-auth/core";
import { runWithTransaction } from "@better-auth/core/context";
import type { User, ValidateUserInfoAction } from "better-auth";
import { APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { ERROR_CODES, PLUGIN_ID, SUCCESS_MESSAGES } from "./constants";
import type { TelegramPluginConfig } from "./plugin-config";
import type { TelegramAccountRecord } from "./types";

interface TelegramIdentity {
  first_name: string;
  id: number;
  last_name?: string;
  photo_url?: string;
  username?: string;
}

interface UserMapping {
  email?: string;
  image?: string;
  name?: string;
  [key: string]: any;
}

function accountData(identity: TelegramIdentity) {
  return {
    accountId: String(identity.id),
    providerId: PLUGIN_ID,
    telegramId: String(identity.id),
    telegramUsername: identity.username,
  };
}

async function validateUser(
  ctx: GenericEndpointContext,
  user: Partial<User> & Record<string, unknown>,
  action: ValidateUserInfoAction,
  identity: TelegramIdentity
) {
  const validate = ctx.context.options.user?.validateUserInfo;
  if (!validate) {
    return;
  }
  let result: Awaited<ReturnType<typeof validate>>;
  try {
    result = await validate(
      {
        source: {
          action,
          method: "oauth",
          oauth: { profile: { ...identity }, providerId: PLUGIN_ID },
        },
        user,
      },
      ctx
    );
  } catch (cause) {
    throw new APIError("FORBIDDEN", {
      cause,
      code: "validation_failed",
      message: "User validation failed",
    });
  }
  if (result?.error) {
    throw new APIError("FORBIDDEN", {
      code: result.error,
      message: result.errorDescription || result.error,
    });
  }
}

/** Shared verified-identity sign-in for Widget and Mini App flows. */
export async function signInTelegramIdentity(
  ctx: GenericEndpointContext,
  config: TelegramPluginConfig,
  identity: TelegramIdentity,
  mapped: UserMapping | undefined,
  allowCreate: boolean,
  creationError: { code: string; message: string }
) {
  const account = await ctx.context.adapter.findOne<TelegramAccountRecord>({
    model: "account",
    where: [
      { field: "providerId", value: PLUGIN_ID },
      { field: "accountId", value: String(identity.id) },
    ],
  });
  let user: User | null;
  if (account) {
    user = await ctx.context.internalAdapter.findUserById(account.userId);
  } else {
    // Preserve migration of pre-account users using a server-owned Telegram ID.
    user = await ctx.context.adapter.findOne<User>({
      model: "user",
      where: [{ field: "telegramId", value: String(identity.id) }],
    });
    if (user) {
      const linked = await ctx.context.internalAdapter.linkAccount({
        ...accountData(identity),
        userId: user.id,
      });
      if (!linked) {
        throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_AUTHENTICATION);
      }
    } else {
      if (!(allowCreate && config.autoCreateUser)) {
        throw APIError.from("NOT_FOUND", creationError);
      }
      const userData = {
        image: identity.photo_url,
        name: [identity.first_name, identity.last_name]
          .filter(Boolean)
          .join(" "),
        ...mapped,
        email: mapped?.email ?? `${identity.id}@telegram.invalid`,
        emailVerified: false,
        telegramId: String(identity.id),
        telegramUsername: identity.username,
      } as Omit<User, "id" | "createdAt" | "updatedAt">;
      await validateUser(ctx, userData, "create-user", identity);
      const created = await runWithTransaction(
        ctx.context.adapter,
        async () => {
          const result = await ctx.context.internalAdapter.createOAuthUser(
            userData,
            accountData(identity)
          );
          if (!result.account) {
            throw APIError.from(
              "BAD_REQUEST",
              ERROR_CODES.INVALID_AUTHENTICATION
            );
          }
          return result;
        }
      );
      ({ user } = created);
    }
  }
  if (!user) {
    throw APIError.from("UNAUTHORIZED", ERROR_CODES.INVALID_AUTHENTICATION);
  }
  await validateUser(ctx, user, "sign-in", identity);
  const session = await ctx.context.internalAdapter.createSession(user.id);
  if (!session) {
    throw APIError.from("UNAUTHORIZED", ERROR_CODES.INVALID_AUTHENTICATION);
  }
  await setSessionCookie(ctx, { session, user });
  return ctx.json({ session, user });
}

/** Link only a verified identity, never reassign another user's account. */
export async function linkTelegramIdentity(
  ctx: GenericEndpointContext,
  config: TelegramPluginConfig,
  identity: TelegramIdentity
) {
  if (
    !config.allowUserToLink ||
    ctx.context.options.account?.accountLinking?.enabled === false
  ) {
    throw APIError.from("FORBIDDEN", ERROR_CODES.LINKING_DISABLED);
  }
  const userId = ctx.context.session?.user.id;
  if (!userId) {
    throw APIError.from("UNAUTHORIZED", ERROR_CODES.NOT_AUTHENTICATED);
  }
  const account = await ctx.context.adapter.findOne<TelegramAccountRecord>({
    model: "account",
    where: [
      { field: "providerId", value: PLUGIN_ID },
      { field: "accountId", value: String(identity.id) },
    ],
  });
  if (account) {
    throw APIError.from(
      "CONFLICT",
      account.userId === userId
        ? ERROR_CODES.TELEGRAM_ALREADY_LINKED_SELF
        : ERROR_CODES.TELEGRAM_ALREADY_LINKED_OTHER
    );
  }
  const accounts = await ctx.context.internalAdapter.findAccounts(userId);
  if (accounts.some((item) => item.providerId === PLUGIN_ID)) {
    throw APIError.from("CONFLICT", ERROR_CODES.TELEGRAM_ALREADY_LINKED_SELF);
  }
  await validateUser(ctx, ctx.context.session!.user, "link-account", identity);
  await runWithTransaction(ctx.context.adapter, async () => {
    const linked = await ctx.context.internalAdapter.linkAccount({
      ...accountData(identity),
      userId,
    });
    if (!linked) {
      throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_AUTHENTICATION);
    }
    await ctx.context.internalAdapter.updateUser(userId, {
      telegramId: String(identity.id),
      telegramUsername: identity.username,
    });
  });
  return ctx.json({ message: SUCCESS_MESSAGES.TELEGRAM_LINKED, success: true });
}

/** Protect the last sign-in method, matching Better Auth's unlink policy. */
export async function unlinkTelegramIdentity(ctx: GenericEndpointContext) {
  const userId = ctx.context.session?.user.id;
  if (!userId) {
    throw APIError.from("UNAUTHORIZED", ERROR_CODES.NOT_AUTHENTICATED);
  }
  const accounts = await ctx.context.internalAdapter.findAccounts(userId);
  const account = accounts.find((item) => item.providerId === PLUGIN_ID);
  if (!account) {
    throw APIError.from("NOT_FOUND", ERROR_CODES.NOT_LINKED);
  }
  if (
    accounts.length === 1 &&
    !ctx.context.options.account?.accountLinking?.allowUnlinkingAll
  ) {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.LAST_ACCOUNT);
  }
  await runWithTransaction(ctx.context.adapter, async () => {
    await ctx.context.internalAdapter.deleteAccount(account.id);
    await ctx.context.internalAdapter.updateUser(userId, {
      telegramId: null,
      telegramPhoneNumber: null,
      telegramUsername: null,
    });
  });
  return ctx.json({
    message: SUCCESS_MESSAGES.TELEGRAM_UNLINKED,
    success: true,
  });
}
