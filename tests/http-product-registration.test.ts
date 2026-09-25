import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSession, createTestServer } from "./http-server.ts";

function buildPng(width: number, height: number) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);
  return Buffer.concat([
    signature,
    ihdrLength,
    Buffer.from("IHDR"),
    ihdrData,
    Buffer.alloc(4),
    Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
  ]);
}

test("admin product registration persists a draft and its uploaded image", async () => {
  process.env.STORAGE_PROVIDER = "local";
  const server = await createTestServer();
  try {
    const admin = await createAdminSession(server.baseUrl);
    const jsonHeaders = {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    };
    const stamp = Date.now();
    const createResponse = await fetch(`${server.baseUrl}/api/admin/products`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: `Produto QA ${stamp}`, price: 199.9, is_active: false }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { id: string; slug: string };

    const form = new FormData();
    form.append("file", new Blob([buildPng(800, 600)], { type: "image/png" }), "produto.png");
    form.append("slug", created.slug);
    const uploadResponse = await fetch(`${server.baseUrl}/api/admin/products/image-upload`, {
      method: "POST",
      headers: { "x-csrf-token": admin.csrfToken, cookie: admin.cookieHeader },
      body: form,
    });
    assert.equal(uploadResponse.status, 201);
    const uploaded = await uploadResponse.json() as { url: string };

    const updateResponse = await fetch(`${server.baseUrl}/api/admin/products/${created.id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ image_url: uploaded.url, image_alt_text: "Produto QA cadastrado", image_review_status: "approved" }),
    });
    assert.equal(updateResponse.status, 200);

    const listResponse = await fetch(`${server.baseUrl}/api/admin/products`, { headers: { cookie: admin.cookieHeader } });
    assert.equal(listResponse.status, 200);
    const products = await listResponse.json() as Array<{ id: string; image_url: string | null }>;
    assert.equal(products.find((product) => product.id === created.id)?.image_url, uploaded.url);
  } finally {
    await server.close();
  }
});
