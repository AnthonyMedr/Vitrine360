import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { appConfig } from "./config";
import { dataDir } from "./db";
import { markStoredObjectDeleted, recordStoredObject } from "./prisma";

export type ObjectStorageProvider = "local" | "s3" | "minio";

const localUploadsDir = path.join(dataDir, "uploads");
let s3Client: S3Client | null = null;
let initialization: Promise<void> | null = null;

function provider(): ObjectStorageProvider {
  const value = appConfig.storageProvider.trim().toLowerCase();
  if (value === "s3" || value === "minio") return value;
  return "local";
}

export function isRemoteObjectStorage() {
  return provider() !== "local";
}

export function getObjectStorageConfigurationStatus() {
  const activeProvider = provider();
  const missing: string[] = [];
  if (activeProvider !== "local") {
    if (!appConfig.storage.bucket) missing.push("STORAGE_BUCKET");
    if (!appConfig.storage.region) missing.push("STORAGE_REGION");
    if (activeProvider === "minio" && !appConfig.storage.endpoint) missing.push("STORAGE_ENDPOINT");
    if (activeProvider === "minio" && !appConfig.storage.accessKeyId) missing.push("STORAGE_ACCESS_KEY_ID");
    if (activeProvider === "minio" && !appConfig.storage.secretAccessKey) missing.push("STORAGE_SECRET_ACCESS_KEY");
  }
  return {
    provider: activeProvider,
    configured: missing.length === 0,
    missing,
    bucket: appConfig.storage.bucket || null,
    endpoint: appConfig.storage.endpoint || null,
    publicBaseUrl: appConfig.storage.publicBaseUrl || null,
  };
}

function getS3Client() {
  if (s3Client) return s3Client;
  const credentials = appConfig.storage.accessKeyId && appConfig.storage.secretAccessKey
    ? {
        accessKeyId: appConfig.storage.accessKeyId,
        secretAccessKey: appConfig.storage.secretAccessKey,
      }
    : undefined;
  s3Client = new S3Client({
    region: appConfig.storage.region,
    endpoint: appConfig.storage.endpoint || undefined,
    forcePathStyle: appConfig.storage.forcePathStyle || provider() === "minio",
    credentials,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3Client;
}

function validateObjectKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !/^(products|media)\/[a-z0-9][a-z0-9._/-]*$/i.test(normalized)) {
    throw new Error("Chave de objeto invalida");
  }
  return normalized;
}

function isMissingBucketError(error: unknown) {
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return candidate?.name === "NotFound"
    || candidate?.name === "NoSuchBucket"
    || candidate?.Code === "NoSuchBucket"
    || candidate?.$metadata?.httpStatusCode === 404;
}

export async function initializeObjectStorage() {
  if (initialization) return initialization;
  initialization = (async () => {
    const status = getObjectStorageConfigurationStatus();
    if (!status.configured) {
      throw new Error(`Storage ${status.provider} incompleto: ${status.missing.join(", ")}`);
    }
    if (!isRemoteObjectStorage()) {
      await fsPromises.mkdir(localUploadsDir, { recursive: true });
      return;
    }

    const client = getS3Client();
    try {
      await client.send(new HeadBucketCommand({ Bucket: appConfig.storage.bucket }));
    } catch (error) {
      if (!isMissingBucketError(error) || !appConfig.storage.autoCreateBucket) throw error;
      await client.send(new CreateBucketCommand({ Bucket: appConfig.storage.bucket }));
      await client.send(new HeadBucketCommand({ Bucket: appConfig.storage.bucket }));
    }
  })().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

export function buildObjectUrl(key: string) {
  const safeKey = validateObjectKey(key);
  const encodedKey = safeKey.split("/").map(encodeURIComponent).join("/");
  if (appConfig.storage.publicBaseUrl) {
    return `${appConfig.storage.publicBaseUrl.replace(/\/$/, "")}/${encodedKey}`;
  }
  return `/uploads/${encodedKey}`;
}

export function objectKeyFromUrl(url: string | null | undefined) {
  if (!url) return null;
  let rawKey: string | null = null;
  if (url.startsWith("/uploads/")) {
    rawKey = url.slice("/uploads/".length);
  } else if (appConfig.storage.publicBaseUrl) {
    const prefix = `${appConfig.storage.publicBaseUrl.replace(/\/$/, "")}/`;
    if (url.startsWith(prefix)) rawKey = url.slice(prefix.length);
  }
  if (!rawKey) return null;
  try {
    return validateObjectKey(decodeURIComponent(rawKey));
  } catch {
    return null;
  }
}

export interface UploadObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  originalName: string;
}

export async function uploadObject(input: UploadObjectInput) {
  const key = validateObjectKey(input.key);
  await initializeObjectStorage();
  const checksumSha256 = createHash("sha256").update(input.body).digest("hex");
  const publicUrl = buildObjectUrl(key);
  let etag: string | null = null;

  if (isRemoteObjectStorage()) {
    const result = await getS3Client().send(new PutObjectCommand({
      Bucket: appConfig.storage.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        "sha256": checksumSha256,
        "original-name": encodeURIComponent(input.originalName).slice(0, 1024),
      },
    }));
    etag = result.ETag?.replace(/^"|"$/g, "") ?? null;
  } else {
    const destination = path.join(localUploadsDir, ...key.split("/"));
    await fsPromises.mkdir(path.dirname(destination), { recursive: true });
    await fsPromises.writeFile(destination, input.body, { flag: "wx" });
  }

  try {
    await recordStoredObject({
      key,
      bucket: isRemoteObjectStorage() ? appConfig.storage.bucket : "local",
      provider: provider(),
      publicUrl,
      contentType: input.contentType,
      sizeBytes: input.body.length,
      checksumSha256,
      etag,
      originalName: input.originalName,
    });
  } catch (error) {
    await deleteObjectByKey(key, { skipRegistry: true }).catch(() => undefined);
    throw error;
  }

  return { key, url: publicUrl, etag, checksumSha256, sizeBytes: input.body.length };
}

export async function getObject(key: string) {
  const safeKey = validateObjectKey(key);
  if (!isRemoteObjectStorage()) return null;
  await initializeObjectStorage();
  return getS3Client().send(new GetObjectCommand({ Bucket: appConfig.storage.bucket, Key: safeKey }));
}

async function deleteObjectByKey(key: string, options: { skipRegistry?: boolean } = {}) {
  const safeKey = validateObjectKey(key);
  await initializeObjectStorage();
  if (isRemoteObjectStorage()) {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: appConfig.storage.bucket, Key: safeKey }));
  } else {
    const destination = path.resolve(localUploadsDir, ...safeKey.split("/"));
    const root = path.resolve(localUploadsDir);
    if (destination !== root && destination.startsWith(`${root}${path.sep}`)) {
      await fsPromises.unlink(destination).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  if (!options.skipRegistry) await markStoredObjectDeleted(safeKey);
}

export async function deleteObjectByUrl(url: string | null | undefined) {
  const key = objectKeyFromUrl(url);
  if (!key) return false;
  await deleteObjectByKey(key);
  return true;
}

export async function checkObjectStorageHealth() {
  const status = getObjectStorageConfigurationStatus();
  const startedAt = Date.now();
  if (!status.configured) {
    return { ...status, ready: false, latencyMs: null, error: `Configuracao ausente: ${status.missing.join(", ")}` };
  }
  try {
    await initializeObjectStorage();
    if (!isRemoteObjectStorage()) {
      await fsPromises.access(localUploadsDir, fs.constants.R_OK | fs.constants.W_OK);
    } else {
      await getS3Client().send(new HeadBucketCommand({ Bucket: appConfig.storage.bucket }));
    }
    return { ...status, ready: true, latencyMs: Date.now() - startedAt, error: null };
  } catch (error) {
    return {
      ...status,
      ready: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "storage_healthcheck_failed",
    };
  }
}

export async function closeObjectStorage() {
  initialization = null;
  if (!s3Client) return;
  s3Client.destroy();
  s3Client = null;
}
