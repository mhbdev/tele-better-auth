import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
for (const conditions of Object.values(pkg.exports)) {
  for (const entry of Object.values(conditions)) {
    for (const file of Object.values(entry)) {
      assert(
        existsSync(new URL(`../${file}`, import.meta.url)),
        `Missing export: ${file}`
      );
    }
  }
}
const server = await import("../dist/index.js");
const client = await import("../dist/client.js");
const require = createRequire(import.meta.url);
assert.equal(typeof require("../dist/index.cjs").telegram, "function");
assert.equal(typeof require("../dist/client.cjs").telegramClient, "function");
assert.equal(typeof server.telegramOAuth, "function");
assert.equal(client.telegramClient().id, "telegram");
assert.equal(
  server.telegram({ botToken: "123:token", botUsername: "bot" }).id,
  "telegram"
);
const clientSource = readFileSync(
  new URL("../dist/client.js", import.meta.url),
  "utf8"
);
assert(
  !clientSource.includes("botToken"),
  "Bot token handling leaked into the client bundle"
);
assert(
  !clientSource.includes('from "jose"'),
  "Server crypto leaked into the client bundle"
);
assert(
  existsSync(new URL("../skills/tele-better-auth/SKILL.md", import.meta.url))
);
console.log(
  "ESM, CommonJS, declaration exports, client isolation, and skill packaging verified."
);
