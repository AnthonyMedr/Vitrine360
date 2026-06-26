import { createServerFn } from "@tanstack/react-start";
import {
  matchesBootstrapCredentials,
  readBootstrapEmail,
  requireBootstrapToken,
} from "@/lib/bootstrap-admin.server";

export const loginAdmin = createServerFn({ method: "POST" })
  .validator((input: { email?: string; password?: string } | undefined) => ({
    email: typeof input?.email === "string" ? input.email.trim().toLowerCase() : "",
    password: typeof input?.password === "string" ? input.password : "",
  }))
  .handler(async ({ data }) => {
    if (!matchesBootstrapCredentials(data.email, data.password)) {
      throw new Error("Credenciais administrativas invalidas.");
    }

    return {
      ok: true,
      token: requireBootstrapToken(),
      email: readBootstrapEmail(),
    };
  });
