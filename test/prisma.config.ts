import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  datasource: { url: process.env.DATABASE_URL || "file:./prisma/dev.db" },
  schema: "prisma/schema.prisma",
});
