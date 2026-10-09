# Contributing

Maintained by [mhbdev](https://github.com/mhbdev). Report bugs through [GitHub issues](https://github.com/mhbdev/tele-better-auth/issues), and security problems through [private reporting](./SECURITY.md).

## Setup

Use Node 22.18+, 24.11+, or 26+ for the development tools. The published runtime supports Node 22.12+.

```sh
git clone https://github.com/mhbdev/tele-better-auth.git
cd tele-better-auth
npm ci
npm run build
```

## Validation

```sh
npm run lint
npm run type-check
npm run build
npm run test:coverage
npm run check:package
npm audit --omit=dev
```

Tests live next to their code. Vitest enforces 90% lines/statements/branches and 80% functions. Use real Better Auth integration tests for adapter/session behavior, real signed tokens for JWT verification, and the core browser redirect hook for popup regressions. Credential-backed Telegram testing is separate from mocked-provider integration tests.

Keep bot tokens and Web Login secrets on the server. Validate payload shape and signatures before provisioning identities. Widget/Mini App identity uses numeric ID; OIDC uses immutable sub. Use Better Auth's endpoint, middleware and internal adapter patterns, preserving account ownership, hooks and last-account protection.

Update the README, relevant docs, integration skill and changelog for public behavior changes. Run the example project's Prisma generation, type check and build when its integration changes.

## Release

A maintainer bumps package.json and package-lock.json together, validates the package, and pushes a matching `vX.Y.Z` tag. `.github/workflows/release.yml` verifies the build and tests, packs the artifact, publishes through npm OIDC with provenance in the `npm-release` environment, and creates a GitHub release. No npm access token is required. The trusted publisher must match repository `mhbdev/tele-better-auth`, workflow `release.yml`, and environment `npm-release`.
