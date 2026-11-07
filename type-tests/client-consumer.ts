import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/client";
import {
  type TelegramActions,
  type TelegramClientPlugin,
  type TelegramMiniAppFetchOptions,
  telegramClient,
} from "tele-better-auth/client";

const plugin = telegramClient();
const typedPlugin: TelegramClientPlugin = plugin;
const plugins: BetterAuthClientPlugin[] = [plugin, typedPlugin];
const authClient = createAuthClient({ plugins });

type Actions = TelegramActions;
const actionTypeCheck = (_actions: Actions | null) => authClient;
const miniAppOptions: TelegramMiniAppFetchOptions = {
  extraFields: { campaignSlug: "spring-sale" },
};
const miniAppRequestTypeCheck = () =>
  authClient.signInWithMiniApp("raw-init-data", miniAppOptions);

export { actionTypeCheck, miniAppRequestTypeCheck };
