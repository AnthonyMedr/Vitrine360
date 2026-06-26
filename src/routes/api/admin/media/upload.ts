import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { requireAdminRequest } from "@/lib/admin-request.server";
import { saveMediaFile } from "@/lib/media-storage.server";

export const Route = createFileRoute("/api/admin/media/upload")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const request = getRequest();
          if (!request) {
            return Response.json({ ok: false, error: "Request indisponivel." }, { status: 500 });
          }

          requireAdminRequest(request.headers);
          const formData = await request.formData();
          const file = formData.get("file");
          const type = String(formData.get("type") || "produto");
          const storeId = String(formData.get("storeId") || "default-store");

          if (!(file instanceof File)) {
            return Response.json({ ok: false, error: "Arquivo nao enviado." }, { status: 400 });
          }

          const bytes = new Uint8Array(await file.arrayBuffer());
          const saved = await saveMediaFile({
            bytes,
            storeId,
            type,
            originalFileName: file.name,
            mimeType: file.type,
          });

          return Response.json({
            ok: true,
            fileName: saved.fileName,
            originalFileName: file.name,
            fileUrl: saved.fileUrl,
            storagePath: saved.storagePath,
            mimeType: file.type,
            size: saved.size,
          });
        } catch (error) {
          return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
