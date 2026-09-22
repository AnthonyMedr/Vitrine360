import type { DatabaseShape, DbSiteContent } from "./db";
import { createAuditEvent } from "./order-domain";

export function applySiteContentUpdate(input: {
  db: DatabaseShape;
  body: Partial<DbSiteContent>;
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  const previousValue = {
    operational_messages: db.siteContent.operational_messages,
    featured_category_ids: db.siteContent.featured_category_ids,
    go_live_product_ids: db.siteContent.go_live_product_ids,
  };
  db.siteContent = {
    ...db.siteContent,
    ...body,
    operational_messages: {
      ...db.siteContent.operational_messages,
      ...(body.operational_messages || {}),
    },
    banners: Array.isArray(body.banners) ? body.banners : db.siteContent.banners,
    pages: Array.isArray(body.pages) ? body.pages : db.siteContent.pages,
    featured_category_ids: Array.isArray(body.featured_category_ids) ? body.featured_category_ids : db.siteContent.featured_category_ids,
    go_live_product_ids: Array.isArray(body.go_live_product_ids) ? body.go_live_product_ids : db.siteContent.go_live_product_ids,
    trust_badges: Array.isArray(body.trust_badges) ? body.trust_badges : db.siteContent.trust_badges,
  };
  createAuditEvent(db, {
    eventType: "content.updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: {
      operational_messages: db.siteContent.operational_messages,
      featured_category_ids: db.siteContent.featured_category_ids,
      go_live_product_ids: db.siteContent.go_live_product_ids,
    },
  });
  return db.siteContent;
}
