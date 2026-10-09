import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/client";
import {
  type TelegramActions,
  type TelegramClientPlugin,
  telegramClient,
} from "tele-better-auth/client";

const plugin = telegramClient();
const typedPlugin: TelegramClientPlugin = plugin;
const plugins: BetterAuthClientPlugin[] = [plugin, typedPlugin];
const authClient = createAuthClient({ plugins });

type Actions = TelegramActions;
const actionTypeCheck = (_actions: Actions | null) => authClient;

export { actionTypeCheck };
