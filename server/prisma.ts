import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { appConfig } from "./config";

let prismaClient: PrismaClient | null = null;

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function isPrismaConfigured() {
  return appConfig.dbProvider === "postgres" && Boolean(appConfig.databaseUrl);
}

export function getPrismaClient() {
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL nao configurada");
  }

  if (!prismaClient) {
    const adapter = new PrismaPg({
      connectionString: appConfig.databaseUrl,
      max: appConfig.postgres.maxConnections,
      idleTimeoutMillis: appConfig.postgres.idleTimeoutMs,
      connectionTimeoutMillis: appConfig.postgres.connectionTimeoutMs,
      ssl: appConfig.postgres.ssl
        ? { rejectUnauthorized: appConfig.postgres.sslRejectUnauthorized }
        : undefined,
    });
    prismaClient = new PrismaClient({
      adapter,
      log: appConfig.env === "development" ? ["warn", "error"] : ["error"],
      transactionOptions: {
        maxWait: appConfig.postgres.transactionMaxWaitMs,
        timeout: appConfig.postgres.transactionTimeoutMs,
      },
    });
  }

  return prismaClient;
}

export async function readPrismaRuntimeState() {
  const prisma = getPrismaClient();
  const [records, meta] = await prisma.$transaction([
    prisma.runtimeRecord.findMany({ select: { collection: true, id: true, payload: true } }),
    prisma.runtimeMeta.findMany({ select: { key: true, payload: true } }),
  ]);
  return { records, meta };
}

export async function hasPrismaRuntimeData() {
  return (await getPrismaClient().runtimeRecord.count()) > 0;
}

export async function replacePrismaRuntimeState(
  collections: Array<{ name: string; rows: Array<{ id: string; payload: unknown }> }>,
  meta: Array<{ key: string; payload: unknown }>,
) {
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    for (const collection of collections) {
      await tx.runtimeRecord.deleteMany({ where: { collection: collection.name } });
      if (collection.rows.length > 0) {
        await tx.runtimeRecord.createMany({
          data: collection.rows.map((row) => ({
            collection: collection.name,
            id: row.id,
            payload: jsonValue(row.payload),
          })),
        });
      }
    }

    for (const item of meta) {
      const payload = jsonValue(item.payload);
      await tx.runtimeMeta.upsert({
        where: { key: item.key },
        create: { key: item.key, payload },
        update: { payload },
      });
    }
  });
}

export interface StoredObjectMetadata {
  key: string;
  bucket: string;
  provider: string;
  publicUrl: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  etag?: string | null;
  originalName?: string | null;
}

export async function recordStoredObject(metadata: StoredObjectMetadata) {
  if (!isPrismaConfigured()) return;
  await getPrismaClient().storedObject.upsert({
    where: { key: metadata.key },
    create: { ...metadata, deletedAt: null },
    update: { ...metadata, deletedAt: null },
  });
}

export async function markStoredObjectDeleted(key: string) {
  if (!isPrismaConfigured()) return;
  await getPrismaClient().storedObject.updateMany({
    where: { key, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function checkPrismaHealth() {
  if (!appConfig.databaseUrl) {
    return {
      provider: "postgres",
      orm: "prisma",
      configured: false,
      ready: false,
      latencyMs: null,
      error: "DATABASE_URL nao configurada",
    };
  }

  const startedAt = Date.now();
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return {
      provider: "postgres",
      orm: "prisma",
      configured: true,
      ready: true,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      provider: "postgres",
      orm: "prisma",
      configured: true,
      ready: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "postgres_healthcheck_failed",
    };
  }
}

export async function closePrismaClient() {
  if (!prismaClient) return;
  const current = prismaClient;
  prismaClient = null;
  await current.$disconnect();
}
