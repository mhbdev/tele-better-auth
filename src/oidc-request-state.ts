import { defineRequestState, hasRequestState } from "@better-auth/core/context";

const verifiedSubject = defineRequestState<string | null>(() => null);

export async function rememberOIDCSubject(subject: string) {
  if (await hasRequestState()) {
    await verifiedSubject.set(subject);
  }
}

export async function currentOIDCSubject() {
  return (await hasRequestState()) ? await verifiedSubject.get() : null;
}
