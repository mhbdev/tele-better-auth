import type { TelegramMappedUser } from "./types";

/** Keep primary identity and verification state under Better Auth's control. */
export function omitProtectedUserFields(
  mapped: TelegramMappedUser | undefined
) {
  const fields = { ...mapped };
  delete fields.id;
  delete fields.emailVerified;
  return fields;
}
