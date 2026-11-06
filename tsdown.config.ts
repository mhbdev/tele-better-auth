import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    neverBundle: [
      "better-auth",
      /^better-auth\//u,
      "@better-auth/core",
      /^@better-auth\/core\//u,
      "jose",
      "@better-fetch/fetch",
      "better-call",
      "rou3",
    ],
  },
  dts: true,
  entry: { client: "src/client.ts", index: "src/index.ts" },
  format: ["esm", "cjs"],
  outExtensions: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  sourcemap: true,
});
