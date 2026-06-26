import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { readStoredMedia } from "@/lib/media-storage.server";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const Route = createFileRoute("/api/public/media")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const request = getRequest();
          if (!request) {
            return new Response("Request indisponivel.", { status: 500 });
          }

          const url = new URL(request.url);
          const storagePath = url.searchParams.get("path");
          if (!storagePath) {
            return new Response("Arquivo nao informado.", { status: 400 });
          }

          const bytes = await readStoredMedia(storagePath);
          const contentType =
            MIME_BY_EXTENSION[path.extname(storagePath).toLowerCase()] ||
            "application/octet-stream";

          return new Response(bytes, {
            headers: {
              "content-type": contentType,
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch (error) {
          return new Response((error as Error).message, { status: 404 });
        }
      },
    },
  },
});
