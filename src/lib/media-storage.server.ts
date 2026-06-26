import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");
const MEDIA_ROOT = path.join(STORAGE_ROOT, "media");

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const ACCEPTED_MEDIA_TYPES = Object.keys(MIME_EXTENSIONS);

export const MEDIA_LIMITS_MB: Record<string, number> = {
  produto: 2,
  galeria: 2,
  ambientacao: 4,
  tecnica: 2,
  campanha: 4,
  categoria: 4,
  banner: 4,
  totem: 5,
  vitrine: 5,
  institucional: 4,
};

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-./]+|[-./]+$/g, "");
}

function ensureSafeStoragePath(storagePath: string) {
  const normalized = sanitizeSegment(storagePath);
  if (!normalized || normalized.includes("..")) {
    throw new Error("Caminho de storage invalido.");
  }
  return normalized;
}

export function getMediaPublicUrl(storagePath: string) {
  const safePath = ensureSafeStoragePath(storagePath);
  return `/api/public/media?path=${encodeURIComponent(safePath)}`;
}

export function resolveMediaDiskPath(storagePath: string) {
  const safePath = ensureSafeStoragePath(storagePath);
  return path.join(MEDIA_ROOT, safePath);
}

export async function readStoredMedia(storagePath: string) {
  const filePath = resolveMediaDiskPath(storagePath);
  return readFile(filePath);
}

export async function saveMediaFile(input: {
  bytes: Uint8Array;
  storeId: string;
  type: string;
  originalFileName: string;
  mimeType: string;
}) {
  if (!ACCEPTED_MEDIA_TYPES.includes(input.mimeType)) {
    throw new Error("Formato invalido. Use JPG, PNG ou WEBP.");
  }

  const sizeMb = input.bytes.byteLength / (1024 * 1024);
  const limitMb = MEDIA_LIMITS_MB[input.type] ?? 5;
  if (sizeMb > limitMb) {
    throw new Error(`Arquivo acima do limite de ${limitMb} MB para ${input.type}.`);
  }

  const extension =
    MIME_EXTENSIONS[input.mimeType] || path.extname(input.originalFileName).toLowerCase() || ".bin";
  const safeName =
    sanitizeSegment(path.basename(input.originalFileName, path.extname(input.originalFileName))) ||
    "arquivo";
  const storagePath = `${sanitizeSegment(input.storeId)}/${sanitizeSegment(input.type)}/${safeName}-${randomUUID()}${extension}`;
  const diskPath = resolveMediaDiskPath(storagePath);

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, input.bytes);

  return {
    storagePath,
    fileName: path.basename(diskPath),
    fileUrl: getMediaPublicUrl(storagePath),
    size: input.bytes.byteLength,
  };
}
