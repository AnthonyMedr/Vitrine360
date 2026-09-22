import { createId, hashPassword, initializeDb, readDb, waitForPendingDbWrites, writeDb } from "../server/db";

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

const defaultEmail = "admin@gamelmetal.com";
const defaultPassword = "admin123";
const email = (getArg("email") || process.env.ADMIN_EMAIL || defaultEmail).trim().toLowerCase();
const password = getArg("password") || process.env.ADMIN_PASSWORD || defaultPassword;
const resetPassword = !hasFlag("no-reset-password");
const envName = String(process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
const isProductionLike = ["production", "prod", "staging", "homologation"].includes(envName);

if (!email || !email.includes("@")) {
  throw new Error("Informe um e-mail valido em --email= ou ADMIN_EMAIL.");
}

if (!password || password.trim().length < 8) {
  throw new Error("A senha do admin deve ter pelo menos 8 caracteres.");
}

if (isProductionLike && (password === defaultPassword || /^troque-/i.test(password) || /^__SET_/i.test(password) || password.length < 12)) {
  throw new Error("Em ambiente production-like, informe uma senha forte com ADMIN_PASSWORD ou --password=.");
}

await initializeDb();

const db = readDb();
const now = new Date().toISOString();
const fullName = (process.env.ADMIN_NAME || "Administrador GAMEL Metal").trim();
const existing = db.users.find((user) => user.email.toLowerCase() === email);

if (existing) {
  existing.role = "admin";
  existing.user_metadata = {
    ...existing.user_metadata,
    full_name: existing.user_metadata?.full_name || fullName,
    store_id: existing.user_metadata?.store_id || "garanhuns",
    store_name: existing.user_metadata?.store_name || "Showroom Garanhuns",
    can_start_assisted_sale: true,
    permission_profile_id: "administrador",
  };
  if (resetPassword || !existing.password_hash || !existing.password_salt) {
    const hashed = hashPassword(password);
    existing.password_hash = hashed.hash;
    existing.password_salt = hashed.salt;
  }
} else {
  const hashed = hashPassword(password);
  db.users.unshift({
    id: createId(),
    email,
    password_hash: hashed.hash,
    password_salt: hashed.salt,
    role: "admin",
    is_active: true,
    user_metadata: {
      full_name: fullName,
      store_id: "garanhuns",
      store_name: "Showroom Garanhuns",
      can_start_assisted_sale: true,
      permission_profile_id: "administrador",
    },
  });
}

const adminUser = db.users.find((user) => user.email.toLowerCase() === email);
if (!adminUser) {
  throw new Error("Falha ao criar admin.");
}

const seller = db.sellers.find((entry) => entry.user_id === adminUser.id);
if (seller) {
  seller.display_name = seller.display_name || fullName;
  seller.role_label = "manager";
  seller.is_active = true;
  seller.primary_store_id = seller.primary_store_id || "garanhuns";
  seller.allowed_store_ids = Array.from(new Set([...(seller.allowed_store_ids || []), "garanhuns"]));
} else {
  db.sellers.unshift({
    id: createId(),
    user_id: adminUser.id,
    seller_code: "SELLER-ADMIN",
    display_name: fullName,
    role_label: "manager",
    is_active: true,
    primary_store_id: "garanhuns",
    allowed_store_ids: ["garanhuns"],
    created_at: now,
  });
}

db.auditLogs.unshift({
  event_id: createId(),
  event_type: "admin.bootstrap_user",
  occurred_at: now,
  correlation_id: createId(),
  actor_id: adminUser.id,
  actor_name: adminUser.email,
  source_channel: "integration",
  order_id: null,
  previous_value: null,
  new_value: {
    email,
    role: "admin",
    reset_password: resetPassword,
    permission_profile_id: "administrador",
  },
  payload: {
    script: "scripts/bootstrap-admin-user.ts",
    environment: envName,
  },
});

writeDb(db);
await waitForPendingDbWrites();

console.log("Admin pronto para uso.");
console.log(`Portal local: http://localhost:8082/admin`);
console.log(`Auth local: http://localhost:8082/auth`);
console.log(`Usuario: ${email}`);
console.log(password === defaultPassword ? "Senha local de fixture aplicada; use ADMIN_PASSWORD/--password para trocar antes de qualquer homologacao." : "Senha: definida por ADMIN_PASSWORD/--password e nao exibida.");
