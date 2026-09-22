import { initializeDb, readDb, writeDb } from "../server/db";

function hasZipCode(zipCode: string | null | undefined) {
  return Boolean(String(zipCode || "").replace(/\D/g, ""));
}

await initializeDb();
const apply = process.argv.includes("--apply");
const db = readDb();
const issues = db.deliveryZones
  .filter((zone) => zone.is_active && zone.delivery_enabled && !hasZipCode(zone.zip_code))
  .map((zone) => ({
    id: zone.id,
    city: zone.city,
    state: zone.state,
    neighborhood: zone.neighborhood,
    zip_code: zone.zip_code,
    delivery_fee: zone.delivery_fee,
    estimated_days: zone.estimated_days,
    issue: "active_delivery_zone_without_zip_code",
    recommended_action: "Desativar delivery_enabled ate informar CEP/prefixo valido para a zona.",
  }));

if (apply && issues.length > 0) {
  const issueIds = new Set(issues.map((issue) => issue.id));
  const now = new Date().toISOString();
  db.deliveryZones.forEach((zone) => {
    if (!issueIds.has(zone.id)) return;
    zone.delivery_enabled = false;
    zone.notes = `${zone.notes ? `${zone.notes} | ` : ""}Desativada automaticamente em ${now}: zona ativa sem CEP/prefixo valido.`;
  });
  writeDb(db);
}

console.log(
  JSON.stringify(
    {
      ok: issues.length === 0,
      applied: apply,
      total_zones: db.deliveryZones.length,
      active_enabled_zones: db.deliveryZones.filter((zone) => zone.is_active && zone.delivery_enabled).length,
      issues_count: issues.length,
      issues,
      next_steps:
        issues.length === 0
          ? ["Manter auditoria de zonas antes do soft launch regional."]
          : [
              "Executar npm run delivery-zones:remediate para desativar zonas sem CEP.",
              "Cadastrar CEP/prefixo real antes de reativar qualquer zona local.",
            ],
    },
    null,
    2,
  ),
);

if (issues.length > 0 && !apply) {
  process.exitCode = 1;
}
