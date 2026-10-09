# Security

## Verified identities

Widget signatures derive their key using SHA256(botToken). Mini App bot-token HMAC derives its key using HMAC-SHA256("WebAppData", botToken). Both use Web Crypto and compare fixed-length hexadecimal HMACs by accumulating differences. HMAC comparison does not exit on the first mismatched character.

Payload age is bounded by `maxAuthAge`. Timestamps must be positive safe integers and cannot be in the future. Mini App duplicate parameters are rejected. These checks bound replay exposure; payloads remain reusable within the accepted age window. Use an application replay store if single-use authentication is required. Never trust `initDataUnsafe`.

OIDC verifies signatures against Telegram JWKS through jose, with cached/coalesced key requests, an explicit algorithm allowlist, issuer, audience, required subject/issued-at/expiry claims, and callback nonce matching. Authorization code login uses state and PKCE, and token exchange uses Basic client authentication. Telegram has no UserInfo endpoint; the verified ID token supplies its profile.

For direct SDK ID tokens, verification proves the token is issued for this application and still valid. A client-supplied nonce alone is not a server-maintained replay defense. Prefer the code flow when that defense is needed.

## Account safety

Widget/Mini App accounts use numeric Telegram ID; OIDC uses `sub`. Neither usernames nor names are stable identity keys. Do not automatically merge these provider accounts. Ask an already signed-in user to link explicitly.

New Telegram users have unverified placeholder email addresses. Custom mapped email stays unverified. Never infer email ownership from Telegram, and avoid configuring automatic email linking through a trusted provider.

Links require a session. Unlinking requires a fresh session and cannot remove the last sign-in method by default. Plugin linking policy and Better Auth's global linking policy are enforced. Use database constraints on `(providerId, accountId)` to prevent duplicate ownership under concurrent requests.

## Deployment

Keep bot tokens and Web Login secrets in server-side environment variables. The client export contains no server verification code. Use HTTPS and exact trusted origins. Configure Better Auth's rate limiting for production; the plugin supplies per-route rules, but enforcement depends on Better Auth's enabled configuration and storage.

Review CSP rules for Telegram scripts/frames/connect origins. Apply `scriptNonce` when using a nonce-based policy. For popup completion, validate postMessage origin and payload, and refresh the opener's session from your own backend. Never send tokens through postMessage. Configure COOP for Telegram popup communication.

Report security issues through [private vulnerability reporting](https://github.com/mhbdev/tele-better-auth/security/advisories/new). See [SECURITY.md](../SECURITY.md).
