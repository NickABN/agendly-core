import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { defineConfig } from "prisma/config";

// Explicit path so dotenv finds .env regardless of the CWD Prisma uses
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
