import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` runs while building an image, before runtime secrets
    // are injected. Commands that connect to PostgreSQL receive DATABASE_URL.
    url: process.env.DATABASE_URL || "postgresql://prisma:prisma@127.0.0.1:5432/prisma",
  },
});
