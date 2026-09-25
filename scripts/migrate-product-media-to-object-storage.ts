import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { appConfig } from "../server/config";
import { closeDbResources, initializeDb, readDb, waitForPendingDbWrites, writeDb } from "../server/db";
import { closeObjectStorage, isRemoteObjectStorage, uploadObject } from "../server/object-storage";
import { closePrismaClient } from "../server/prisma";

const apply = process.argv.includes("--apply");
const productionConfirmed = process.argv.includes("--confirm-production");
const staticRoots = ["public", "dist"]
  .map((directory) => path.resolve(process.cwd(), directory))
  .filter((directory) => fs.existsSync(directory));

if (staticRoots.length === 0) {
  throw new Error("Diretorio de assets nao encontrado. Execute no projeto ou no container de runtime.");
}

function localPublicFile(url: string | null | undefined) {
  if (!url || !url.startsWith("/") || url.startsWith("/uploads/")) return null;
  const relative = decodeURIComponent(url.split(/[?#]/, 1)[0]).replace(/^\/+/, "");
  for (const root of staticRoots) {
    const absolute = path.resolve(root, relative);
    if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) continue;
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return absolute;
  }
  return null;
}

function contentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".svg") return "image/svg+xml";
  throw new Error(`Formato de imagem nao suportado: ${extension}`);
}

function safeName(filePath: string) {
  return path.basename(filePath).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "imagem";
}

if (apply && appConfig.env === "production" && !productionConfirmed) {
  throw new Error("Em producao, confirme explicitamente com --confirm-production.");
}
if (apply && !isRemoteObjectStorage()) {
  throw new Error("Defina STORAGE_PROVIDER=minio ou s3 antes de aplicar a migracao.");
}

await initializeDb();

try {
  const db = readDb();
  const fileByUrl = new Map<string, string>();
  for (const product of db.products) {
    for (const url of [product.image_url, ...(product.images ?? [])]) {
      const file = localPublicFile(url);
      if (file && url) fileByUrl.set(url, file);
    }
  }

  const totalBytes = [...fileByUrl.values()].reduce((total, file) => total + fs.statSync(file).size, 0);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    provider: appConfig.storageProvider,
    products: db.products.length,
    uniqueFiles: fileByUrl.size,
    totalBytes,
  }, null, 2));

  if (!apply) {
    console.log("Nenhum upload ou update foi realizado. Use --apply para executar.");
  } else {
    const migratedUrl = new Map<string, string>();
    let completed = 0;
    for (const [currentUrl, file] of fileByUrl) {
      const body = fs.readFileSync(file);
      const digest = createHash("sha256").update(body).digest("hex");
      const key = `products/catalog-import/${digest.slice(0, 20)}-${safeName(file)}`;
      const stored = await uploadObject({ key, body, contentType: contentType(file), originalName: path.basename(file) });
      migratedUrl.set(currentUrl, stored.url);
      completed += 1;
      console.log(`[${completed}/${fileByUrl.size}] ${currentUrl} -> ${stored.url}`);
    }

    db.products = db.products.map((product) => ({
      ...product,
      image_url: product.image_url ? migratedUrl.get(product.image_url) ?? product.image_url : product.image_url,
      images: (product.images ?? []).map((url) => migratedUrl.get(url) ?? url),
    }));
    writeDb(db);
    await waitForPendingDbWrites();
    console.log(`Migracao concluida: ${migratedUrl.size} imagens enviadas e referencias atualizadas.`);
  }
} finally {
  closeDbResources();
  await closeObjectStorage();
  await closePrismaClient();
}
