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
            SESSION_SECRET: "test-session-secret-0123456789abcdef",
            OIDC_ISSUER: "https://idp.test",
            OIDC_CLIENT_ID: "cairn-client",
            OIDC_CLIENT_SECRET: "shh",
            ADMIN_EMAILS: "admin@example.com",
            ADMIN_GROUPS: "golink-admins",
          },
        },
      }),
    ],
    test: { setupFiles: ["./test/setup.ts"] },
  };
});
