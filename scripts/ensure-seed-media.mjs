import { constants } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const seedAssetsDir = path.join(rootDir, "seed-assets");
const storageRoot = path.join(rootDir, "storage", "media");
const storeId = process.env.SEED_MEDIA_STORE_ID || "default-store";

const mediaTypes = [
  "produto",
  "galeria",
  "ambientacao",
  "tecnica",
  "campanha",
  "categoria",
  "banner",
  "totem",
  "vitrine",
  "institucional",
];

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function listSeedImages() {
  try {
    const entries = await readdir(seedAssetsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function copyIfMissing(source, destination) {
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
}

const images = await listSeedImages();

if (images.length > 0) {
  for (const type of mediaTypes) {
    const destinationDir = path.join(storageRoot, storeId, type);
    await mkdir(destinationDir, { recursive: true });

    for (const image of images) {
      await copyIfMissing(path.join(seedAssetsDir, image), path.join(destinationDir, image));
    }
  }
}
