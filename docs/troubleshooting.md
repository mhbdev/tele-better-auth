# Troubleshooting

## Popup redirects the main page

Upgrade to 1.7 and pass `flow: "popup"` to the OIDC sign-in/link action. The action reserves a blank window synchronously and sends `disableRedirect: true` to Better Auth. Call it directly from a click; awaiting another operation first may lose user activation.

Do not use popup targets `_self`, `_parent`, or `_top`. Do not add `noopener` to custom features when the application needs the returned window handle/opener. A blocked popup throws and does not fall back to a main-page redirect.

The callback URL opens in the popup. Add a success page that posts a fixed message to an exact trusted opener origin and closes itself; validate the message in the opener and refresh the session. Use a separate error page. See the [README example](../README.md).

## SDK popup does not communicate

Telegram documents that `Cross-Origin-Opener-Policy: same-origin` blocks its popup communication. Configure `same-origin-allow-popups` for the login page where appropriate. Check CSP and extension blockers. Prepare `initTelegramLogin` before a click, then call `openTelegramLogin` directly from that click.

## OIDC invalid_client or redirect mismatch

Use the separate Web Login client secret from BotFather, not the bot token. Register exact allowed origins and the actual Better Auth callback URL, normally `/api/auth/callback/telegram-oidc`. Check client ID, scheme, host and base path.

Match `oidc.algorithms` to BotFather's JWT algorithm; RS256 is the default. Enable profile-compatible algorithms/scopes according to Telegram's documentation.

## OIDC linking rejected

A session is required. Check `allowUserToLink` and Better Auth's global linking policy. Telegram does not supply verified email. Explicit social linking requires `trustedProviders: ["telegram-oidc"]` and `allowDifferentEmails: true`; pair these with `disableImplicitLinking: true` to prevent automatic email-based merging. Review the effect on other providers. Standalone Generic OAuth uses core policy.

## Mini App verification fails

Send the exact raw initData from the intended bot, not parsed/re-serialized data or initDataUnsafe. Check the server bot token, clock and maximum age. Duplicate keys, malformed user JSON, future timestamps and invalid signatures are rejected. HMAC includes `signature` when present; Ed25519 third-party examples use different input.

## Script or Widget problems

Check the container exists, the bot username omits `@`, and its website domain is registered. CSP may require `scriptNonce` and Telegram origins. Script load errors/timeouts remove the failed script, allowing retries. Dispose Widget callbacks on unmount. New `telegram-login.js` results contain `id_token`; legacy Widget callbacks contain `hash`. They use different server actions.

## Missing database fields

Run a schema migration after enabling Widget/Mini App. OIDC-only and standalone Generic OAuth need no Telegram-specific columns. Preserve core account uniqueness and session fields. Do not join OIDC and numeric Telegram identities by assumed ID equality.
