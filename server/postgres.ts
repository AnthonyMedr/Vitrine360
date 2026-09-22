import { appConfig } from "./config";
import { checkPrismaHealth, closePrismaClient } from "./prisma";

export function isPostgresConfigured() {
  return Boolean(appConfig.databaseUrl);
}

export async function checkPostgresHealth() {
  return checkPrismaHealth();
}

export async function closePostgresPool() {
  await closePrismaClient();
}
