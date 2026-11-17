import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            AUTH_MODE: "access",
            ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
            ACCESS_AUD: "aud123",
            ADMIN_EMAILS: "admin@example.com",
            ADMIN_GROUPS: "golink-admins",
          },
        },
      }),
    ],
    test: { setupFiles: ["./test/setup.ts"] },
  };
});
