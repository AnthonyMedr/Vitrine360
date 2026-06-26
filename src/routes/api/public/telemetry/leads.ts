import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { persistLeads } from "@/lib/public-telemetry.server";

export const Route = createFileRoute("/api/public/telemetry/leads")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const request = getRequest();
          if (!request) {
            return Response.json({ ok: false, error: "Request indisponivel." }, { status: 500 });
          }

          const body = (await request.json()) as { items?: unknown[] };
          const result = await persistLeads(
            Array.isArray(body?.items) ? body.items : [],
            request.headers.get("user-agent"),
          );

          return Response.json({ ok: true, inserted: result.inserted });
        } catch (error) {
          return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
