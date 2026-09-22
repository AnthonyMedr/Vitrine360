import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createAdminSession, createTestServer } from "./http-server.ts";

let baseUrl = "";
let closeServer: (() => Promise<void>) | null = null;

test.before(async () => {
  const server = await createTestServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.after(async () => {
  await closeServer?.();
});

function buildPng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdrType = Buffer.from("IHDR");
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrCrc = Buffer.alloc(4);
  const ihdrChunk = Buffer.concat([ihdrLen, ihdrType, ihdrData, ihdrCrc]);
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  return Buffer.concat([signature, ihdrChunk, iend]);
}

function buildJpegWithDimensions(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const sof0Header = Buffer.from([0xff, 0xc0]);
  const componentData = Buffer.from([1, 0x11, 0]);
  const sof0Payload = Buffer.alloc(2 + 1 + 2 + 2 + 1 + componentData.length);
  let o = 0;
  sof0Payload.writeUInt16BE(2 + 1 + 2 + 2 + 1 + componentData.length, o); o += 2;
  sof0Payload.writeUInt8(8, o); o += 1;
  sof0Payload.writeUInt16BE(height, o); o += 2;
  sof0Payload.writeUInt16BE(width, o); o += 2;
  sof0Payload.writeUInt8(1, o); o += 1;
  componentData.copy(sof0Payload, o);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, sof0Header, sof0Payload, eoi]);
}

async function upload(cookieHeader: string, csrfToken: string, filename: string, mime: string, data: Buffer) {
  const form = new FormData();
  form.append("file", new Blob([data], { type: mime }), filename);
  const resp = await fetch(`${baseUrl}/api/admin/media-assets/upload`, {
    method: "POST",
    headers: { cookie: cookieHeader, "x-csrf-token": csrfToken },
    body: form,
  });
  return { status: resp.status, body: await resp.text() };
}

test("media upload accepts a valid PNG within dimension limits", async () => {
  const admin = await createAdminSession(baseUrl);
  const result = await upload(admin.cookieHeader, admin.csrfToken, "valid.png", "image/png", buildPng(800, 600));
  assert.equal(result.status, 201);
});

test("media upload accepts a valid JPEG within dimension limits", async () => {
  const admin = await createAdminSession(baseUrl);
  const result = await upload(admin.cookieHeader, admin.csrfToken, "valid.jpg", "image/jpeg", buildJpegWithDimensions(1200, 900));
  assert.equal(result.status, 201);
});

test("media upload accepts a real WEBP file", async () => {
  const admin = await createAdminSession(baseUrl);
  const realWebp = fs.readFileSync("public/assets/brand/gamel-icon-1024.webp");
  const result = await upload(admin.cookieHeader, admin.csrfToken, "real.webp", "image/webp", realWebp);
  assert.equal(result.status, 201);
});

test("media upload rejects a PNG exceeding the max pixel dimension", async () => {
  const admin = await createAdminSession(baseUrl);
  const result = await upload(admin.cookieHeader, admin.csrfToken, "huge.png", "image/png", buildPng(20000, 20000));
  assert.equal(result.status, 400);
});

test("media upload rejects a PNG under the dimension cap but over the megapixel cap (decompression-bomb guard)", async () => {
  const admin = await createAdminSession(baseUrl);
  const result = await upload(admin.cookieHeader, admin.csrfToken, "bomb.png", "image/png", buildPng(7000, 7000));
  assert.equal(result.status, 400);
});

test("media upload rejects an oversized JPEG", async () => {
  const admin = await createAdminSession(baseUrl);
  const result = await upload(admin.cookieHeader, admin.csrfToken, "huge.jpg", "image/jpeg", buildJpegWithDimensions(30000, 30000));
  assert.equal(result.status, 400);
});

test("media upload rejects a file with a fake .jpg extension whose content is not really a JPEG (magic-byte guard)", async () => {
  const admin = await createAdminSession(baseUrl);
  const fakeJpeg = Buffer.from("not actually an image, just text pretending to be jpeg");
  const result = await upload(admin.cookieHeader, admin.csrfToken, "fake.jpg", "image/jpeg", fakeJpeg);
  assert.equal(result.status, 400);
});
