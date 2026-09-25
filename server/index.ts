import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import express from "express";
import compression from "compression";
import cors from "cors";
import multer from "multer";
import { calculateCommercialLine } from "../src/lib/commercial-calculation";
import {
  createId,
  createSessionToken,
  dataDir,
  type DbAuditLog,
  type DbCategory,
  getSessionExpiry,
  getDbRuntimeStatus,
  closeDbResources,
  hashPassword,
  initializeDb,
  readDb,
  verifyPassword,
  withRelations,
  writeDb,
  type DbPaymentRecord,
  type DbBrand,
  type DatabaseShape,
  type DbCoupon,
  type DeliveryType,
  type DbDeliveryZone,
  type DbFreightCarrier,
  type DbOrder,
  type DbOrderItem,
  type DbProduct,
  type DbCustomerProfile,
  type DbLead,
  type DbQuote,
  type DbQuoteItem,
  type DbSeller,
  type DbSiteContent,
  type DbStore,
  type OrderOrigin,
  type OrderType,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type SourceActor,
  type SourceChannel,
  type DbCommercialSettings,
  type DbCatalogStagingItem,
  type DbEstablishment,
  type DbFiscalDocument,
  type DbFiscalProfile,
  type DbInventoryLot,
  type DbInventoryMovement,
  type DbCampaignLandingPage,
  type DbContentSnippet,
  type DbEcommerceTheme,
  type DbIntegrationProvider,
  type DbMarketingBanner,
  type DbMarketingCampaign,
  type DbMarketingCard,
  type DbMarketingEvent,
  type DbMarketingAsset,
  type DbProductShowcase,
  type DbOrderOperation,
  type OrderOperationStage,
} from "./db";
import { appConfig, assertProductionConfiguration, isProductionLike, resolvePublicUrl } from "./config";
import {
  alignCatalogStagingGoLiveGateToLaunchBatch,
  getCatalogLaunchBatch,
  getCatalogPublicationIssues,
  getCatalogStagingSummary,
  getCatalogStagingWorkboard,
  refreshCatalogStagingBatch,
  refreshCatalogStagingItem,
} from "./catalog-staging";
import { buildOrderEmail, buildOtpEmail, buildWelcomeEmail, sendEmail } from "./integrations/email";
import { trackServerEvent } from "./integrations/analytics";
import { createProviderPaymentIntent, fetchMercadoPagoPayment, mapMercadoPagoStatus } from "./integrations/payment";
import { freightService } from "./freight-service";
import { lookupBrazilianAddressByCep } from "./integrations/address";
import { lookupBrazilianCompanyByCnpj } from "./integrations/company";
import { applySecurityHeaders, attachRequestContext, rateLimit } from "./security";
import { logError, logInfo, logWarn } from "./logger";
import { closeQueueResources, enqueueJob, getQueueStats, registerQueueHandler } from "./async-jobs";
import { runSerializedMutation } from "./mutation";
import { closePostgresPool, isPostgresConfigured } from "./postgres";
import { closeRedisClient, isRedisConfigured } from "./redis";
import {
  checkObjectStorageHealth,
  closeObjectStorage,
  deleteObjectByUrl,
  getObject,
  initializeObjectStorage,
  isRemoteObjectStorage,
  uploadObject,
} from "./object-storage";
import { getMetricsSnapshot, incrementBusinessMetric, incrementSecurityMetric, recordHttpMetric, renderPrometheusMetrics } from "./observability";
import {
  getDatabaseProviderStatus,
  getErpProviderStatus,
  getFiscalProviderStatus,
  getFreightProviderStatus,
  getIntegrationOverview,
  getPaymentProviderStatus,
  getRedisProviderStatus,
  isAnalyticsProviderReady,
  isErpProviderReady,
  isEmailProviderReady,
  isFiscalProviderReady,
  isFreightProviderReady,
  isPaymentProviderReady,
} from "./runtime-overview";
import { getGoLiveReadinessReport } from "./go-live-readiness";
import { buildHomologationPack } from "./homologation-pack";
import { getPhase1ReadinessReport } from "./phase1-readiness";
import { getPhase2ReadinessReport } from "./phase2-readiness";
import { getReleaseReadinessReport } from "./release-readiness";
import { getSecurityReadinessReport } from "./security-readiness";
import { getOperationReadinessReport } from "./operation-readiness";
import { applyOperationAutoRemediation } from "./operation-remediation";
import { applyFiscalAutoRemediation } from "./fiscal-remediation";
import { applyFiscalDocumentAutoRemediation } from "./fiscal-document-remediation";
import { buildFiscalEnterprisePlan } from "./fiscal-enterprise-plan";
import { getFreightCatalogReadinessReport } from "./freight-catalog-readiness";
import { buildOrderFreightProfile } from "./freight-carrier-recommendation";
import { getPublicApiRuntimeStatus } from "./public-api-runtime";
import { toPublicProductDTO } from "./public-product";
import { activeModuleRegistry, isModuleEnabled } from "./platform";
import {
  canAdminAccessModule,
  canAdminPerform,
  getPermissionProfile,
  getPermissionProfiles,
  normalizePermissionProfileId,
  type AdminModuleKey,
  type AdminModuleAccess,
  type AdminPermission,
} from "./admin-permissions";
import {
  buildPaymentIntent,
  createAuditEvent,
  createPaymentRecord,
  getOrderPaymentView,
  inferPaymentStatus,
  resolveOrderClassification,
  validateClassification,
} from "./order-domain";
import {
  createMarketingCampaign,
  createMarketingEvent,
  createOrUpdateMarketingAsset,
  createOrUpdateMarketingCoupon,
  createOrUpdateMarketingEntity,
  duplicateMarketingCampaign,
  getCampaignLandingPageBySlug,
  getCampaignPublicationReadiness,
  getMarketingOverview,
  getMarketingReadiness,
  getMarketingReports,
  getMarketingReportsCsv,
  getPublicMarketingState,
  getIntegrationProviderDetail,
  getIntegrationReadiness,
  listIntegrationProviders,
  approveIntegrationProductionActivation,
  requestIntegrationProductionActivation,
  saveIntegrationSecret,
  setMarketingCampaignStatus,
  testIntegrationProvider,
  updateMarketingCampaign,
} from "./marketing-operations";
import { canAccessOrder } from "./order-access";
import {
  applyAdminOrderManualAction,
  applyAdminOrderShipmentUpdate,
  applyAdminOrderStatusTransition,
  cancelFiscalDocumentsForOrder,
  isValidOrderStatus,
  restoreInventory,
  settleInventoryForOrder,
  validOrderStatuses,
} from "./order-operations";
import { applyFiscalDocumentGoLiveGateUpdate, applyFiscalDocumentStatusUpdate, validFiscalDocumentStatuses } from "./fiscal-operations";
import {
  advanceOrderOperationStage,
  assignOrderOperationOwner,
  buildOperationActionCenterItems,
  ensureOrderOperationState,
  getOrderOperationState,
  listOrderOperationStates,
  markOrderOperationStuck,
  resolveOrderOperationStuck,
  serializeOrderOperationState,
} from "./order-operation-state";
import {
  approveFiscalAiSuggestion,
  exportApprovedFiscalAiClosePack,
  generateFiscalAiSuggestion,
  getFiscalAiQueue,
  refreshFiscalNcmCache,
  rejectFiscalAiSuggestion,
} from "./fiscal-ai-assistant";
import { getAiUsageOverview } from "./ai-governance";
import { getAdminCatalogImageAudit } from "./catalog-image-audit";
import { getAdminProductQualityScore, getAdminCatalogPimReadiness } from "./product-pim";
import { applyMediaLibraryReview, getAdminMediaLibrary, getAdminMediaUsageMap } from "./media-library";
import { getCommercialErpCockpit } from "./commercial-erp-cockpit";
import { applyInventoryTransfer } from "./inventory-operations";
import {
  assignPickingTask,
  completePickingTask,
  confirmPickingTaskItem,
  createPickingTask,
  createStockMovement,
  getAdminWmsInventoryHealth,
  getAdminWmsPickingQueue,
  getAdminWmsSummary,
  startPickingTask,
} from "./wms-operations";
import { convertQuoteToAssistedOrder, createQuoteWithLead } from "./quote-operations";
import {
  assignQuoteRequestResponsible,
  createPublicQuoteRequest,
  createQuoteRequestNote,
  getQuoteRequestAdminDetail,
  hasUnsafeQuoteRequestPayload,
  listQuoteRequestAdminRows,
  normalizeQuoteRequestInput,
  quoteRequestStatuses,
  serializeQuoteRequest,
  updateQuoteRequestNextAction,
  updateQuoteRequestStatus,
  type QuoteRequestStatus,
} from "./quote-request-operations";
import { generateQuoteRequestPdf } from "./quote-pdf";
import { applyCustomerProfileUpdate, createCartAbandonmentLead, getOrCreateCustomerProfile } from "./customer-domain";
import { createAdminLead, updateAdminLead } from "./lead-operations";
import { applySiteContentUpdate } from "./content-operations";
import {
  buildSellerView,
  createAdminBrand,
  createDeliveryZone,
  createFreightCarrier,
  createSeller,
  createStore,
  updateAdminBrand,
  updateAdminCategory,
  updateCommercialSettings,
  updateDeliveryZone,
  updateFreightCarrier,
} from "./admin-setup-operations";
import { applyAdminReturnStatusUpdate, applyAdminTicketStatusUpdate, listAdminReturnRequests, listAdminSupportTickets } from "./customer-center-operations";
import { getAdminOrderReconciliation, getAdminReconciliationDailyReport, getAdminReconciliationSummary } from "./reconciliation-operations";
import { buildAssistedTrainingPlan } from "./admin-training-assistant";
import { getAdminHomologationEvidenceStatus } from "./admin-homologation-evidence";
import { buildAdminControlCenter, renderAdminControlCenterCsv, renderAdminControlCenterMarkdown } from "./admin-control-center";
import { getAdminProgrammaticCompletion, renderAdminProgrammaticCompletionMarkdown } from "./admin-programmatic-completion";
import {
  buildAdminDailyManagement,
  buildAdminKanban,
  buildAdminManagementCockpit,
  buildAdminManagementReports,
  buildAdminManagementScore,
  buildAdminManagementTasks,
  getAdminManagementTaskEvents,
  renderAdminManagementTasksCsv,
  renderAdminManagementReportMarkdown,
  upsertAdminManagementTask,
} from "./admin-management";
import {
  applyGenericPaymentWebhookMutation,
  applyMercadoPagoWebhookMutation,
  applyOrderPaymentAction,
  ensureFiscalDocumentForOrder,
  type GenericPaymentWebhookInput,
  validateGenericWebhookSignature,
  validateMercadoPagoWebhookSignature,
} from "./payment-domain";
import {
  getAdminFiscalOverview,
  getAdminFiscalReadiness,
  getAdminFiscalWorkboard,
  listAdminBrands,
  listAdminCatalogStaging,
  listAdminCategories,
  listAdminDeliveryZones,
  listAdminFreightCarriers,
  listAdminFiscalDocuments,
  listAdminFiscalProfiles,
  listAdminInventoryLots,
  listAdminInventoryMovements,
  listAdminLeads,
  listAdminOrders,
  listAdminPayments,
  listAdminProducts,
  listAdminQuoteItems,
  listAdminQuotes,
  listAdminStores,
  listOrderItems,
  listOrderAuditLogs,
  listUserOrders,
  getTrackedOrderView,
} from "./read-models";

const app = express();
const port = appConfig.apiPort;
const appEnv = appConfig.env;
const sessionCookieName = "gamel_session";
const csrfCookieName = appConfig.auth.csrfCookieName;
const legacyCsrfCookieName = "lojao_csrf";
const csrfHeaderName = appConfig.auth.csrfHeaderName.toLowerCase();
const distDir = path.resolve(process.cwd(), "dist");
const hasDist = fs.existsSync(distDir);
const validOrderTypes: OrderType[] = ["normal", "assisted", "pickup"];
const validOrderOrigins: OrderOrigin[] = ["ecommerce", "showroom", "whatsapp", "instagram", "marketplace", "integration"];
const validSourceChannels: SourceChannel[] = ["web", "store", "whatsapp", "instagram", "integration"];
const validSourceActors: SourceActor[] = ["human", "bot", "system"];
const validPaymentMethods: PaymentMethod[] = ["credit_card", "boleto", "pix", "cash", "payment_link", "store_pos"];
const configuredPaymentProvider = appConfig.paymentProvider;

app.disable("x-powered-by");
if (appConfig.trustProxy) app.set("trust proxy", true);
app.use(compression());
app.use(attachRequestContext);
app.use(applySecurityHeaders);
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    recordHttpMetric({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
    logInfo({
      event: "http.request",
      module: "http",
      requestId: res.locals.requestId ?? null,
      data: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      },
    });
  });
  next();
});
app.use("/api", (req, res, next) => {
  const normalizedOrigin = req.header("origin")?.toLowerCase();
  if (!normalizedOrigin || appConfig.corsOrigins.includes(normalizedOrigin)) {
    next();
    return;
  }
  res.status(403).json(buildError("Origin nao permitida pelo CORS"));
});
app.use(
  "/api",
  cors({
    origin(origin, callback) {
      const normalizedOrigin = origin?.toLowerCase();
      if (!normalizedOrigin || appConfig.corsOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-CSRF-Token", "Idempotency-Key"],
    optionsSuccessStatus: 204,
  }),
);
app.use(
  express.json({
    verify(req, _res, buffer) {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  }),
);
app.use((req, res, next) => {
  const sessionToken = getToken(req);
  setCsrfCookie(req, res, sessionToken);
  next();
});
app.use(requireCsrf);
app.use("/api/admin", rateLimit({ windowMs: appConfig.rateLimit.adminWindowMs, max: appConfig.rateLimit.adminMax, message: "Muitas requisicoes administrativas em pouco tempo" }));

registerQueueHandler("email.send", async (payload) => {
  await sendEmail(payload as unknown as Parameters<typeof sendEmail>[0]);
});

registerQueueHandler("analytics.track", async (payload) => {
  await trackServerEvent(payload as Parameters<typeof trackServerEvent>[0]);
});

const uploadsDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (isRemoteObjectStorage()) {
  app.get(/^\/uploads\/(.+)$/, async (req, res) => {
    try {
      const object = await getObject(String(req.params[0]));
      if (!object?.Body) {
        res.status(404).end();
        return;
      }
      if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
      if (object.ContentLength !== undefined) res.setHeader("Content-Length", String(object.ContentLength));
      if (object.ETag) res.setHeader("ETag", object.ETag);
      res.setHeader("Cache-Control", object.CacheControl || "public, max-age=604800");
      const body = object.Body as typeof object.Body & { pipe?: (destination: NodeJS.WritableStream) => NodeJS.WritableStream };
      if (typeof body.pipe === "function") {
        body.pipe(res);
        return;
      }
      res.send(Buffer.from(await body.transformToByteArray()));
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (statusCode === 404 || statusCode === 403) {
        res.status(404).end();
        return;
      }
      logError({ event: "storage.object_read_failed", module: "storage", error });
      res.status(502).json(buildError("Nao foi possivel carregar a imagem."));
    }
  });
} else {
  app.use("/uploads", express.static(uploadsDir, { maxAge: isProductionLike() ? "7d" : 0 }));
}

const UPLOAD_MAX_BYTES = appConfig.storage.uploadMaxBytes;
const UPLOAD_ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const UPLOAD_ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function detectImageSignature(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

const IMAGE_SIGNATURE_BY_EXT: Record<string, "jpeg" | "png" | "webp"> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
};

function validateUploadedImageMagicBytes(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  return detectImageSignature(buffer.subarray(0, 12));
}

const UPLOAD_MAX_IMAGE_DIMENSION_PX = 8000;
const UPLOAD_MAX_IMAGE_MEGAPIXELS = 40_000_000;

function readImageDimensions(buffer: Buffer, signature: "jpeg" | "png" | "webp"): { width: number; height: number } | null {
  if (signature === "png") {
    if (buffer.length < 24) return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (signature === "jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const isSofMarker = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSofMarker) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      offset += 2 + segmentLength;
    }
    return null;
  }

  // webp
  if (buffer.length < 30) return null;
  const fourCc = buffer.toString("ascii", 12, 16);
  if (fourCc === "VP8X") {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }
  if (fourCc === "VP8L" && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (fourCc === "VP8 ") {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  return null;
}

function validateUploadedImageDimensions(buffer: Buffer, signature: "jpeg" | "png" | "webp"): boolean {
  const dimensions = readImageDimensions(buffer.subarray(0, 65536), signature);
    if (!dimensions) {
      // Could not determine dimensions from the header we read (e.g. an unusual but
      // legitimately-signed variant) — no server-side image processing exists today,
      // so we allow it through rather than reject a possibly-valid upload.
      return true;
    }
    if (dimensions.width <= 0 || dimensions.height <= 0) return false;
    if (dimensions.width > UPLOAD_MAX_IMAGE_DIMENSION_PX || dimensions.height > UPLOAD_MAX_IMAGE_DIMENSION_PX) return false;
    if (dimensions.width * dimensions.height > UPLOAD_MAX_IMAGE_MEGAPIXELS) return false;
    return true;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extFromName = path.extname(file.originalname).toLowerCase();
    if (!UPLOAD_ALLOWED_MIME[file.mimetype] && !UPLOAD_ALLOWED_EXT.has(extFromName)) {
      cb(new Error("Formato nao suportado. Use JPG, PNG ou WEBP."));
      return;
    }
    cb(null, true);
  },
});

function uploadedImageContentType(signature: "jpeg" | "png" | "webp") {
  return signature === "jpeg" ? "image/jpeg" : `image/${signature}`;
}

function uploadedImageExtension(signature: "jpeg" | "png" | "webp") {
  return signature === "jpeg" ? ".jpg" : `.${signature}`;
}

function uploadErrorMessage(error: unknown) {
  if (error instanceof multer.MulterError) {
    return error.code === "LIMIT_FILE_SIZE"
      ? `Arquivo maior que ${Math.floor(UPLOAD_MAX_BYTES / 1024 / 1024)}MB.`
      : error.message;
  }
  return error instanceof Error ? error.message : "Falha no upload.";
}

app.post("/api/admin/products/image-upload", requireAnyAdminPermission(["catalog.edit", "products.media_manage"]), (req, res) => {
  imageUpload.single("file")(req, res, async (error: unknown) => {
    if (error) {
      res.status(400).json(buildError(uploadErrorMessage(error)));
      return;
    }
    if (!req.file) {
      res.status(400).json(buildError("Nenhum arquivo enviado."));
      return;
    }
    const imageSignature = validateUploadedImageMagicBytes(req.file.buffer);
    if (!imageSignature) {
      res.status(400).json(buildError("Arquivo nao corresponde a uma imagem JPG, PNG ou WEBP valida."));
      return;
    }
    if (!validateUploadedImageDimensions(req.file.buffer, imageSignature)) {
      res.status(400).json(buildError("Dimensoes da imagem excedem o limite permitido."));
      return;
    }
    try {
      const base = slugify(String(req.body?.slug || req.query.slug || "produto")) || "produto";
      const key = `products/${base}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${uploadedImageExtension(imageSignature)}`;
      const stored = await uploadObject({
        key,
        body: req.file.buffer,
        contentType: uploadedImageContentType(imageSignature),
        originalName: req.file.originalname,
      });
      res.status(201).json({ url: stored.url, key: stored.key });
    } catch (uploadError) {
      logError({ event: "storage.product_upload_failed", module: "storage", error: uploadError });
      res.status(503).json(buildError("Storage de imagens indisponivel."));
    }
  });
});

app.post("/api/admin/media-assets/upload", requireAnyAdminPermission(["catalog.edit", "products.media_manage", "marketing.manage"]), (req, res) => {
  imageUpload.single("file")(req, res, async (error: unknown) => {
    if (error) {
      res.status(400).json(buildError(uploadErrorMessage(error)));
      return;
    }
    if (!req.file) {
      res.status(400).json(buildError("Nenhum arquivo enviado."));
      return;
    }
    const imageSignature = validateUploadedImageMagicBytes(req.file.buffer);
    if (!imageSignature) {
      res.status(400).json(buildError("Arquivo nao corresponde a uma imagem JPG, PNG ou WEBP valida."));
      return;
    }
    if (!validateUploadedImageDimensions(req.file.buffer, imageSignature)) {
      res.status(400).json(buildError("Dimensoes da imagem excedem o limite permitido."));
      return;
    }
    const base = slugify(String(req.body?.name || "midia")) || "midia";
    const key = `media/${base}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${uploadedImageExtension(imageSignature)}`;
    let stored: Awaited<ReturnType<typeof uploadObject>>;
    try {
      stored = await uploadObject({
        key,
        body: req.file.buffer,
        contentType: uploadedImageContentType(imageSignature),
        originalName: req.file.originalname,
      });
    } catch (uploadError) {
      logError({ event: "storage.media_upload_failed", module: "storage", error: uploadError });
      res.status(503).json(buildError("Storage de imagens indisponivel."));
      return;
    }
    const context = getMarketingMutationContext(res);
    const result = await runSerializedMutation("admin.media_asset.upload", () => {
      const db = readDb();
      const asset = createOrUpdateMarketingAsset(
        db,
        {
          name: String(req.body?.name || req.file!.originalname || "Novo asset"),
          type: "image",
          url: stored.url,
          alt_text: req.body?.alt_text ? String(req.body.alt_text) : null,
          usage: (req.body?.usage as DbMarketingAsset["usage"]) || "other",
          status: "active",
          metadata_json: {
            size_bytes: stored.sizeBytes,
            original_filename: req.file!.originalname,
            storage_key: stored.key,
            checksum_sha256: stored.checksumSha256,
            etag: stored.etag,
          },
          created_by: context.actorId,
          updated_by: context.actorId,
        },
        context,
      );
      writeDb(db);
      return { status: 201, payload: asset };
    }).catch(async (mutationError: Error) => {
      await deleteObjectByUrl(stored.url).catch(() => undefined);
      return { status: 400, payload: buildError(mutationError.message) };
    });
    res.status(result.status).json(result.payload);
  });
});

app.delete("/api/admin/marketing/assets/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const result = await runSerializedMutation("admin.marketing.asset.delete", () => {
    const db = readDb();
    const index = db.marketingAssets.findIndex((entry) => entry.id === String(req.params.id));
    if (index === -1) return { status: 404, payload: buildError("Asset nao encontrado."), removedUrl: null };
    const [removed] = db.marketingAssets.splice(index, 1);
    writeDb(db);
    return { status: 204, payload: null, removedUrl: removed?.url ?? null };
  });
  if (result.status === 204) {
    await deleteObjectByUrl(result.removedUrl).catch((error) => {
      logError({ event: "storage.media_delete_failed", module: "storage", error, data: { url: result.removedUrl } });
    });
    res.status(204).end();
    return;
  }
  res.status(result.status).json(result.payload);
});

if (hasDist) {
  app.use(express.static(distDir, {
    maxAge: isProductionLike() ? "7d" : 0,
    immutable: isProductionLike(),
    setHeaders(res, filePath) {
      if (/\.(?:html)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
        return;
      }
      if (/\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", isProductionLike() ? "public, max-age=604800, immutable" : "public, max-age=60");
      }
    },
  }));
}

function sanitizeUser(user: Record<string, unknown>) {
  const { password_hash, password_salt, session_token, session_expires_at, ...safeUser } = user;
  return safeUser;
}

function getUserPermissionProfileId(user: { role?: unknown; user_metadata?: Record<string, unknown> }) {
  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  if (user.role !== "admin") return null;
  const profileId = typeof metadata.permission_profile_id === "string" ? metadata.permission_profile_id.trim() : "";
  return profileId ? normalizePermissionProfileId(profileId) : null;
}

function isAdminUserAllowed(user: ReturnType<typeof getCurrentUser>) {
  if (!user || user.role !== "admin") return false;
  if (user.is_active === false) return false;
  return getPermissionProfile(getUserPermissionProfileId(user)).isActive;
}

function createAdminAuditEvent(
  db: DatabaseShape,
  req: express.Request,
  input: {
    eventType: string;
    actor?: ReturnType<typeof getCurrentUser> | null;
    entity?: string;
    entityId?: string | null;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    payload?: Record<string, unknown> | null;
  },
) {
  const actor = input.actor ?? getCurrentUserOptional(req);
  return createAuditEvent(db, {
    eventType: input.eventType,
    correlationId: resLocalsRequestId(req) ?? createId(),
    actorId: actor?.id ?? null,
    actorName: actor?.user_metadata?.full_name ?? actor?.email ?? null,
    sourceChannel: "integration",
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    payload: {
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      ip_address: req.ip ?? null,
      user_agent: req.header("user-agent") ?? null,
      ...(input.payload ?? {}),
    },
  });
}

function resLocalsRequestId(req: express.Request) {
  return (req.res?.locals.requestId as string | undefined) ?? null;
}

function getToken(req: express.Request) {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookieHeader = req.header("cookie");
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${sessionCookieName}=`));
  if (!sessionCookie) return null;
  return decodeURIComponent(sessionCookie.split("=")[1] || "");
}

function getCookieValue(req: express.Request, name: string) {
  const cookieHeader = req.header("cookie");
  if (!cookieHeader) return null;
  const entry = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${name}=`));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(name.length + 1));
}

function createCsrfToken(sessionToken: string | null, requestId: string | null) {
  const base = `${sessionToken || "guest"}:${requestId || "no-request"}`;
  return crypto.createHmac("sha256", appConfig.auth.csrfSecret).update(base).digest("hex");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholderProductImage(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.length === 0 || normalized === "/" || normalized.includes("placeholder.svg") || normalized.includes("placeholder");
}

function hasRealProductImage(item: { image_url?: string | null; images?: string[] | null }) {
  return !isPlaceholderProductImage(item.image_url) || Boolean((item.images ?? []).some((image) => !isPlaceholderProductImage(image)));
}

function isVisualQuarantineNote(value: string | null | undefined) {
  const note = String(value || "");
  return note.includes("Retirado de publicacao") || note.includes("Retirado de publicação");
}

function isProductMediaUnderReview(value: { image_review_status?: string | null; image_review_notes?: string | null }) {
  const reviewStatus = String(value.image_review_status || "").trim().toLowerCase();
  return (
    reviewStatus === "manual_review" ||
    reviewStatus === "suspect" ||
    reviewStatus === "duplicate" ||
    reviewStatus === "broken" ||
    reviewStatus === "missing" ||
    isVisualQuarantineNote(value.image_review_notes)
  );
}

function sanitizePublicProductMedia<T extends { image_url?: string | null; images?: string[] | null; image_review_status?: string | null; image_review_notes?: string | null }>(item: T): T {
  if (!isProductMediaUnderReview(item)) return item;
  return {
    ...item,
    image_url: null,
    images: [],
  };
}

function isProductPubliclyMarketable(item: { is_active: boolean; status_product?: string | null; image_url?: string | null; images?: string[] | null; image_review_notes?: string | null }) {
  return item.is_active && item.status_product !== "draft" && item.status_product !== "inactive" && item.status_product !== "archived" && hasRealProductImage(item) && !isVisualQuarantineNote(item.image_review_notes);
}

function isPublicCatalogCategory(category: { is_active?: boolean }) {
  return Boolean(category.is_active);
}

function isProductReadyForCampaignPublic(
  item: {
    is_active: boolean;
    image_url?: string | null;
    images?: string[] | null;
    image_review_notes?: string | null;
    category_id?: string | null;
    price?: number | null;
    stock?: number | null;
    ncm?: string | null;
    tax_classification_status?: string | null;
    short_description?: string | null;
    description?: string | null;
    application?: string | null;
    material?: string | null;
  },
) {
  return (
    isProductPubliclyMarketable(item) &&
    Boolean(item.category_id) &&
    Number(item.price ?? 0) > 0 &&
    Number(item.stock ?? 0) > 0 &&
    Boolean(item.ncm) &&
    item.tax_classification_status === "ready" &&
    Boolean(item.short_description || item.description) &&
    Boolean(item.application || item.material)
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value: string) {
  return value.trim().length >= appConfig.auth.passwordMinLength;
}

function cleanDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setPublicCatalogCache(res: express.Response) {
  res.setHeader("Cache-Control", isProductionLike() ? "public, max-age=60, stale-while-revalidate=300" : "no-store");
}

function stripControlChars(value: string) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? " " : char;
  }).join("");
}

function sanitizePublicText(value: unknown, maxLength: number) {
  return stripControlChars(String(value ?? ""))
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function hasUnsafePublicPayload(value: unknown) {
  const text = JSON.stringify(value ?? "").toLowerCase();
  return /<\s*script|javascript:|data:text\/html|onerror\s*=|onload\s*=|\bunion\s+select\b|\bdrop\s+table\b/.test(text);
}

function sanitizePageOrigin(value: unknown) {
  const text = sanitizePublicText(value, 300);
  if (!text) return "/orcamento";
  if (text.startsWith("/")) return text;
  try {
    const origin = new URL(text);
    const appOrigin = new URL(appConfig.appBaseUrl).origin;
    return origin.origin === appOrigin ? `${origin.pathname}${origin.search}` : "/orcamento";
  } catch {
    return "/orcamento";
  }
}

function sanitizeUtm(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowedKeys = ["source", "medium", "campaign", "term", "content"];
  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, sanitizePublicText((value as Record<string, unknown>)[key], 120)] as const)
      .filter(([, entry]) => entry.length > 0),
  );
}

function maskPhoneForLog(value: string | null | undefined) {
  const digits = cleanDigits(String(value || ""));
  if (!digits) return null;
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

function parseCsvParam(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildError(message: string) {
  return { error: message };
}

function setSessionCookie(res: express.Response, token: string | null) {
  if (!token) {
    res.setHeader("Set-Cookie", `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return;
  }

  const secure = appConfig.secureCookies || isProductionLike() ? "; Secure" : "";
  const maxAge = 60 * 60 * 24 * appConfig.auth.sessionDays;
  res.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function appendResponseCookie(res: express.Response, cookieValue: string) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", [cookieValue]);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current.map(String), cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [String(current), cookieValue]);
}

function setCsrfCookie(req: express.Request, res: express.Response, sessionToken: string | null) {
  const secure = appConfig.secureCookies || isProductionLike() ? "; Secure" : "";
  const maxAge = 60 * 60 * 24 * appConfig.auth.sessionDays;
  const token = createCsrfToken(sessionToken, res.locals.requestId ?? null);
  appendResponseCookie(res, `${csrfCookieName}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  if (csrfCookieName !== legacyCsrfCookieName) {
    appendResponseCookie(res, `${legacyCsrfCookieName}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  }
  return token;
}

function clearCsrfCookie(res: express.Response) {
  appendResponseCookie(res, `${csrfCookieName}=; Path=/; SameSite=Lax; Max-Age=0`);
  if (csrfCookieName !== legacyCsrfCookieName) {
    appendResponseCookie(res, `${legacyCsrfCookieName}=; Path=/; SameSite=Lax; Max-Age=0`);
  }
}

function queueEmailDelivery(message: Parameters<typeof sendEmail>[0]) {
  enqueueJob({
    id: `email-${message.idempotencyKey || createId()}`,
    queue: "email",
    handler: "email.send",
    payload: message as unknown as Record<string, unknown>,
  });
}

function queueAnalyticsDelivery(input: Parameters<typeof trackServerEvent>[0]) {
  enqueueJob({
    id: `analytics-${createId()}`,
    queue: "analytics",
    handler: "analytics.track",
    payload: input as unknown as Record<string, unknown>,
  });
}

function shouldBypassCsrf(req: express.Request) {
  return req.path.startsWith("/api/auth/") || req.path.startsWith("/api/payments/webhook") || req.path === "/api/public/marketing-events";
}

function requireCsrf(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || shouldBypassCsrf(req)) {
    next();
    return;
  }

  const cookieToken = getCookieValue(req, csrfCookieName) ?? getCookieValue(req, legacyCsrfCookieName);
  const headerToken = req.header(csrfHeaderName);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    incrementSecurityMetric("csrf_rejected");
    logWarn({
      event: "security.csrf_rejected",
      module: "security",
      requestId: res.locals.requestId ?? null,
      data: { path: req.path, method: req.method },
    });
    res.status(403).json(buildError("CSRF token invalido"));
    return;
  }
  next();
}

function getCurrentUser(req: express.Request) {
  const db = readDb();
  const token = getToken(req);
  if (!token) return null;
  return (
    db.users.find((item) => item.session_token === token && item.session_expires_at && new Date(item.session_expires_at) > new Date()) ??
    null
  );
}

function getCurrentUserOptional(req: express.Request) {
  return getCurrentUser(req);
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json(buildError("Nao autenticado"));
    return;
  }
  res.locals.user = user;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json(buildError("Nao autenticado"));
    return;
  }
  if (!isAdminUserAllowed(user)) {
    res.status(403).json(buildError("Acesso negado"));
    return;
  }
  res.locals.user = user;
  next();
}

function requireAdminModule(moduleKey: AdminModuleKey, minimumAccess: Exclude<AdminModuleAccess, "none"> = "view") {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json(buildError("Nao autenticado"));
      return;
    }
    if (!isAdminUserAllowed(user)) {
      res.status(403).json(buildError("Acesso negado"));
      return;
    }

    const profileId = getUserPermissionProfileId(user);
    if (!canAdminAccessModule(profileId, moduleKey, minimumAccess)) {
      res.status(403).json(buildError("Permissao insuficiente para este modulo"));
      return;
    }

    res.locals.user = user;
    next();
  };
}

function requireAdminPermission(permission: AdminPermission) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json(buildError("Nao autenticado"));
      return;
    }
    if (!isAdminUserAllowed(user)) {
      res.status(403).json(buildError("Acesso negado"));
      return;
    }

    const profileId = getUserPermissionProfileId(user);
    if (!canAdminPerform(profileId, permission)) {
      void runSerializedMutation("audit.admin.permission_denied", () => {
        const db = readDb();
        createAdminAuditEvent(db, req, {
          eventType: "admin.permission_denied",
          actor: user,
          entity: "permission",
          entityId: permission,
          payload: { permission, path: req.path, method: req.method },
        });
        writeDb(db);
        return null;
      });
      res.status(403).json(buildError("Permissao insuficiente para esta acao"));
      return;
    }

    res.locals.user = user;
    next();
  };
}

function requireAnyAdminPermission(permissions: AdminPermission[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json(buildError("Nao autenticado"));
      return;
    }
    if (!isAdminUserAllowed(user)) {
      res.status(403).json(buildError("Acesso negado"));
      return;
    }

    const profileId = getUserPermissionProfileId(user);
    if (!permissions.some((permission) => canAdminPerform(profileId, permission))) {
      void runSerializedMutation("audit.admin.permission_denied", () => {
        const db = readDb();
        createAdminAuditEvent(db, req, {
          eventType: "admin.permission_denied",
          actor: user,
          entity: "permission",
          entityId: permissions.join(","),
          payload: { permissions, path: req.path, method: req.method },
        });
        writeDb(db);
        return null;
      });
      res.status(403).json(buildError("Permissao insuficiente para esta acao"));
      return;
    }

    res.locals.user = user;
    next();
  };
}

type AdminManagedUser = DatabaseShape["users"][number];

function buildAdminUserView(user: AdminManagedUser) {
  const profile = getPermissionProfile(getUserPermissionProfileId(user));
  return {
    id: user.id,
    name: user.user_metadata.full_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active !== false,
    profileId: user.user_metadata.permission_profile_id ?? null,
    profileSlug: user.role === "admin" ? profile.slug : null,
    profileName: user.role === "admin" ? profile.name : null,
    level: user.role === "admin" ? profile.level : 0,
    jobTitle: user.user_metadata.job_title ?? null,
    storeId: user.user_metadata.store_id ?? null,
    storeName: user.user_metadata.store_name ?? null,
    canStartAssistedSale: Boolean(user.user_metadata.can_start_assisted_sale),
    createdAt: user.created_at ?? null,
    updatedAt: user.updated_at ?? null,
    lastLoginAt: user.last_login_at ?? null,
  };
}

function countActiveAdminMasters(db: DatabaseShape) {
  return db.users.filter((user) => {
    if (user.role !== "admin" || user.is_active === false) return false;
    return getPermissionProfile(getUserPermissionProfileId(user)).slug === "admin_master";
  }).length;
}

function canManageAdminUser(actor: AdminManagedUser, target: AdminManagedUser, nextProfileId?: string | null) {
  const actorProfile = getPermissionProfile(getUserPermissionProfileId(actor));
  if (actorProfile.permissions.includes("*")) return true;

  const targetLevel = target.role === "admin" ? getPermissionProfile(getUserPermissionProfileId(target)).level : 0;
  const nextLevel = nextProfileId ? getPermissionProfile(nextProfileId).level : targetLevel;
  return actorProfile.level > targetLevel && actorProfile.level > nextLevel;
}

function requireValidAdminProfile(profileId: unknown) {
  if (typeof profileId !== "string") return null;
  const profile = getPermissionProfile(profileId);
  if (!profile.isActive || profile.slug === "__invalid__") return null;
  return profile.slug === profileId || profile.id === profileId || profile.aliases?.includes(profileId) ? profile : null;
}

function assertWebhookAllowed(req: express.Request, res: express.Response, validator: () => boolean, provider: string) {
  if (!validator()) {
    incrementSecurityMetric(`webhook_rejected_${provider}`);
    logWarn({
      event: "security.webhook_rejected",
      module: "security",
      requestId: res.locals.requestId ?? null,
      data: { provider, path: req.path },
    });
    res.status(401).json(buildError("Webhook invalido"));
    return false;
  }
  return true;
}

function canStartAssistedSale(user: Record<string, unknown> | null) {
  if (!user) return false;
  const role = user.role;
  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  return role === "admin" || role === "seller" || metadata.can_start_assisted_sale === true;
}

async function handleCreateOrder(req: express.Request, res: express.Response, input: {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCpf?: string;
  deliveryType?: DeliveryType;
  paymentMethod?: PaymentMethod;
  shippingAddress?: DbOrder["shipping_address"];
  shippingCost?: number;
  notes?: string;
  couponCode?: string;
  correlationId?: string;
  idempotencyKey?: string;
  token?: string;
  status?: OrderStatus;
  orderType?: OrderType;
  orderOrigin?: OrderOrigin;
  sourceChannel?: SourceChannel;
  sourceActor?: SourceActor;
  assistedSale?: boolean;
  sellerId?: string | null;
  sellerName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  showroomStoreId?: string | null;
  showroomStoreName?: string | null;
  deliveryRequired?: boolean;
  pickupAllowed?: boolean;
  assistedSaleNotes?: string | null;
  items?: Array<{
    productId?: string;
    quantity?: number;
    quantityInformedClient?: number;
    quantityCalculatedSystem?: number;
    commercialRuleApplied?: string;
    requestedMeasurement?: number;
    areaDesiredM2?: number;
    totalAreaM2?: number;
    weightDesiredKg?: number;
    totalWeightKg?: number;
    volumeDesiredLiters?: number;
    totalVolumeLiters?: number;
    cubicMetersDesired?: number;
    totalCubicMeters?: number;
    calculatedBoxes?: number;
    calculatedPieces?: number;
    calculatedPackages?: number;
    lossMarginApplied?: number;
    packagingClosed?: boolean;
    openPackageAllowed?: boolean;
    calculationOrigin?: string;
    notes?: string;
    product?: { id?: string };
  }>;
}) {
  if (appConfig.homologationOnly && isProductionLike()) {
    res.status(503).json(buildError("Ambiente em homologacao. Vendas publicas estao bloqueadas."));
    return;
  }

  if (!isNonEmptyString(input.customerName || "")) {
    res.status(400).json(buildError("Informe o nome do cliente"));
    return;
  }
  if (!isNonEmptyString(input.customerEmail || "") || !isValidEmail(input.customerEmail || "")) {
    res.status(400).json(buildError("Informe um e-mail valido"));
    return;
  }
  if (!isNonEmptyString(input.customerPhone || "") || cleanDigits(input.customerPhone || "").length < 10) {
    res.status(400).json(buildError("Informe um telefone valido"));
    return;
  }
  if (!isNonEmptyString(input.customerCpf || "") || cleanDigits(input.customerCpf || "").length < 11) {
    res.status(400).json(buildError("Informe um CPF valido"));
    return;
  }
  if (input.deliveryType !== "pickup" && input.deliveryType !== "delivery") {
    res.status(400).json(buildError("Tipo de entrega invalido"));
    return;
  }
  if (!input.paymentMethod || !validPaymentMethods.includes(input.paymentMethod)) {
    res.status(400).json(buildError("Forma de pagamento invalida"));
    return;
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    res.status(400).json(buildError("O pedido precisa ter ao menos um item"));
    return;
  }

  const classification = resolveOrderClassification(input);
  const storeName = input.storeName ?? input.showroomStoreName ?? null;
  const classificationError = validateClassification(input.deliveryType, input.paymentMethod, classification, input.sellerName, storeName);
  if (classificationError) {
    res.status(400).json(buildError(classificationError));
    return;
  }
  if (input.deliveryType === "delivery") {
    const address = input.shippingAddress;
    const requiredFields = ["street", "number", "neighborhood", "city", "state", "zipCode"] as const;
    if (!address || requiredFields.some((field) => !isNonEmptyString(address[field] || ""))) {
      res.status(400).json(buildError("Endereco de entrega incompleto"));
      return;
    }
  }
  const correlationId = input.correlationId ?? res.locals.requestId ?? createId();
  const idempotencyKey = input.idempotencyKey ?? req.header("idempotency-key") ?? null;
  const sessionUser = getCurrentUser(req);
  const token = input.token ?? null;

  const normalizedItems = (input.items || []).map((item) => ({
    productId: item.productId || item.product?.id || "",
    quantity: Number(item.quantity || 0),
    quantityInformedClient: item.quantityInformedClient ? Number(item.quantityInformedClient) : null,
    quantityCalculatedSystem: item.quantityCalculatedSystem ? Number(item.quantityCalculatedSystem) : null,
    commercialRuleApplied: item.commercialRuleApplied?.trim() || null,
    requestedMeasurement: item.requestedMeasurement ? Number(item.requestedMeasurement) : null,
    areaDesiredM2: item.areaDesiredM2 ? Number(item.areaDesiredM2) : null,
    totalAreaM2: item.totalAreaM2 ? Number(item.totalAreaM2) : null,
    weightDesiredKg: item.weightDesiredKg ? Number(item.weightDesiredKg) : null,
    totalWeightKg: item.totalWeightKg ? Number(item.totalWeightKg) : null,
    volumeDesiredLiters: item.volumeDesiredLiters ? Number(item.volumeDesiredLiters) : null,
    totalVolumeLiters: item.totalVolumeLiters ? Number(item.totalVolumeLiters) : null,
    cubicMetersDesired: item.cubicMetersDesired ? Number(item.cubicMetersDesired) : null,
    totalCubicMeters: item.totalCubicMeters ? Number(item.totalCubicMeters) : null,
    calculatedBoxes: item.calculatedBoxes ? Number(item.calculatedBoxes) : null,
    calculatedPieces: item.calculatedPieces ? Number(item.calculatedPieces) : null,
    calculatedPackages: item.calculatedPackages ? Number(item.calculatedPackages) : null,
    lossMarginApplied: item.lossMarginApplied ? Number(item.lossMarginApplied) : null,
    packagingClosed: typeof item.packagingClosed === "boolean" ? item.packagingClosed : null,
    openPackageAllowed: typeof item.openPackageAllowed === "boolean" ? item.openPackageAllowed : null,
    calculationOrigin: item.calculationOrigin?.trim() || null,
    notes: item.notes?.trim() || null,
  }));

  try {
    const result = await runSerializedMutation("order.create", () => {
      const db = readDb();
      const duplicatedOrder = db.orders.find((item) => item.correlation_id === correlationId || (idempotencyKey && item.idempotency_key === idempotencyKey));
      if (duplicatedOrder) {
        incrementBusinessMetric("orders.duplicated");
        return {
          duplicated: true,
          order: duplicatedOrder,
          orderItems: db.orderItems.filter((item) => item.order_id === duplicatedOrder.id),
        };
      }

      const productRows = normalizedItems.map((item) => {
        const product = db.products.find((entry) => entry.id === item.productId && entry.is_active);
        const calculation = product
          ? calculateCommercialLine(product, {
              quantity: item.quantityInformedClient ?? item.quantity,
              requestedMeasurement: item.requestedMeasurement,
              areaDesiredM2: item.areaDesiredM2,
              weightDesiredKg: item.weightDesiredKg,
              volumeDesiredLiters: item.volumeDesiredLiters,
              cubicMetersDesired: item.cubicMetersDesired,
              lossMargin: item.lossMarginApplied,
            })
          : null;

        return {
          product,
          quantity: calculation?.operationalQuantity ?? item.quantity,
          quantityInformedClient: calculation?.quantityInformadaCliente ?? item.quantityInformedClient ?? item.quantity,
          quantityCalculatedSystem: calculation?.quantityCalculatedSystem ?? item.quantityCalculatedSystem ?? item.quantity,
          commercialRuleApplied: calculation?.commercialRuleApplied ?? item.commercialRuleApplied,
          requestedMeasurement: calculation?.requestedMeasurement ?? item.requestedMeasurement,
          areaDesiredM2: calculation?.areaInformedM2 ?? item.areaDesiredM2,
          totalAreaM2: calculation?.totalAreaM2 ?? item.totalAreaM2,
          weightDesiredKg: calculation?.weightInformedKg ?? item.weightDesiredKg,
          totalWeightKg: calculation?.totalWeightKg ?? item.totalWeightKg,
          volumeDesiredLiters: calculation?.volumeInformedLiters ?? item.volumeDesiredLiters,
          totalVolumeLiters: calculation?.totalVolumeLiters ?? item.totalVolumeLiters,
          cubicMetersDesired: calculation?.cubicMetersInformed ?? item.cubicMetersDesired,
          totalCubicMeters: calculation?.totalCubicMeters ?? item.totalCubicMeters,
          calculatedBoxes: calculation?.calculatedBoxes ?? item.calculatedBoxes,
          calculatedPieces: calculation?.calculatedPieces ?? item.calculatedPieces,
          calculatedPackages: calculation?.calculatedPackages ?? item.calculatedPackages,
          lossMarginApplied: calculation?.lossMarginApplied ?? item.lossMarginApplied,
          packagingClosed: calculation?.packagingClosed ?? item.packagingClosed,
          openPackageAllowed: calculation?.openPackageAllowed ?? item.openPackageAllowed,
          subtotal: calculation?.subtotal ?? 0,
          errors: calculation?.errors ?? [],
          calculationOrigin: item.calculationOrigin,
          notes: item.notes,
        };
      });

      if (productRows.some((entry) => !entry.product)) throw new Error("Um ou mais produtos nao estao disponiveis");
      if (productRows.some((entry) => entry.errors.length > 0)) {
        throw new Error(productRows.find((entry) => entry.errors.length > 0)?.errors[0] || "Calculo comercial invalido");
      }
      if (productRows.some((entry) => entry.product!.stock < entry.quantity)) throw new Error("Estoque insuficiente para um ou mais itens");

      const subtotal = productRows.reduce((sum, item) => sum + item.subtotal, 0);
      const { coupon, error } = resolveCoupon(db, input.couponCode, subtotal);
      if (error) throw new Error(error);

      const discount = calculateDiscount(coupon, subtotal);
      const shippingCost = input.deliveryType === "pickup" ? 0 : Math.max(Number(input.shippingCost || 0), 0);
      const total = subtotal + shippingCost - discount;
      if (total < 0) throw new Error("Total do pedido invalido");

      const tokenUser = token
        ? db.users.find((item) => item.session_token === token && item.session_expires_at && new Date(item.session_expires_at) > new Date())
        : null;
      const currentUser = sessionUser ?? tokenUser;
      const now = new Date().toISOString();
      const defaultSellerEstablishment = getDefaultSellerEstablishment(db);
      if (!defaultSellerEstablishment) throw new Error("Nenhum estabelecimento vendedor configurado");

      const autoStatus: OrderStatus =
        input.status && validOrderStatuses.includes(input.status)
          ? input.status
          : input.paymentMethod === "cash" && input.deliveryType === "pickup"
            ? "confirmed"
            : "awaiting_payment";

      const order: DbOrder = {
        id: createId(),
        order_number: `PVC${Date.now().toString().slice(-8)}`,
        tracking_token: createId(),
        user_id: currentUser?.id ?? null,
        customer_name: input.customerName!.trim(),
        customer_email: normalizeEmail(input.customerEmail!),
        customer_phone: cleanDigits(input.customerPhone!),
        customer_cpf: cleanDigits(input.customerCpf!),
        delivery_type: input.deliveryType!,
        payment_method: input.paymentMethod!,
        payment_status: inferPaymentStatus(autoStatus, input.paymentMethod!),
        payment_reference: null,
        payment_approved_at: null,
        shipping_address: input.deliveryType === "delivery" ? input.shippingAddress ?? null : null,
        shipping_cost: shippingCost,
        discount,
        subtotal,
        total,
        notes: input.notes?.trim() || null,
        status: autoStatus,
        order_type: classification.orderType,
        order_origin: classification.orderOrigin,
        source_channel: classification.sourceChannel,
        source_actor: classification.sourceActor,
        assisted_sale: classification.assistedSale,
        seller_id: input.sellerId ?? null,
        seller_name: input.sellerName ?? null,
        seller_establishment_id: defaultSellerEstablishment.id,
        store_id: input.storeId ?? input.showroomStoreId ?? null,
        store_name: storeName,
        delivery_required: classification.deliveryRequired,
        pickup_allowed: classification.pickupAllowed,
        assisted_sale_notes: input.assistedSaleNotes ?? input.notes?.trim() ?? null,
        payment_linked_to_order: true,
        correlation_id: correlationId,
        idempotency_key: idempotencyKey,
        coupon_id: coupon?.id ?? null,
        coupon_code: coupon?.code ?? null,
        inventory_locked: true,
        event_log: [],
        created_at: now,
        updated_at: now,
      };

      const allocations = reserveInventory(db, {
        orderId: order.id,
        correlationId,
        sourceChannel: classification.sourceChannel,
        sellerEstablishmentId: order.seller_establishment_id ?? defaultSellerEstablishment.id,
        productRows: productRows as Array<{ product: DbProduct; quantity: number }>,
      });

      if (coupon) coupon.used_count += 1;

      const orderItems: DbOrderItem[] = productRows.map((entry) => {
        const fiscalSnapshot = buildItemFiscalSnapshot(db, entry.product!, order.seller_establishment_id ?? defaultSellerEstablishment.id);
        const allocatedLotId = allocations.get(entry.product!.id) ?? null;
        return {
          id: createId(),
          order_id: order.id,
          product_id: entry.product!.id,
          product_name: entry.product!.name,
          product_sku: entry.product!.sku ?? null,
          quantity: entry.quantity,
          unit_price: Number(entry.product!.price),
          total_price: entry.subtotal,
          sale_type: entry.product!.sale_type,
          unit_measure: entry.product!.unit_measure,
          display_unit: entry.product!.display_unit ?? entry.product!.unit_measure ?? null,
          commercial_rule_applied: entry.commercialRuleApplied,
          quantity_original: entry.quantityInformedClient,
          quantity_final: entry.quantityCalculatedSystem,
          quantity_informed: entry.quantityInformedClient,
          requested_measurement: entry.requestedMeasurement,
          area_desired_m2: entry.areaDesiredM2,
          total_area_m2: entry.totalAreaM2,
          weight_desired_kg: entry.weightDesiredKg,
          total_weight_kg: entry.totalWeightKg,
          volume_desired_l: entry.volumeDesiredLiters,
          total_volume_l: entry.totalVolumeLiters,
          cubic_meters_desired: entry.cubicMetersDesired,
          total_cubic_meters: entry.totalCubicMeters,
          calculated_boxes: entry.calculatedBoxes,
          calculated_pieces: entry.calculatedPieces,
          calculated_packages: entry.calculatedPackages,
          packaging_closed: entry.packagingClosed,
          open_package_allowed: entry.openPackageAllowed,
          loss_margin_applied: entry.lossMarginApplied,
          client_notes: entry.notes,
          operational_notes: null,
          calculation_origin: entry.calculationOrigin ?? "checkout",
          seller_establishment_id: order.seller_establishment_id,
          allocated_lot_id: allocatedLotId,
          ncm: fiscalSnapshot.ncm,
          cest: fiscalSnapshot.cest,
          origin_code: fiscalSnapshot.origin_code,
          cfop: fiscalSnapshot.cfop,
          cst_csosn: fiscalSnapshot.cst_csosn,
          requires_difal: fiscalSnapshot.requires_difal,
          requires_fcp: fiscalSnapshot.requires_fcp,
          fiscal_profile_status: fiscalSnapshot.fiscal_profile_status,
        };
      });

      db.orders.unshift(order);
      db.orderItems.push(...orderItems);
      createPaymentRecord(db, {
        order,
        provider: "manual",
        method: order.payment_method,
        status: order.payment_status === "approved" ? "approved" : order.payment_status,
        amount: order.total,
        externalReference: order.payment_reference,
        occurredAt: now,
      });

      const actorId = input.sellerId ?? currentUser?.id ?? null;
      const actorName = input.sellerName ?? currentUser?.user_metadata?.full_name ?? currentUser?.email ?? normalizeEmail(input.customerEmail!);
      createAuditEvent(db, {
        eventType: classification.assistedSale ? "assisted_sale.order_created" : "order.created",
        orderId: order.id,
        correlationId,
        actorId,
        actorName,
        sourceChannel: classification.sourceChannel,
        newValue: { status: order.status, total: order.total, payment_method: order.payment_method, order_type: order.order_type, order_origin: order.order_origin },
        payload: { coupon_code: order.coupon_code, items_count: orderItems.length, seller_name: order.seller_name, store_name: order.store_name, idempotency_key: idempotencyKey },
        occurredAt: now,
      });
      createAuditEvent(db, {
        eventType: "order.address_confirmed",
        orderId: order.id,
        correlationId,
        actorId,
        actorName,
        sourceChannel: classification.sourceChannel,
        newValue: { shipping_address: order.shipping_address, delivery_required: order.delivery_required },
        occurredAt: now,
      });
      createAuditEvent(db, {
        eventType: "order.freight_calculated",
        orderId: order.id,
        correlationId,
        actorId,
        actorName,
        sourceChannel: classification.sourceChannel,
        newValue: { shipping_cost: order.shipping_cost, total: order.total },
        occurredAt: now,
      });

      writeDb(db);
      return { duplicated: false, order, orderItems };
    });

    if (!result.duplicated) {
      incrementBusinessMetric("orders.created");
      queueEmailDelivery({
        to: result.order.customer_email,
        ...buildOrderEmail(result.order.order_number, result.order.total),
        tags: [{ name: "category", value: "order_created" }],
        idempotencyKey: `order-${result.order.id}`,
      });
      queueAnalyticsDelivery({
        name: "purchase",
        userId: result.order.user_id,
        params: {
          transaction_id: result.order.order_number,
          value: result.order.total,
          currency: "BRL",
          payment_type: result.order.payment_method,
          shipping: result.order.shipping_cost,
        },
      });
    }

    res.json(result);
  } catch (error) {
    logError({
      event: "order.create_failed",
      module: "orders",
      requestId: res.locals.requestId ?? null,
      correlationId,
      error,
    });
    res.status(400).json(buildError(error instanceof Error ? error.message : "Falha ao criar pedido"));
  }
}

async function handleOrderPaymentMutation(
  req: express.Request,
  res: express.Response,
  orderId: string,
  body: { action?: "initiate" | "approve" | "fail"; paymentMethod?: PaymentMethod; paymentReference?: string | null; trackingToken?: string | null },
) {
  try {
    const result = await runSerializedMutation("order.payment", async () => {
      const db = readDb();
      const order = db.orders.find((item) => item.id === orderId);
      if (!order) {
        return { status: 404, payload: buildError("Pedido nao encontrado") };
      }

      const access = canAccessOrder(order, getCurrentUserOptional(req), body.trackingToken);
      if (!access.allowed) {
        return { status: 403, payload: buildError("Acesso negado") };
      }

      const action = body.action ?? "initiate";
      const user = access.user;
      const actorName = user?.user_metadata?.full_name || user?.email || "guest";

      if (action === "initiate") {
        incrementBusinessMetric("payments.initiated");
        const orderItems = db.orderItems.filter((item) => item.order_id === order.id);
        const providerIntent = await createProviderPaymentIntent({ order, items: orderItems });
        applyOrderPaymentAction({
          db,
          order,
          action,
          paymentMethod: body.paymentMethod,
          paymentReference: body.paymentReference,
          paymentIntent: providerIntent,
          actorId: user?.id ?? null,
          actorName,
        });
        if (providerIntent.provider === "fake" && providerIntent.status === "approved") {
          applyOrderPaymentAction({
            db,
            order,
            action: "approve",
            actorId: user?.id ?? null,
            actorName: "fake-payment-provider",
          });
        }
        if (providerIntent.provider === "fake" && (providerIntent.status === "rejected" || providerIntent.status === "failed")) {
          applyOrderPaymentAction({
            db,
            order,
            action: "fail",
            actorId: user?.id ?? null,
            actorName: "fake-payment-provider",
          });
        }
        writeDb(db);
        return { status: 200, payload: { order, paymentIntent: providerIntent } };
      }

      if (action === "approve" && order.payment_status !== "approved") {
        incrementBusinessMetric("payments.approved");
        applyOrderPaymentAction({
          db,
          order,
          action,
          paymentMethod: body.paymentMethod,
          paymentReference: body.paymentReference,
          actorId: user?.id ?? null,
          actorName,
        });
      }

      if (action === "fail" && order.payment_status !== "failed") {
        incrementBusinessMetric("payments.failed");
        applyOrderPaymentAction({
          db,
          order,
          action,
          paymentMethod: body.paymentMethod,
          paymentReference: body.paymentReference,
          actorId: user?.id ?? null,
          actorName,
        });
      }

      writeDb(db);
      return { status: 200, payload: { order } };
    });

    res.status(result.status).json(result.payload);
  } catch (error) {
    logError({
      event: "order.payment_mutation_failed",
      module: "payments",
      requestId: res.locals.requestId ?? null,
      error,
      data: { orderId },
    });
    res.status(500).json(buildError("Falha ao atualizar pagamento"));
  }
}

async function handleMercadoPagoWebhook(req: express.Request, res: express.Response) {
  if (!assertWebhookAllowed(req, res, () => validateMercadoPagoWebhookSignature(req), "mercadopago")) {
    return;
  }

  const body = req.body as { type?: string; data?: { id?: string } };
  const paymentId = String(req.query["data.id"] || body.data?.id || "");
  if (!paymentId) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const providerResponse = await fetchMercadoPagoPayment(paymentId);
  if (!providerResponse.ok || !providerResponse.data) {
    res.status(202).json({ ok: false, retry: true });
    return;
  }

  const externalReference = String(providerResponse.data.external_reference || "");
  const mappedStatus = mapMercadoPagoStatus(typeof providerResponse.data.status === "string" ? providerResponse.data.status : undefined);

  const result = await runSerializedMutation("webhook.mercadopago", () => {
    const db = readDb();
    const webhookKey = req.header("x-request-id") || paymentId;
    const mutation = applyMercadoPagoWebhookMutation({
      db,
      paymentId,
      externalReference,
      mappedStatus,
      transactionAmount: Number(providerResponse.data.transaction_amount || 0),
      webhookKey,
      topic: body.type || "payment",
    });
    if (!mutation.changed && "duplicated" in mutation.response && mutation.response.duplicated) {
      incrementBusinessMetric("payments.webhook_duplicated");
      return mutation.response;
    }
    if (mappedStatus === "approved") {
      incrementBusinessMetric("payments.webhook_approved");
    } else if (mappedStatus === "failed") {
      incrementBusinessMetric("payments.webhook_failed");
    } else if (mappedStatus === "refunded") {
      incrementBusinessMetric("payments.webhook_refunded");
    }
    if (mutation.changed) writeDb(db);
    return mutation.response;
  });

  res.status(200).json(result);
}

async function handleGenericPaymentWebhook(
  req: express.Request,
  res: express.Response,
  body: GenericPaymentWebhookInput,
) {
  if (!assertWebhookAllowed(req, res, () => validateGenericWebhookSignature(req), "generic")) {
    return;
  }

  if (!isNonEmptyString(body.orderId || "") || !isNonEmptyString(body.idempotencyKey || "")) {
    res.status(400).json(buildError("Webhook invalido"));
    return;
  }

  const result = await runSerializedMutation("webhook.generic_payment", () => {
    const db = readDb();
    const mutation = applyGenericPaymentWebhookMutation({ db, body });
    if (!mutation.changed && mutation.response.status === 200) {
      incrementBusinessMetric("payments.webhook_duplicated");
      return mutation.response;
    }
    if (body.eventType === "payment_succeeded") {
      incrementBusinessMetric("payments.webhook_approved");
    } else if (body.eventType === "payment_failed") {
      incrementBusinessMetric("payments.webhook_failed");
    } else {
      incrementBusinessMetric("payments.webhook_refunded");
    }
    if (mutation.changed) writeDb(db);
    if (!mutation.changed && mutation.response.status === 404) {
      return { status: 404, payload: buildError("Pedido nao encontrado") };
    }
    return mutation.response;
  });

  res.status(result.status).json(result.payload);
}


function attachSellerMetadata(user: Record<string, unknown>, seller: DbSeller | null, store: DbStore | null) {
  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  metadata.store_id = store?.id ?? metadata.store_id ?? null;
  metadata.store_name = store?.name ?? metadata.store_name ?? null;
  metadata.can_start_assisted_sale = user.role === "admin" || user.role === "seller";
  metadata.allowed_stores = seller?.allowed_store_ids ?? (store ? [store.id] : []);
  user.user_metadata = metadata;
}

function sellerView(db: DatabaseShape, seller: DbSeller) {
  const user = db.users.find((item) => item.id === seller.user_id);
  const primaryStore = db.stores.find((item) => item.id === seller.primary_store_id) ?? null;
  return {
    ...seller,
    user: user ? sanitizeUser(user as unknown as Record<string, unknown>) : null,
    primary_store: primaryStore,
    allowed_stores: db.stores.filter((item) => seller.allowed_store_ids.includes(item.id)),
  };
}

function resolveCoupon(db: DatabaseShape, code: string | undefined, orderValue: number) {
  if (!code) return { coupon: null, error: null as string | null };
  const coupon = db.coupons.find((item) => item.code === code.toUpperCase().trim() && item.is_active);
  if (!coupon) return { coupon: null, error: "Cupom nao encontrado ou expirado" };
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) return { coupon: null, error: "Este cupom ainda nao esta ativo" };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { coupon: null, error: "Este cupom expirou" };
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { coupon: null, error: "Este cupom atingiu o limite de uso" };
  if (coupon.min_order_value && orderValue < coupon.min_order_value) {
    return { coupon: null, error: `Valor minimo para este cupom: R$ ${coupon.min_order_value.toFixed(2).replace(".", ",")}` };
  }
  return { coupon, error: null };
}

function calculateDiscount(coupon: DbCoupon | null, subtotal: number) {
  if (!coupon) return 0;
  if (coupon.discount_type === "percentage") {
    const percentageDiscount = Number(((subtotal * coupon.discount_value) / 100).toFixed(2));
    return coupon.max_discount_value ? Math.min(percentageDiscount, coupon.max_discount_value) : percentageDiscount;
  }
  return Math.min(coupon.discount_value, subtotal);
}

function getDefaultSellerEstablishment(db: DatabaseShape) {
  return db.establishments.find((entry) => entry.is_default_seller) ?? db.establishments.find((entry) => entry.can_sell) ?? null;
}

function getFiscalProfile(db: DatabaseShape, productId: string, establishmentId: string) {
  return (
    db.fiscalProfiles.find((entry) => entry.product_id === productId && entry.establishment_id === establishmentId) ??
    db.fiscalProfiles.find((entry) => entry.product_id === productId) ??
    null
  );
}

function buildItemFiscalSnapshot(db: DatabaseShape, product: DbProduct, establishmentId: string) {
  const profile = getFiscalProfile(db, product.id, establishmentId);
  return {
    seller_establishment_id: establishmentId,
    ncm: profile?.ncm ?? product.ncm ?? null,
    cest: profile?.cest ?? product.cest ?? null,
    origin_code: profile?.origin_code ?? product.origin_code ?? null,
    cfop: profile?.cfop_internal_default ?? "5102",
    cst_csosn: profile?.cst_icms_default ?? profile?.csosn_default ?? null,
    requires_difal: profile?.requires_difal ?? true,
    requires_fcp: profile?.requires_fcp ?? true,
    fiscal_profile_status: profile?.tax_rule_status ?? product.tax_classification_status ?? "pending",
  };
}

function reserveInventory(
  db: DatabaseShape,
  input: {
    orderId: string;
    correlationId: string;
    sourceChannel: SourceChannel;
    sellerEstablishmentId: string;
    productRows: Array<{ product: DbProduct; quantity: number }>;
  },
) {
  const now = new Date().toISOString();
  const allocations = new Map<string, string | null>();

  for (const { product, quantity } of input.productRows) {
    let remaining = quantity;
    const lots = db.inventoryLots
      .filter((lot) => lot.product_id === product.id && lot.establishment_id === input.sellerEstablishmentId && lot.quantity_available > 0)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    if (lots.length === 0) {
      product.stock = Math.max(product.stock - quantity, 0);
      db.inventoryMovements.unshift({
        id: createId(),
        product_id: product.id,
        lot_id: null,
        establishment_id: input.sellerEstablishmentId,
        movement_type: "reserva",
        quantity,
        order_id: input.orderId,
        fiscal_document_id: null,
        notes: "Reserva sem lote identificado no legado",
        created_at: now,
      });
      allocations.set(product.id, null);
      continue;
    }

    for (const lot of lots) {
      if (remaining <= 0) break;
      const allocated = Math.min(lot.quantity_available, remaining);
      lot.quantity_available -= allocated;
      remaining -= allocated;
      db.inventoryMovements.unshift({
        id: createId(),
        product_id: product.id,
        lot_id: lot.id,
        establishment_id: input.sellerEstablishmentId,
        movement_type: "reserva",
        quantity: allocated,
        order_id: input.orderId,
        fiscal_document_id: null,
        notes: "Reserva automatica do checkout",
        created_at: now,
      });
      if (!allocations.has(product.id)) allocations.set(product.id, lot.id);
    }

    product.stock = Math.max(product.stock - quantity, 0);
  }

  createAuditEvent(db, {
    eventType: "inventory.reserved",
    orderId: input.orderId,
    correlationId: input.correlationId,
    actorId: null,
    actorName: "system",
    sourceChannel: input.sourceChannel,
    payload: {
      establishment_id: input.sellerEstablishmentId,
      items: input.productRows.map(({ product, quantity }) => ({
        product_id: product.id,
        product_name: product.name,
        quantity,
        allocated_lot_id: allocations.get(product.id) ?? null,
      })),
    },
    occurredAt: now,
  });

  return allocations;
}

function publishCatalogStagingItem(db: DatabaseShape, item: DbCatalogStagingItem) {
  if (item.review_status === "rejected") {
    throw new Error("Item rejeitado nao pode ser publicado");
  }
  const publicationIssues = getCatalogPublicationIssues(db, item);
  if (publicationIssues.length > 0) {
    const issueSummary = publicationIssues.map((issue) => `${issue.field}(${issue.responsible})`).join(", ");
    throw new Error(`Item ainda possui bloqueios de publicacao: ${issueSummary}`);
  }

  const category = db.categories.find((entry) => entry.name === item.category_name) ?? null;
  const brand = db.brands.find((entry) => entry.name === item.brand_name) ?? null;
  const existingProduct = item.mapped_product_id ? db.products.find((entry) => entry.id === item.mapped_product_id) ?? null : null;
  const slugBase = slugify(item.normalized_name);
  const slug = db.products.some((entry) => entry.slug === slugBase && entry.id !== existingProduct?.id)
    ? `${slugBase}-${Date.now().toString().slice(-4)}`
    : slugBase;

  if (existingProduct) {
    existingProduct.name = item.normalized_name;
    existingProduct.slug = slug;
    existingProduct.category_id = category?.id ?? existingProduct.category_id;
    existingProduct.brand_id = brand?.id ?? existingProduct.brand_id;
    existingProduct.subcategory = item.subcategory_name;
    existingProduct.cost_price = item.cost_price ?? existingProduct.cost_price ?? null;
    existingProduct.price = item.suggested_price ?? existingProduct.price;
    existingProduct.stock = item.estimated_stock ?? existingProduct.stock;
    existingProduct.tax_classification_status = "review";
    existingProduct.is_active = true;
  } else {
    const now = new Date().toISOString();
    const productId = createId();
    db.products.unshift({
      id: productId,
      sku: item.sku_base || `GML-${Date.now().toString().slice(-6)}`,
      name: item.normalized_name,
      slug,
      ncm: null,
      cest: null,
      origin_code: "0",
      product_origin: "nacional",
      fiscal_group: item.category_name,
      tax_classification_status: "pending",
      cost_price: item.cost_price,
      margin_target: 0.35,
      subcategory: item.subcategory_name,
      description: item.import_notes,
      short_description: item.import_notes,
      long_description: item.import_notes,
      application: item.subcategory_name,
      sale_type: "unidade",
      unit_measure: "un",
      display_unit: "un",
      base_price: item.suggested_price ?? 0,
      promotional_price: null,
      price: item.suggested_price ?? 0,
      original_price: null,
      category_id: category?.id ?? null,
      brand_id: brand?.id ?? null,
      sales_unit: "un",
      measures: item.size,
      material: item.category_name,
      diameter: item.size,
      weight: null,
      dimensions: null,
      width: null,
      height: null,
      length: null,
      thickness: null,
      linear_measure: null,
      square_measure: null,
      area_per_piece: null,
      area_per_box: null,
      area_per_package: null,
      meters_per_piece: null,
      pieces_per_box: null,
      meters_per_box: null,
      meters_per_package: null,
      volume_per_unit: null,
      volume_per_package: null,
      weight_per_unit: null,
      weight_per_package: null,
      pieces_per_package: null,
      packaging_closed: null,
      open_package_allowed: null,
      minimum_sale_quantity: null,
      sale_multiple: null,
      fractional_sale_allowed: null,
      default_loss_margin: null,
      loss_margin: null,
      stock_minimum: 1,
      unit: "un",
      stock: item.estimated_stock ?? 0,
      status_product: "draft",
      availability: "sob_consulta",
      delivery_type: "pickup_or_delivery",
      is_on_request: true,
      is_heavy: false,
      is_bulky: false,
      top_seller: false,
      related_product_ids: [],
      variations: [],
      is_active: true,
      is_featured: false,
      rating: 0,
      review_count: 0,
      image_url: "/placeholder.svg",
      images: ["/placeholder.svg"],
      created_at: now,
    });

    db.fiscalProfiles.push({
      id: createId(),
      product_id: productId,
      establishment_id: "est-comercial",
      ncm: null,
      cest: null,
      cfop_internal_default: "5102",
      cfop_interstate_default: "6102",
      origin_code: "0",
      cst_icms_default: null,
      csosn_default: null,
      requires_difal: true,
      requires_fcp: true,
      tax_rule_status: "pending",
      notes: "Criado a partir do staging; validar com contabilidade.",
      updated_at: now,
    });
    item.mapped_product_id = productId;
  }

  item.review_status = "approved";
  item.publish_flag = true;
  refreshCatalogStagingItem(db, item);

  return item.mapped_product_id;
}

function materializeCatalogStagingProductOrigin(db: DatabaseShape, item: DbCatalogStagingItem) {
  const category = db.categories.find((entry) => entry.name === item.category_name) ?? null;
  const brand = db.brands.find((entry) => entry.name === item.brand_name) ?? null;
  const existingProduct = item.mapped_product_id ? db.products.find((entry) => entry.id === item.mapped_product_id) ?? null : null;
  const reusableDraftProduct =
    existingProduct && existingProduct.status_product === "draft" && existingProduct.is_active === false ? existingProduct : null;
  const now = new Date().toISOString();
  const slugBase = slugify(item.normalized_name);
  const slug = db.products.some((entry) => entry.slug === slugBase && entry.id !== existingProduct?.id)
    ? `${slugBase}-${Date.now().toString().slice(-4)}`
    : slugBase;

  let productId = reusableDraftProduct?.id ?? null;

  if (reusableDraftProduct) {
    reusableDraftProduct.name = item.normalized_name;
    reusableDraftProduct.slug = slug;
    reusableDraftProduct.category_id = category?.id ?? reusableDraftProduct.category_id;
    reusableDraftProduct.brand_id = brand?.id ?? reusableDraftProduct.brand_id;
    reusableDraftProduct.subcategory = item.subcategory_name;
    reusableDraftProduct.cost_price = item.cost_price ?? reusableDraftProduct.cost_price ?? null;
    reusableDraftProduct.base_price = item.suggested_price ?? reusableDraftProduct.base_price ?? reusableDraftProduct.price;
    reusableDraftProduct.price = item.suggested_price ?? reusableDraftProduct.price;
    reusableDraftProduct.stock = item.estimated_stock ?? reusableDraftProduct.stock;
    reusableDraftProduct.description = reusableDraftProduct.description || item.import_notes;
    reusableDraftProduct.short_description = reusableDraftProduct.short_description || item.import_notes;
    reusableDraftProduct.long_description = reusableDraftProduct.long_description || item.import_notes;
    reusableDraftProduct.measures = reusableDraftProduct.measures || item.size;
    reusableDraftProduct.diameter = reusableDraftProduct.diameter || item.size;
    reusableDraftProduct.application = reusableDraftProduct.application || item.subcategory_name;
    reusableDraftProduct.material = reusableDraftProduct.material || item.category_name;
    reusableDraftProduct.fiscal_group = reusableDraftProduct.fiscal_group || item.suggested_family || item.category_name;
    reusableDraftProduct.origin_code = reusableDraftProduct.origin_code || item.suggested_origin_code || "0";
    reusableDraftProduct.ncm = reusableDraftProduct.ncm || item.suggested_ncm || null;
    reusableDraftProduct.dimensions = reusableDraftProduct.dimensions || item.suggested_dimensions || null;
    if (!(typeof reusableDraftProduct.weight === "number" && reusableDraftProduct.weight > 0) && typeof item.suggested_weight === "number") {
      reusableDraftProduct.weight = item.suggested_weight;
    }
    reusableDraftProduct.tax_classification_status = "review";
    reusableDraftProduct.status_product = "draft";
    reusableDraftProduct.availability = "sob_consulta";
    reusableDraftProduct.is_on_request = true;
    reusableDraftProduct.is_active = false;
    reusableDraftProduct.is_featured = false;
    productId = reusableDraftProduct.id;
  } else {
    productId = createId();
    db.products.unshift({
      id: productId,
      sku: item.sku_base ? `${item.sku_base}-ORIGEM` : `GML-${Date.now().toString().slice(-6)}`,
      name: item.normalized_name,
      slug,
      ncm: item.suggested_ncm || null,
      cest: null,
      origin_code: item.suggested_origin_code || "0",
      product_origin: "nacional",
      fiscal_group: item.suggested_family || item.category_name,
      tax_classification_status: "review",
      cost_price: item.cost_price,
      margin_target: 0.35,
      subcategory: item.subcategory_name,
      description: item.import_notes,
      short_description: item.import_notes,
      long_description: item.import_notes,
      application: item.subcategory_name,
      sale_type: "unidade",
      unit_measure: "un",
      display_unit: "un",
      base_price: item.suggested_price ?? 0,
      promotional_price: null,
      price: item.suggested_price ?? 0,
      original_price: null,
      category_id: category?.id ?? null,
      brand_id: brand?.id ?? null,
      sales_unit: "un",
      measures: item.size,
      material: item.category_name,
      diameter: item.size,
      weight: item.suggested_weight ?? null,
      dimensions: item.suggested_dimensions ?? null,
      width: null,
      height: null,
      length: null,
      thickness: null,
      linear_measure: null,
      square_measure: null,
      area_per_piece: null,
      area_per_box: null,
      area_per_package: null,
      meters_per_piece: null,
      pieces_per_box: null,
      meters_per_box: null,
      meters_per_package: null,
      volume_per_unit: null,
      volume_per_package: null,
      weight_per_unit: null,
      weight_per_package: null,
      pieces_per_package: null,
      packaging_closed: null,
      open_package_allowed: null,
      minimum_sale_quantity: null,
      sale_multiple: null,
      fractional_sale_allowed: null,
      default_loss_margin: null,
      loss_margin: null,
      stock_minimum: 1,
      unit: "un",
      stock: item.estimated_stock ?? 0,
      status_product: "draft",
      availability: "sob_consulta",
      delivery_type: "pickup_or_delivery",
      is_on_request: true,
      is_heavy: false,
      is_bulky: false,
      top_seller: false,
      related_product_ids: [],
      variations: [],
      is_active: false,
      is_featured: false,
      rating: 0,
      review_count: 0,
      image_url: "/placeholder.svg",
      images: ["/placeholder.svg"],
      created_at: now,
    });
  }

  const existingProfile =
    db.fiscalProfiles.find((entry) => entry.product_id === productId && entry.establishment_id === "est-comercial") ??
    db.fiscalProfiles.find((entry) => entry.product_id === productId) ??
    null;

  if (existingProfile) {
    existingProfile.ncm = existingProfile.ncm || item.suggested_ncm || null;
    existingProfile.origin_code = existingProfile.origin_code || item.suggested_origin_code || "0";
    existingProfile.updated_at = now;
  } else {
    db.fiscalProfiles.push({
      id: createId(),
      product_id: productId,
      establishment_id: "est-comercial",
      ncm: item.suggested_ncm || null,
      cest: null,
      cfop_internal_default: "5102",
      cfop_interstate_default: "6102",
      origin_code: item.suggested_origin_code || "0",
      cst_icms_default: null,
      csosn_default: null,
      requires_difal: true,
      requires_fcp: true,
      tax_rule_status: "pending",
      notes: "Produto origem criado a partir do lote inicial do staging; validar com contabilidade.",
      updated_at: now,
    });
  }

  item.mapped_product_id = productId;
  refreshCatalogStagingItem(db, item);
  item.review_status = "review";
  item.review_reason = "Produto origem draft preparado para saneamento e aprovacao manual.";

  return productId;
}

app.get("/api/health", async (_req, res) => {
  const [database, redis, storage] = await Promise.all([
    getDatabaseProviderStatus(),
    getRedisProviderStatus(),
    checkObjectStorageHealth(),
  ]);
  const dbRuntime = getDbRuntimeStatus();
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    storage: appConfig.dbProvider,
    mode: configuredPaymentProvider === "manual" && appConfig.freightProvider === "local-rules" ? "hybrid" : "production-ready",
    homologation_only: appConfig.homologationOnly,
    env: appEnv,
    has_dist: hasDist,
    database_ready: database.ready,
    database_runtime: dbRuntime,
    postgres_configured: isPostgresConfigured(),
    redis_configured: isRedisConfigured(),
    redis_ready: redis.ready,
    storage_ready: storage.ready,
    integrations: {
      payment_provider: appConfig.paymentProvider,
      freight_provider: appConfig.freightProvider,
      fiscal_provider: appConfig.fiscalProvider,
      erp_provider: appConfig.erpProvider,
      email_provider: appConfig.emailProvider,
      analytics_provider: appConfig.analyticsProvider,
      storage_provider: appConfig.storageProvider,
    },
  });
});

app.get("/api/health/detailed", async (_req, res) => {
  const [database, redis, storage] = await Promise.all([
    getDatabaseProviderStatus(),
    getRedisProviderStatus(),
    checkObjectStorageHealth(),
  ]);
  const dbRuntime = getDbRuntimeStatus();
  res.json({
    ok: database.ready && storage.ready && (appConfig.queueProvider !== "redis" || redis.ready),
    timestamp: new Date().toISOString(),
    env: appConfig.env,
    homologation_only: appConfig.homologationOnly,
    app_base_url: appConfig.appBaseUrl,
    providers: {
      database,
      database_runtime: dbRuntime,
      redis,
      payment: { provider: appConfig.paymentProvider, ready: isPaymentProviderReady() },
      freight: { provider: appConfig.freightProvider, ready: isFreightProviderReady() },
      fiscal: { provider: appConfig.fiscalProvider, ready: isFiscalProviderReady() },
      erp: { provider: appConfig.erpProvider, ready: isErpProviderReady() },
      email: { provider: appConfig.emailProvider, ready: isEmailProviderReady() },
      analytics: { provider: appConfig.analyticsProvider, ready: isAnalyticsProviderReady() },
      storage,
    },
    queues: getQueueStats(),
    metrics_enabled: true,
  });
});

app.get("/api/health/readiness", async (_req, res) => {
  const [database, redis, storage] = await Promise.all([
    getDatabaseProviderStatus(),
    getRedisProviderStatus(),
    checkObjectStorageHealth(),
  ]);
  const redisRequired = appConfig.queueProvider === "redis";
  const checks = {
    database: database.ready,
    redis: redisRequired ? redis.ready : isRedisConfigured() ? redis.ready : true,
    payment: isPaymentProviderReady(),
    freight: isFreightProviderReady(),
    fiscal: isFiscalProviderReady(),
    erp: isErpProviderReady(),
    email: isEmailProviderReady(),
    analytics: isAnalyticsProviderReady(),
    storage: storage.ready,
  };
  const failures = Object.entries(checks)
    .filter(([, ready]) => !ready)
    .map(([name]) => name);
  const ready = failures.length === 0;

  res.status(ready ? 200 : 503).json({
    ok: ready,
    timestamp: new Date().toISOString(),
    env: appConfig.env,
    db_provider: appConfig.dbProvider,
    checks,
    failures,
    providers: {
      database,
      redis: {
        ...redis,
        required: redisRequired,
      },
      payment: appConfig.paymentProvider,
      freight: appConfig.freightProvider,
      fiscal: appConfig.fiscalProvider,
      erp: appConfig.erpProvider,
      email: appConfig.emailProvider,
      analytics: appConfig.analyticsProvider,
      storage,
    },
  });
});

app.get("/api/metrics", (req, res) => {
  const metricsToken = appConfig.metricsToken.trim();
  if (isProductionLike() && !metricsToken) {
    res.status(503).json(buildError("Endpoint de metricas bloqueado sem METRICS_TOKEN em ambiente production-like"));
    return;
  }

  if (isProductionLike() && metricsToken) {
    const provided = req.header("x-metrics-token") || req.query.token;
    if (provided !== metricsToken) {
      res.status(403).json(buildError("Token de metricas invalido"));
      return;
    }
  }

  const format = typeof req.query.format === "string" ? req.query.format : "json";
  if (format === "prometheus") {
    res.type("text/plain").send(renderPrometheusMetrics());
    return;
  }

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    metrics: getMetricsSnapshot(),
    runtime: {
      database: getDbRuntimeStatus(),
    },
    queues: getQueueStats(),
  });
});

app.get("/api/admin/system-status", requireAdminModule("integrations"), async (_req, res) => {
  const [
    overview,
    database,
    redis,
    payment,
    freight,
    phase1,
    phase2,
    security,
    goLive,
  ] = await Promise.all([
    getIntegrationOverview(),
    getDatabaseProviderStatus(),
    getRedisProviderStatus(),
    Promise.resolve(getPaymentProviderStatus()),
    Promise.resolve(getFreightProviderStatus()),
    getPhase1ReadinessReport(),
    getPhase2ReadinessReport(),
    getSecurityReadinessReport(),
    getGoLiveReadinessReport(),
  ]);
  const db = readDb();
  const operationReadiness = getOperationReadinessReport(db);
  const fiscalMinimal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const integrationCentral = getIntegrationReadiness(db);
  const release = await getReleaseReadinessReport(db);
  const readiness = {
    integrations: {
      ...integrationCentral,
      summary: { ready: integrationCentral.ready, blockers: integrationCentral.blockers, warnings: integrationCentral.warnings },
    },
    phase1: {
      ...phase1,
      summary: { ready: phase1.ok, blockers: phase1.blockers, warnings: phase1.warnings },
    },
    phase2: {
      ...phase2,
      summary: { ready: phase2.phase2_ready, blockers: phase2.blockers, warnings: phase2.warnings },
    },
    security: {
      ...security,
      summary: { ready: security.ready, blockers: security.blockers, warnings: security.warnings },
    },
    fiscal_minimal: {
      ...fiscalMinimal,
      summary: { ready: fiscalMinimal.ready, blockers: fiscalMinimal.blockers, warnings: fiscalMinimal.warnings },
    },
    operations: {
      ...operationReadiness,
      summary: { ready: operationReadiness.ready, blockers: operationReadiness.blockers, warnings: operationReadiness.warnings },
    },
    release: {
      ...release,
      summary: { ready: release.ready, blockers: release.blockers, warnings: release.warnings },
    },
    go_live: {
      ...goLive,
      summary: { ready: goLive.go_live_ready, blockers: goLive.blockers, warnings: goLive.warnings },
    },
  };

  const fiscalProvider = getFiscalProviderStatus();
  const erpProvider = getErpProviderStatus();
  const blockers = [
    phase1.blockers,
    phase2.blockers,
    integrationCentral.blockers,
    security.blockers,
    fiscalMinimal.blockers,
    operationReadiness.blockers,
    release.blockers,
    goLive.blockers,
  ].reduce((total, current) => total + current, 0);
  const warnings = [
    phase1.warnings,
    phase2.warnings,
    integrationCentral.warnings,
    security.warnings,
    fiscalMinimal.warnings,
    operationReadiness.warnings,
    release.warnings,
    goLive.warnings,
  ].reduce((total, current) => total + current, 0);

  res.json({
    ok: blockers === 0,
    timestamp: new Date().toISOString(),
    env: appConfig.env,
    providers: {
      database,
      redis,
      payment,
      freight,
      fiscal: fiscalProvider,
      erp: erpProvider,
    },
    runtime: {
      database: getDbRuntimeStatus(),
      queues: getQueueStats(),
      overview,
    },
    readiness,
    summary: {
      blockers,
      warnings,
    },
  });
});

app.get("/api/admin/training/assisted-plan", requireAdminModule("orders", "view"), (_req, res) => {
  res.json(buildAssistedTrainingPlan());
});

function getPublicCatalogPriority(product: { sku?: string | null; delivery_type?: string | null; availability?: string | null; is_on_request?: boolean | null }) {
  const sku = String(product.sku || "");
  if (sku.startsWith("GML-RIP-")) return 400;
  if (sku.startsWith("GML-TLV-")) return 390;
  if (sku.startsWith("GML-")) return 300;
  if (product.delivery_type === "quote" || product.availability === "sob_consulta" || product.is_on_request) return 100;
  return 0;
}

app.get("/api/products", rateLimit({ windowMs: appConfig.rateLimit.publicCatalogWindowMs, max: appConfig.rateLimit.publicCatalogMax, message: "Muitas consultas ao catalogo em pouco tempo" }), (req, res) => {
  setPublicCatalogCache(res);
  const db = readDb();
  const publicCategoryIds = new Set(db.categories.filter((category) => isPublicCatalogCategory(category)).map((category) => category.id));
  let products = db.products
    .filter((item) => isProductPubliclyMarketable(item) && Boolean(item.category_id) && publicCategoryIds.has(String(item.category_id)))
    .map((item) => sanitizePublicProductMedia(withRelations(db, item)));
  const {
    featured,
    readyForCampaign,
    search,
    categorySlug,
    category,
    brand,
    brandSlug,
    availability,
    deliveryType,
    application,
    saleType,
    unitMeasure,
    limit,
    page,
    pageSize,
    sort,
    subcategory,
    diameter,
    paged,
  } = req.query;

  if (featured === "true") products = products.filter((item) => item.is_featured);
  if (readyForCampaign === "true") products = products.filter((item) => isProductReadyForCampaignPublic(item));
  if (typeof categorySlug === "string") products = products.filter((item) => item.category?.slug === categorySlug);
  if (typeof brandSlug === "string") products = products.filter((item) => item.brand?.slug === brandSlug);
  const categoryList = parseCsvParam(category);
  const brandList = parseCsvParam(brand);
  if (categoryList.length > 0) {
    products = products.filter((item) => item.category?.name && categoryList.includes(item.category.name));
  }
  if (brandList.length > 0) {
    products = products.filter((item) => item.brand?.name && brandList.includes(item.brand.name));
  }

  const availabilityList = parseCsvParam(availability);
  const deliveryTypeList = parseCsvParam(deliveryType);
  const saleTypeList = parseCsvParam(saleType);
  const unitMeasureList = parseCsvParam(unitMeasure);
  const subcategoryList = parseCsvParam(subcategory);
  const diameterList = parseCsvParam(diameter);

  if (availabilityList.length > 0) {
    products = products.filter((item) => item.availability && availabilityList.includes(item.availability));
  }
  if (deliveryTypeList.length > 0) {
    products = products.filter(
      (item) =>
        item.delivery_type &&
        (deliveryTypeList.includes(item.delivery_type) || (item.delivery_type === "pickup_or_delivery" && deliveryTypeList.some((entry) => entry === "pickup" || entry === "delivery"))),
    );
  }
  if (saleTypeList.length > 0) {
    products = products.filter((item) => item.sale_type && saleTypeList.includes(item.sale_type));
  }
  if (unitMeasureList.length > 0) {
    products = products.filter((item) => item.unit_measure && unitMeasureList.includes(item.unit_measure));
  }
  if (subcategoryList.length > 0) {
    products = products.filter((item) => item.subcategory && subcategoryList.includes(item.subcategory));
  }
  if (diameterList.length > 0) {
    products = products.filter((item) => item.diameter && diameterList.includes(item.diameter));
  }
  if (typeof application === "string" && application.trim()) {
    const normalizedApplication = normalizeSearchText(application.trim());
    products = products.filter((item) => normalizeSearchText(item.application).includes(normalizedApplication));
  }
  if (typeof search === "string" && search.trim()) {
    const value = normalizeSearchText(search);
    const searchTerms = value.split(/\s+/).filter((term) => term.length >= 2);
    products = products.filter((item) =>
      searchTerms.some((term) => normalizeSearchText(
        [item.name, item.application, item.subcategory, item.brand?.name, item.category?.name, item.sku, item.description, item.short_description, item.material, item.diameter]
          .filter(Boolean)
          .join(" "),
      ).includes(term)),
    );
  }

  switch (typeof sort === "string" ? sort : "newest") {
    case "name_asc":
      products = products.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "rating":
      products = products.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
      break;
    default:
      products = products.sort((a, b) => (getPublicCatalogPriority(b) - getPublicCatalogPriority(a)) || b.created_at.localeCompare(a.created_at));
      break;
  }

  if (typeof limit === "string") {
    products = products.slice(0, Number(limit));
  }

  const shouldPage = paged === "true" || typeof page === "string" || typeof pageSize === "string";
  if (!shouldPage) {
    res.json(products.map((product) => toPublicProductDTO(product)));
    return;
  }

  const safePageSize = Math.min(Math.max(Number(pageSize || 20), 1), 60);
  const safePage = Math.max(Number(page || 1), 1);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const normalizedPage = Math.min(safePage, totalPages);
  const start = (normalizedPage - 1) * safePageSize;
  res.json({
    items: products.slice(start, start + safePageSize).map((product) => toPublicProductDTO(product)),
    total,
    page: normalizedPage,
    pageSize: safePageSize,
    totalPages,
  });
});

app.get("/api/products/:slug", rateLimit({ windowMs: appConfig.rateLimit.publicCatalogWindowMs, max: appConfig.rateLimit.publicCatalogMax, message: "Muitas consultas ao catalogo em pouco tempo" }), (req, res) => {
  setPublicCatalogCache(res);
  const db = readDb();
  const publicCategoryIds = new Set(db.categories.filter((category) => isPublicCatalogCategory(category)).map((category) => category.id));
  const requestedSlug = String(req.params.slug || "").trim();
  const matches = db.products.filter((item) => item.slug === requestedSlug && isProductPubliclyMarketable(item) && Boolean(item.category_id) && publicCategoryIds.has(String(item.category_id)));
  if (matches.length > 1) {
    logWarn({
      event: "catalog.product_slug_duplicate",
      module: "catalog",
      requestId: res.locals.requestId ?? null,
      data: {
        slug: requestedSlug,
        product_ids: matches.map((item) => item.id),
        product_names: matches.map((item) => item.name),
      },
    });
    res.status(409).json(buildError("Cadastro de produto duplicado para este slug"));
    return;
  }

  const product = matches[0] ?? null;
  if (!product) {
    res.status(404).json(buildError("Produto nao encontrado"));
    return;
  }
  if (product.slug !== requestedSlug) {
    logWarn({
      event: "catalog.product_slug_mismatch",
      module: "catalog",
      requestId: res.locals.requestId ?? null,
      data: {
        requested_slug: requestedSlug,
        returned_slug: product.slug,
        product_id: product.id,
        product_name: product.name,
      },
    });
    res.status(404).json(buildError("Produto nao encontrado"));
    return;
  }
  res.json(toPublicProductDTO(sanitizePublicProductMedia(withRelations(db, product))));
});

app.get("/api/categories", rateLimit({ windowMs: appConfig.rateLimit.publicCatalogWindowMs, max: appConfig.rateLimit.publicCatalogMax, message: "Muitas consultas ao catalogo em pouco tempo" }), (_req, res) => {
  setPublicCatalogCache(res);
  const db = readDb();
  res.json(db.categories.filter((item) => isPublicCatalogCategory(item)).sort((a, b) => a.sort_order - b.sort_order));
});

app.get("/api/brands", rateLimit({ windowMs: appConfig.rateLimit.publicCatalogWindowMs, max: appConfig.rateLimit.publicCatalogMax, message: "Muitas consultas ao catalogo em pouco tempo" }), (_req, res) => {
  setPublicCatalogCache(res);
  const db = readDb();
  res.json(db.brands.filter((item) => item.is_active).sort((a, b) => a.name.localeCompare(b.name)));
});

function getAdminMutationActor(res: express.Response) {
  return {
    actorId: res.locals.user.id as string,
    actorName: (res.locals.user.user_metadata?.full_name || res.locals.user.email) as string,
    correlationId: (res.locals.requestId ?? createId()) as string,
  };
}

function getMarketingMutationContext(res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  return { actorId, actorName, correlationId };
}

function normalizeMarketingSlug(value: unknown, fallback: string) {
  const source = String(value || fallback || "");
  return (
    source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || createId()
  );
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeJsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeLifecycleStatus(value: unknown) {
  const allowed = new Set(["draft", "review", "scheduled", "active", "paused", "ended", "archived"]);
  return allowed.has(String(value)) ? String(value) : "draft";
}

function getListLimit(req: express.Request, fallback = 250) {
  const raw = Number(req.query.limit);
  return Number.isFinite(raw) ? Math.min(Math.max(1, raw), 500) : fallback;
}

async function handleAdminCreateBrand(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.brands.create", () => {
    const db = readDb();
    const mutation = createAdminBrand({
      db,
      body: req.body as Partial<DbBrand>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateBrand(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.brands.update", () => {
    const db = readDb();
    const mutation = updateAdminBrand({
      db,
      brandId: String(req.params.id),
      body: req.body as Partial<DbBrand>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateCategory(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.categories.update", () => {
    const db = readDb();
    const mutation = updateAdminCategory({
      db,
      categoryId: String(req.params.id),
      body: req.body as Partial<DbCategory>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateCommercialSettings(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.settings.commercial.update", () => {
    const db = readDb();
    const mutation = updateCommercialSettings({
      db,
      body: req.body as Partial<DbCommercialSettings>,
      actorId,
      actorName,
      correlationId,
    });
    writeDb(db);
    return mutation;
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateOrderStatus(req: express.Request, res: express.Response) {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.orders.status", () => {
    const db = readDb();
    const order = db.orders.find((item) => item.id === String(req.params.id));
    const nextStatus = req.body.status as OrderStatus;
    if (!order) {
      return { status: 404, payload: buildError("Pedido nao encontrado") };
    }
    if (!isValidOrderStatus(nextStatus)) {
      return { status: 400, payload: buildError("Status invalido") };
    }
    const transition = applyAdminOrderStatusTransition({
      db,
      order,
      nextStatus,
      actorId,
      actorName,
    });
    if (!transition.ok) {
      return { status: 400, payload: buildError(transition.error) };
    }

    ensureOrderOperationState(db, order);
    writeDb(db);
    return { status: 200, payload: { ...transition.order, operation_state: serializeOrderOperationState(db, ensureOrderOperationState(db, order)) } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateOrderManualAction(req: express.Request, res: express.Response) {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.orders.manual_action", () => {
    const db = readDb();
    const order = db.orders.find((item) => item.id === String(req.params.id));
    if (!order) {
      return { status: 404, payload: buildError("Pedido nao encontrado") };
    }
    const body = req.body as { note?: string; actionLabel?: string };
    if (!isNonEmptyString(body.note || "")) {
      return { status: 400, payload: buildError("Informe a observacao operacional") };
    }
    applyAdminOrderManualAction({
      db,
      order,
      actorId,
      actorName,
      note: body.note,
      actionLabel: body.actionLabel,
    });
    writeDb(db);
    return { status: 200, payload: { ok: true } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateOrderShipment(req: express.Request, res: express.Response) {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.orders.shipment", () => {
    const db = readDb();
    const order = db.orders.find((item) => item.id === String(req.params.id));
    if (!order) {
      return { status: 404, payload: buildError("Pedido nao encontrado") };
    }

    const body = req.body as {
      carrier?: string | null;
      service?: string | null;
      trackingCode?: string | null;
      trackingUrl?: string | null;
      estimatedDeliveryAt?: string | null;
      dispatchedAt?: string | null;
      notes?: string | null;
    };
    const shipment = applyAdminOrderShipmentUpdate({
      db,
      order,
      actorId,
      actorName,
      carrier: body.carrier,
      service: body.service,
      trackingCode: body.trackingCode,
      trackingUrl: body.trackingUrl,
      estimatedDeliveryAt: body.estimatedDeliveryAt,
      dispatchedAt: body.dispatchedAt,
      notes: body.notes,
    });
    if (!shipment.ok) {
      return { status: 400, payload: buildError(shipment.error) };
    }

    ensureOrderOperationState(db, order);
    writeDb(db);
    return { status: 200, payload: { ...shipment.order, operation_state: serializeOrderOperationState(db, ensureOrderOperationState(db, order)) } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminAssignOrderOwner(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const actor = res.locals.user as DatabaseShape["users"][number];
  const result = await runSerializedMutation("admin.orders.assign_owner", () => {
    const db = readDb();
    const mutation = assignOrderOperationOwner({
      db,
      orderId: String(req.params.id),
      ownerUserId: typeof req.body?.ownerUserId === "string" ? req.body.ownerUserId : null,
      actorId,
      actorName,
      actorProfileId: getUserPermissionProfileId(actor),
      correlationId,
      note: typeof req.body?.note === "string" ? req.body.note : null,
    });
    if (!mutation.ok) {
      return { status: 400, payload: buildError(mutation.error) };
    }
    writeDb(db);
    return { status: 200, payload: mutation.state };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminMarkOrderStuck(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const actor = res.locals.user as DatabaseShape["users"][number];
  const result = await runSerializedMutation("admin.orders.mark_stuck", () => {
    const db = readDb();
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      return { status: 400, payload: buildError("Informe o motivo do travamento") };
    }
    const waitingOn = typeof req.body?.waitingOn === "string" ? req.body.waitingOn as DbOrderOperation["waiting_on"] : null;
    const priority = typeof req.body?.priority === "string" ? req.body.priority as DbOrderOperation["priority"] : undefined;
    const mutation = markOrderOperationStuck({
      db,
      orderId: String(req.params.id),
      actorId,
      actorName,
      actorProfileId: getUserPermissionProfileId(actor),
      correlationId,
      reason,
      nextAction: typeof req.body?.nextAction === "string" ? req.body.nextAction : null,
      waitingOn,
      priority,
    });
    if (!mutation.ok) {
      return { status: 400, payload: buildError(mutation.error) };
    }
    writeDb(db);
    return { status: 200, payload: mutation.state };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminResolveOrderStuck(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const actor = res.locals.user as DatabaseShape["users"][number];
  const result = await runSerializedMutation("admin.orders.resolve_stuck", () => {
    const db = readDb();
    const nextStage = typeof req.body?.nextStage === "string" ? req.body.nextStage as OrderOperationStage : null;
    const mutation = resolveOrderOperationStuck({
      db,
      orderId: String(req.params.id),
      actorId,
      actorName,
      actorProfileId: getUserPermissionProfileId(actor),
      correlationId,
      note: typeof req.body?.note === "string" ? req.body.note : null,
      nextStage,
    });
    if (!mutation.ok) {
      return { status: 400, payload: buildError(mutation.error) };
    }
    writeDb(db);
    return { status: 200, payload: mutation.state };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminAdvanceOrderStage(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const actor = res.locals.user as DatabaseShape["users"][number];
  const result = await runSerializedMutation("admin.orders.advance_stage", () => {
    const db = readDb();
    const nextStage = typeof req.body?.nextStage === "string" ? req.body.nextStage as OrderOperationStage : null;
    if (!nextStage) {
      return { status: 400, payload: buildError("Informe a proxima etapa operacional") };
    }
    const mutation = advanceOrderOperationStage({
      db,
      orderId: String(req.params.id),
      actorId,
      actorName,
      actorProfileId: getUserPermissionProfileId(actor),
      correlationId,
      nextStage,
      note: typeof req.body?.note === "string" ? req.body.note : null,
    });
    if (!mutation.ok) {
      return { status: 400, payload: buildError(mutation.error) };
    }
    writeDb(db);
    return { status: 200, payload: { ...mutation.order, operation_state: mutation.state } };
  });
  res.status(result.status).json(result.payload);
}

type ExecutiveActionItem = {
  id: string;
  type: string;
  domain: string;
  severity: "CRITICO" | "ALTO" | "MEDIO" | "BAIXO" | "INFORMATIVO";
  title: string;
  description: string;
  impact: string;
  responsible_suggested: string;
  owner_role: string;
  sla_minutes: number;
  overdue: boolean;
  recommended_next_action: string;
  route: string;
  action_label: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_external_blocker: boolean;
  blocks_homologation: boolean;
  blocks_go_live: boolean;
  depends_on_third_party: boolean;
  depends_on_human_curation: boolean;
  depends_on_accountant: boolean;
  depends_on_provider: boolean;
  waiting_badge?: string | null;
};

function buildExecutiveBi(db: DatabaseShape) {
  const activeOrders = db.orders.filter((order) => order.status !== "cancelled");
  const activeOrderIds = new Set(activeOrders.map((order) => order.id));
  const activeOrderItems = db.orderItems.filter((item) => activeOrderIds.has(item.order_id));
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const last7Days = now - 7 * 24 * 60 * 60 * 1000;
  const last30Days = now - 30 * 24 * 60 * 60 * 1000;
  const paidStatuses = new Set(["payment_approved", "confirmed", "processing", "in_separation", "in_expedition", "shipped", "out_for_delivery", "delivered"]);
  const managementReferenceByCategory = new Map([
    ["ripados internos e externos", 189.9],
    ["chapas uv", 139.9],
    ["chapas policarbonato", 319.9],
    ["tetos laminados vinilicos", 119.9],
    ["pisos vinilicos", 94.9],
    ["forros pvc", 42.9],
    ["telha de fibrocimento", 78.9],
    ["telha de pvc", 84.9],
    ["acm", 289.9],
    ["perfil de aluminio", 74.9],
    ["drywall e acessórios", 54.9],
    ["drywall e acessorios", 54.9],
  ]);
  const getProductManagementReference = (product: DatabaseShape["products"][number] | undefined) => {
    const directPrice = Number(product?.price || product?.base_price || product?.original_price || 0);
    if (directPrice > 0) return directPrice;

    const category = db.categories.find((entry) => entry.id === product?.category_id);
    return managementReferenceByCategory.get(normalizeSearchText(category?.name || product?.subcategory || "")) ?? 1;
  };

  const getOrderManagementValue = (order: typeof activeOrders[number]) => {
    const orderTotal = Number(order.total || 0);
    if (orderTotal > 0) return orderTotal;

    const itemTotal = db.orderItems
      .filter((item) => item.order_id === order.id)
      .reduce((total, item) => {
        const explicitTotal = Number(item.total_price || 0);
        if (explicitTotal > 0) return total + explicitTotal;

        const product = db.products.find((entry) => entry.id === item.product_id);
        const referencePrice = getProductManagementReference(product);
        return total + referencePrice * Number(item.quantity || 0);
      }, 0);

    return itemTotal;
  };
  const sumRevenue = (orders: typeof activeOrders) => orders.reduce((total, order) => total + getOrderManagementValue(order), 0);
  const countBy = <K extends string>(orders: typeof activeOrders, getKey: (order: typeof activeOrders[number]) => K | null | undefined) => {
    const totals = new Map<K, { key: K; orders: number; revenue: number }>();
    orders.forEach((order) => {
      const key = getKey(order);
      if (!key) return;
      const current = totals.get(key) ?? { key, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += getOrderManagementValue(order);
      totals.set(key, current);
    });
    return [...totals.values()].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
  };

  const ordersToday = activeOrders.filter((order) => new Date(order.created_at).getTime() >= startOfToday.getTime());
  const ordersWeek = activeOrders.filter((order) => new Date(order.created_at).getTime() >= last7Days);
  const ordersMonth = activeOrders.filter((order) => new Date(order.created_at).getTime() >= last30Days);
  const totalRevenue = sumRevenue(activeOrders);
  const paidOrders = activeOrders.filter((order) => paidStatuses.has(order.status));
  const paidRevenue = sumRevenue(paidOrders);
  const awaitingPayment = activeOrders.filter((order) => ["pending", "awaiting_payment"].includes(order.status));
  const paidWaitingOperation = activeOrders.filter((order) => ["payment_approved", "confirmed"].includes(order.status));
  const inOperation = activeOrders.filter((order) => ["processing", "in_separation", "in_expedition", "shipped", "out_for_delivery"].includes(order.status));
  const delivered = activeOrders.filter((order) => order.status === "delivered");
  const assistedOrders = activeOrders.filter((order) => order.assisted_sale || order.order_type === "assisted");
  const operations = listOrderOperationStates(db);
  const operationByOwner = new Map<string, { owner_role: string; owner_label: string; total: number; overdue: number; stuck: number; oldest_age_minutes: number }>();
  operations.forEach((entry) => {
    const ownerRole = entry.current_owner_role || "sem_responsavel";
    const current = operationByOwner.get(ownerRole) ?? {
      owner_role: ownerRole,
      owner_label: entry.owner_label || ownerRole,
      total: 0,
      overdue: 0,
      stuck: 0,
      oldest_age_minutes: 0,
    };
    current.total += 1;
    if (entry.is_overdue) current.overdue += 1;
    if (entry.is_stuck) current.stuck += 1;
    current.oldest_age_minutes = Math.max(current.oldest_age_minutes, Number(entry.age_minutes || 0));
    operationByOwner.set(ownerRole, current);
  });
  const revenueAtRisk = sumRevenue([...awaitingPayment, ...paidWaitingOperation]);
  const productRevenue = new Map<string, { product_id: string; product_name: string; sku: string | null; quantity: number; revenue: number }>();
  activeOrderItems.forEach((item) => {
    const current = productRevenue.get(item.product_id) ?? {
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.product_sku ?? null,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.total_price || 0);
    productRevenue.set(item.product_id, current);
  });
  const categoryRevenue = new Map<string, { key: string; orders: number; revenue: number }>();
  activeOrderItems.forEach((item) => {
    const product = db.products.find((entry) => entry.id === item.product_id);
    const category = db.categories.find((entry) => entry.id === product?.category_id);
    const key = category?.name || "Sem categoria";
    const current = categoryRevenue.get(key) ?? { key, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += Number(item.total_price || 0);
    categoryRevenue.set(key, current);
  });
  const bottleneck = [
    { key: "awaiting_payment", label: "Pagamento pendente", count: awaitingPayment.length, revenue: sumRevenue(awaitingPayment), action: "Acionar atendimento/venda assistida para recuperar pedido." },
    { key: "paid_waiting_operation", label: "Receita paga parada", count: paidWaitingOperation.length, revenue: sumRevenue(paidWaitingOperation), action: "Avancar conferencia, separacao ou faturamento assistido." },
    { key: "overdue_sla", label: "SLA operacional vencido", count: operations.filter((entry) => entry.is_overdue).length, revenue: 0, action: "Distribuir responsaveis e tratar pedidos vencidos." },
    { key: "stuck_orders", label: "Pedidos travados", count: operations.filter((entry) => entry.is_stuck).length, revenue: 0, action: "Abrir pedido travado e registrar decisao/resolucao." },
  ].sort((a, b) => b.count - a.count || b.revenue - a.revenue)[0] ?? null;

  return {
    generated_at: new Date().toISOString(),
    summary: {
      orders_total: activeOrders.length,
      revenue_total: totalRevenue,
      paid_orders: paidOrders.length,
      paid_revenue: paidRevenue,
      average_ticket: activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0,
      assisted_orders: assistedOrders.length,
      assisted_share_percent: activeOrders.length > 0 ? Math.round((assistedOrders.length / activeOrders.length) * 100) : 0,
      pickup_orders: activeOrders.filter((order) => order.delivery_type === "pickup").length,
      delivery_orders: activeOrders.filter((order) => order.delivery_type === "delivery").length,
      revenue_at_risk: revenueAtRisk,
    },
    periods: {
      today: { orders: ordersToday.length, revenue: sumRevenue(ordersToday) },
      last_7_days: { orders: ordersWeek.length, revenue: sumRevenue(ordersWeek) },
      last_30_days: { orders: ordersMonth.length, revenue: sumRevenue(ordersMonth) },
    },
    funnel: [
      { key: "awaiting_payment", label: "Aguardando pagamento", orders: awaitingPayment.length, revenue: sumRevenue(awaitingPayment), action: "Cobrar pagamento ou revisar pedido pendente." },
      { key: "paid_waiting_operation", label: "Pago aguardando operacao", orders: paidWaitingOperation.length, revenue: sumRevenue(paidWaitingOperation), action: "Liberar conferencia, separacao ou faturamento assistido." },
      { key: "in_operation", label: "Em separacao/entrega", orders: inOperation.length, revenue: sumRevenue(inOperation), action: "Acompanhar SLA de separacao e ultima milha." },
      { key: "delivered", label: "Entregue", orders: delivered.length, revenue: sumRevenue(delivered), action: "Monitorar pos-venda, recompra e atendimento." },
    ],
    channel_mix: countBy(activeOrders, (order) => order.source_channel || order.order_origin || "web"),
    delivery_mix: countBy(activeOrders, (order) => order.delivery_type),
    payment_mix: countBy(activeOrders, (order) => order.payment_method),
    top_products: [...productRevenue.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 8),
    category_mix: [...categoryRevenue.values()].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders).slice(0, 8),
    owner_sla: [...operationByOwner.values()].sort((a, b) => b.overdue - a.overdue || b.stuck - a.stuck || b.total - a.total),
    executive_focus: {
      bottleneck,
      revenue_at_risk: revenueAtRisk,
      next_action: bottleneck?.action || "Manter rotina diaria de leitura da Central Executiva.",
    },
    management_notes: [
      paidWaitingOperation.length > 0 ? "Ha receita paga esperando avanco operacional; priorize separacao/conferencia." : "Sem receita paga parada no funil operacional.",
      awaitingPayment.length > 0 ? "Ha pedidos aguardando pagamento; acione atendimento ou venda assistida." : "Sem fila relevante de pagamento pendente.",
      assistedOrders.length > 0 ? "Venda assistida ja aparece no mix; acompanhe conversao por vendedor no cockpit comercial." : "Venda assistida ainda nao pesa no mix atual.",
    ],
  };
}

function getExecutiveActionCenterData(db: DatabaseShape, options?: {
  fiscalReadiness?: ReturnType<typeof getAdminFiscalReadiness>;
  operationReadiness?: ReturnType<typeof getOperationReadinessReport>;
  marketingReadiness?: ReturnType<typeof getMarketingReadiness>;
  integrationProviders?: ReturnType<typeof listIntegrationProviders>;
  imageAudit?: ReturnType<typeof getAdminCatalogImageAudit>;
  security?: Awaited<ReturnType<typeof getSecurityReadinessReport>>;
}) {
  const fiscalReadiness = options?.fiscalReadiness ?? getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const marketingReadiness = options?.marketingReadiness ?? getMarketingReadiness(db);
  const imageAudit = options?.imageAudit ?? getAdminCatalogImageAudit(db);
  const providers = options?.integrationProviders ?? listIntegrationProviders(db);
  const orderItems = buildOperationActionCenterItems(db);

  const items: ExecutiveActionItem[] = [
    ...orderItems,
    ...(fiscalReadiness.details?.pending_fiscal_profiles ?? []).slice(0, 6).map((profile) => ({
      id: `fiscal-profile-${profile.fiscal_profile_id}`,
      type: "fiscal_profile",
      domain: "Fiscal pendente",
      severity: "CRITICO" as const,
      title: `Perfil fiscal pendente: ${profile.product_name}`,
      description: `Campos faltantes: ${profile.missing_fields.join(", ")}.`,
      impact: "Impede fiscal minimo e bloqueia go-live aberto.",
      responsible_suggested: "Fiscal e Contador",
      owner_role: "fiscal_contador",
      sla_minutes: 24 * 60,
      overdue: true,
      recommended_next_action: profile.recommended_action,
      route: "/admin/fiscal-financeiro",
      action_label: "Abrir fiscal",
      status: "pending_fiscal_profile",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_external_blocker: true,
      blocks_homologation: true,
      blocks_go_live: true,
      depends_on_third_party: false,
      depends_on_human_curation: false,
      depends_on_accountant: true,
      depends_on_provider: false,
    })),
    ...(imageAudit.active_summary.critical > 0 ? [{
      id: "catalog-image-critical",
      type: "catalog_image",
      domain: "Catalogo visual",
      severity: "ALTO" as const,
      title: "Produtos ativos com imagem critica",
      description: `${imageAudit.active_summary.critical} produto(s) ativos seguem sem imagem valida ou com placeholder.`,
      impact: "Bloqueia campanha, home e confianca visual do mix publico.",
      responsible_suggested: "Catalogo e Conteudo",
      owner_role: "catalogo_conteudo",
      sla_minutes: 8 * 60,
      overdue: true,
      recommended_next_action: "Abrir a fila visual e revisar os ativos criticos antes de publicar campanha.",
      route: "/admin/produtos",
      action_label: "Abrir produtos",
      status: "critical",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_external_blocker: false,
      blocks_homologation: false,
      blocks_go_live: true,
      depends_on_third_party: false,
      depends_on_human_curation: true,
      depends_on_accountant: false,
      depends_on_provider: false,
    }] : []),
    ...(imageAudit.active_summary.suspect > 0 ? [{
      id: "catalog-image-suspect",
      type: "catalog_image",
      domain: "Catalogo visual",
      severity: "MEDIO" as const,
      title: "Catalogo ativo com imagem suspeita",
      description: `${imageAudit.active_summary.suspect} produto(s) ativos exigem revisao humana de midia.`,
      impact: "Pode prejudicar campanha e experiencia da PDP.",
      responsible_suggested: "Catalogo e Conteudo",
      owner_role: "catalogo_conteudo",
      sla_minutes: 24 * 60,
      overdue: false,
      recommended_next_action: "Priorizar os suspeitos ativos e aplicar override apenas com validacao real.",
      route: "/admin/produtos",
      action_label: "Abrir curadoria",
      status: "suspect",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_external_blocker: false,
      blocks_homologation: false,
      blocks_go_live: false,
      depends_on_third_party: false,
      depends_on_human_curation: true,
      depends_on_accountant: false,
      depends_on_provider: false,
    }] : []),
    ...(providers.filter((provider) => provider.is_required_for_production && (!provider.is_configured || provider.status !== "production")).slice(0, 6).map((provider) => ({
      id: `provider-${provider.key}`,
      type: "integration_provider",
      domain: "Integracoes pendentes",
      severity: "ALTO" as const,
      title: `Provider obrigatorio pendente: ${provider.name}`,
      description: provider.last_status_message || "Provider obrigatorio ainda nao homologado para producao.",
      impact: "Mantem o ecommerce dependente de fallback e bloqueia producao aberta.",
      responsible_suggested: "Admin Master / DevOps",
      owner_role: "admin_master",
      sla_minutes: 24 * 60,
      overdue: true,
      recommended_next_action: "Configurar, testar sandbox e preparar dupla aprovacao para producao.",
      route: "/admin/integracoes",
      action_label: "Abrir integracoes",
      status: provider.status,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
      is_external_blocker: true,
      blocks_homologation: false,
      blocks_go_live: true,
      depends_on_third_party: true,
      depends_on_human_curation: false,
      depends_on_accountant: false,
      depends_on_provider: true,
    })) ?? []),
    ...(marketingReadiness.blockers > 0 ? [{
      id: "marketing-blocked",
      type: "marketing",
      domain: "Campanhas bloqueadas",
      severity: "MEDIO" as const,
      title: "Campanha pronta, mas com bloqueios de publicacao",
      description: `${marketingReadiness.blockers} bloqueio(s) impedem ativacao limpa de campanha.`,
      impact: "A campanha nao consegue assumir hero, vitrines ou landing com seguranca.",
      responsible_suggested: "Gestor Comercial",
      owner_role: "gestor_comercial",
      sla_minutes: 8 * 60,
      overdue: false,
      recommended_next_action: "Abrir Marketing e revisar superfícies, CTA e mix bloqueado.",
      route: "/admin/marketing",
      action_label: "Abrir marketing",
      status: "blocked",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_external_blocker: false,
      blocks_homologation: false,
      blocks_go_live: false,
      depends_on_third_party: false,
      depends_on_human_curation: false,
      depends_on_accountant: false,
      depends_on_provider: false,
    }] : []),
  ];

  const severityWeight = { CRITICO: 4, ALTO: 3, MEDIO: 2, BAIXO: 1, INFORMATIVO: 0 };
  const sortedItems = items.sort((a, b) => {
    const severityDelta = severityWeight[b.severity] - severityWeight[a.severity];
    if (severityDelta !== 0) return severityDelta;
    if (a.overdue !== b.overdue) return Number(b.overdue) - Number(a.overdue);
    return b.updated_at.localeCompare(a.updated_at);
  });

  return {
    generated_at: new Date().toISOString(),
    summary: {
      critical: sortedItems.filter((item) => item.severity === "CRITICO").length,
      high: sortedItems.filter((item) => item.severity === "ALTO").length,
      medium: sortedItems.filter((item) => item.severity === "MEDIO").length,
      low: sortedItems.filter((item) => item.severity === "BAIXO").length,
      informational: sortedItems.filter((item) => item.severity === "INFORMATIVO").length,
      internal_blockers: sortedItems.filter((item) => !item.is_external_blocker && (item.severity === "CRITICO" || item.severity === "ALTO")).length,
      external_blockers: sortedItems.filter((item) => item.is_external_blocker).length,
      overdue: sortedItems.filter((item) => item.overdue).length,
    },
    items: sortedItems,
  };
}

function buildExecutiveReport(db: DatabaseShape) {
  const bi = buildExecutiveBi(db);
  const actionCenter = getExecutiveActionCenterData(db);
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const operation = getOperationReadinessReport(db);
  const marketing = getMarketingReadiness(db);
  const providers = listIntegrationProviders(db);
  const requiredProviders = providers.filter((provider) => provider.is_required_for_production);
  const providerBlockers = requiredProviders.filter((provider) => !provider.is_configured || provider.status !== "production");
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Relatorio executivo da Central Admin",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    "## Decisao rapida",
    "",
    `- Gargalo principal: ${bi.executive_focus.bottleneck?.label || "Sem gargalo operacional dominante"}`,
    `- Proxima acao: ${bi.executive_focus.next_action}`,
    `- Receita em risco: R$ ${bi.executive_focus.revenue_at_risk.toFixed(2)}`,
    `- Acoes criticas: ${actionCenter.summary.critical}`,
    `- Acoes externas: ${actionCenter.summary.external_blockers}`,
    "",
    "## Vendas e operacao",
    "",
    `- Pedidos ativos: ${bi.summary.orders_total}`,
    `- Receita total: R$ ${bi.summary.revenue_total.toFixed(2)}`,
    `- Receita paga: R$ ${bi.summary.paid_revenue.toFixed(2)}`,
    `- Ticket medio: R$ ${bi.summary.average_ticket.toFixed(2)}`,
    `- Venda assistida: ${bi.summary.assisted_orders} pedido(s), ${bi.summary.assisted_share_percent}% do mix`,
    "",
    "## Funil operacional",
    "",
    ...bi.funnel.map((stage) => `- ${stage.label}: ${stage.orders} pedido(s), R$ ${stage.revenue.toFixed(2)} - ${stage.action}`),
    "",
    "## Responsaveis e SLA",
    "",
    ...(bi.owner_sla.length > 0
      ? bi.owner_sla.map((owner) => `- ${owner.owner_label}: ${owner.total} item(ns), ${owner.overdue} vencido(s), ${owner.stuck} travado(s)`)
      : ["- Sem fila operacional registrada por responsavel."]),
    "",
    "## Fiscal, marketing e provedores",
    "",
    `- Fiscal minimo: ${fiscal.ready ? "pronto" : "bloqueado"} (${fiscal.blockers} blocker(s))`,
    `- Operacao: ${operation.ready ? "pronta" : "atencao"} (${operation.blockers} blocker(s))`,
    `- Marketing: ${marketing.ready ? "pronto" : "atencao"} (${marketing.blockers} blocker(s), ${marketing.warnings} warning(s))`,
    `- Providers obrigatorios pendentes: ${providerBlockers.length}`,
    "",
    "## Acoes prioritarias",
    "",
    ...(actionCenter.items.slice(0, 12).map((item) => `- [${item.severity}] ${item.title} - ${item.responsible_suggested}: ${item.recommended_next_action}`)),
    "",
  ].join("\n");

  return {
    generated_at: generatedAt,
    decision: {
      bottleneck: bi.executive_focus.bottleneck,
      next_action: bi.executive_focus.next_action,
      revenue_at_risk: bi.executive_focus.revenue_at_risk,
    },
    bi,
    action_center: actionCenter,
    readiness: {
      fiscal,
      operation,
      marketing,
      provider_blockers: providerBlockers.map((provider) => ({
        key: provider.key,
        label: provider.name,
        status: provider.status,
        note: provider.last_status_message,
      })),
    },
    markdown,
  };
}

function buildExecutiveRoutine(db: DatabaseShape) {
  const bi = buildExecutiveBi(db);
  const actionCenter = getExecutiveActionCenterData(db);
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const operation = getOperationReadinessReport(db);
  const marketing = getMarketingReadiness(db);
  const providers = listIntegrationProviders(db);
  const requiredProviderBlockers = providers.filter((provider) => provider.is_required_for_production && (!provider.is_configured || provider.status !== "production"));
  const topAction = actionCenter.items[0] ?? null;
  const revenueAtRisk = bi.executive_focus.revenue_at_risk;
  const overdueOwners = bi.owner_sla.filter((owner) => owner.overdue > 0 || owner.stuck > 0);

  const checkpoints = [
    {
      key: "opening",
      label: "Abertura do dia",
      when: "08:00",
      owner: "Gerente ecommerce",
      status: actionCenter.summary.critical > 0 || revenueAtRisk > 0 ? "atencao" : "pronto",
      actions: [
        bi.executive_focus.next_action,
        topAction ? `Executar acao prioritaria: ${topAction.title}.` : "Confirmar que nao ha acao critica aberta.",
        `${bi.periods.today.orders} pedido(s) criado(s) hoje, R$ ${bi.periods.today.revenue.toFixed(2)} em receita.`,
      ],
    },
    {
      key: "midday",
      label: "Meio do dia",
      when: "12:00",
      owner: "Operacao / Atendimento",
      status: overdueOwners.length > 0 || actionCenter.summary.overdue > 0 ? "atencao" : "pronto",
      actions: [
        `${actionCenter.summary.overdue} acao(oes) com SLA vencido no centro executivo.`,
        overdueOwners.length > 0 ? `Tratar responsaveis com fila vencida: ${overdueOwners.slice(0, 3).map((owner) => owner.owner_label).join(", ")}.` : "Confirmar que separacao, fiscal e atendimento seguem dentro do SLA.",
        "Revisar pedidos pagos aguardando operacao antes do pico da tarde.",
      ],
    },
    {
      key: "closing",
      label: "Fechamento do dia",
      when: "17:30",
      owner: "Direcao / Gerente ecommerce",
      status: fiscal.ready && operation.ready ? "pronto" : "atencao",
      actions: [
        `Receita paga acumulada: R$ ${bi.summary.paid_revenue.toFixed(2)}.`,
        `Fiscal minimo: ${fiscal.ready ? "pronto" : `${fiscal.blockers} blocker(s)`}; Operacao: ${operation.ready ? "pronta" : `${operation.blockers} blocker(s)`}.`,
        "Registrar decisoes externas pendentes como BLOQUEADO EXTERNO quando dependerem de fornecedor, contador ou credencial real.",
      ],
    },
    {
      key: "pre_campaign",
      label: "Pre-campanha",
      when: "D-1 / 16:00",
      owner: "Comercial / Marketing",
      status: marketing.blockers > 0 ? "bloqueado" : marketing.warnings > 0 ? "atencao" : "pronto",
      actions: [
        `Marketing readiness: ${marketing.blockers} blocker(s), ${marketing.warnings} warning(s).`,
        "Validar hero, banners mobile, landing, cupom, vitrines e produtos vinculados.",
        "Conferir produtos de maior receita no BI antes de priorizar a vitrine.",
      ],
    },
    {
      key: "pre_go_live",
      label: "Pre-go-live",
      when: "D-1 / 18:00",
      owner: "Admin Master / DevOps",
      status: requiredProviderBlockers.length > 0 || !fiscal.ready ? "bloqueado" : "pronto",
      actions: [
        requiredProviderBlockers.length > 0 ? `${requiredProviderBlockers.length} provider(s) obrigatorio(s) seguem como BLOQUEADO EXTERNO.` : "Providers obrigatorios sem bloqueio detectado.",
        fiscal.ready ? "Fiscal minimo liberado para operacao controlada." : "Fiscal minimo depende de dados reais validados.",
        "Confirmar dominio HTTPS, cookies seguros, monitoramento, backup/restore e credenciais reais antes de abertura publica.",
      ],
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    daily_focus: {
      title: bi.executive_focus.bottleneck?.label || topAction?.title || "Rotina executiva sem gargalo dominante",
      detail: topAction?.description || bi.management_notes[0] || "Manter leitura diaria de vendas, operacao, fiscal e campanha.",
      action: topAction?.recommended_next_action || bi.executive_focus.next_action,
      route: topAction?.route || "/admin/pedidos",
    },
    checkpoints,
  };
}

function buildExecutiveCampaignCockpit(db: DatabaseShape) {
  const overview = getMarketingOverview(db);
  const reports = getMarketingReports(db);
  const readiness = getMarketingReadiness(db);
  const publicState = getPublicMarketingState(db);
  const activeCampaigns = (overview.active.campaigns ?? []) as DbMarketingCampaign[];
  const primaryCampaign =
    (publicState.site_experience.active_campaign as DbMarketingCampaign | null | undefined) ??
    [...activeCampaigns].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))[0] ??
    null;
  const report = primaryCampaign ? reports.campaigns.find((campaign) => campaign.campaign_id === primaryCampaign.id) : null;
  const landing = primaryCampaign?.landing_page_id ? db.campaignLandingPages.find((entry) => entry.id === primaryCampaign.landing_page_id) : null;
  const linkedProducts = Array.isArray(primaryCampaign?.products_json) ? primaryCampaign.products_json.length : 0;
  const linkedCategories = Array.isArray(primaryCampaign?.categories_json) ? primaryCampaign.categories_json.length : 0;
  const hasCoupon = Boolean(primaryCampaign?.coupon_id);
  const hasHero = Boolean(primaryCampaign?.headline && (primaryCampaign.banner_desktop || primaryCampaign.banner_mobile));
  const hasLanding = Boolean(landing || primaryCampaign?.landing_page_id || primaryCampaign?.slug);
  const hasWhatsapp = Boolean(primaryCampaign?.whatsapp_message || primaryCampaign?.cta_url?.includes("wa.me") || primaryCampaign?.cta_url?.includes("whatsapp"));
  const hasHomeShowcase = (overview.active.showcases ?? []).some((showcase) => (showcase as { campaign_id?: string | null }).campaign_id === primaryCampaign?.id);
  const hasCategoryFocus = linkedCategories > 0;
  const metrics = report ?? {
    campaign_id: primaryCampaign?.id ?? "",
    name: primaryCampaign?.name ?? "Sem campanha ativa",
    slug: primaryCampaign?.slug ?? "",
    status: primaryCampaign?.status ?? "inactive",
    views: 0,
    banner_clicks: 0,
    whatsapp_clicks: 0,
    product_clicks: 0,
    checkout_starts: 0,
    orders: 0,
    total_events: 0,
  };
  const surfaces = [
    { key: "hero", label: "Hero/banner", ready: hasHero, detail: hasHero ? "Headline e banner principal configurados." : "Falta headline ou imagem desktop/mobile." },
    { key: "landing", label: "Landing", ready: hasLanding, detail: hasLanding ? "Destino de campanha disponivel." : "Landing/slug ainda nao definido." },
    { key: "home_showcase", label: "Vitrine home", ready: hasHomeShowcase, detail: hasHomeShowcase ? "Ha vitrine ativa vinculada." : "Sem vitrine home ativa vinculada a campanha." },
    { key: "category_focus", label: "Categorias", ready: hasCategoryFocus, detail: hasCategoryFocus ? `${linkedCategories} categoria(s) vinculada(s).` : "Sem foco de categoria definido." },
    { key: "coupon", label: "Cupom", ready: hasCoupon, detail: hasCoupon ? "Cupom vinculado." : "Sem cupom vinculado." },
    { key: "whatsapp", label: "WhatsApp", ready: hasWhatsapp, detail: hasWhatsapp ? "CTA/mensagem WhatsApp configurado." : "Sem CTA WhatsApp de campanha." },
  ];
  const risks = [
    ...readiness.checks.blockers.map((item) => ({ severity: "bloqueio", title: item.item, detail: item.detail })),
    ...readiness.checks.warnings.slice(0, 6).map((item) => ({ severity: "atencao", title: item.item, detail: item.detail })),
    ...surfaces.filter((surface) => !surface.ready).slice(0, 4).map((surface) => ({ severity: "atencao", title: `${surface.label} incompleto`, detail: surface.detail })),
  ];
  const nextActions = [
    !primaryCampaign ? "Criar ou ativar uma campanha antes de planejar disparo comercial." : null,
    primaryCampaign && !hasHero ? "Completar hero com headline e banner desktop/mobile." : null,
    primaryCampaign && !hasHomeShowcase ? "Vincular vitrine home com produtos da campanha." : null,
    primaryCampaign && linkedProducts === 0 ? "Vincular produtos reais da campanha antes de anunciar." : null,
    primaryCampaign && risks.length === 0 ? "Campanha sem bloqueio detectado; acompanhar eventos, cliques e pedidos durante a janela." : null,
  ].filter(Boolean);

  return {
    generated_at: new Date().toISOString(),
    active_campaign: primaryCampaign ? {
      id: primaryCampaign.id,
      name: primaryCampaign.name,
      slug: primaryCampaign.slug,
      status: primaryCampaign.status,
      objective: primaryCampaign.objective,
      priority: primaryCampaign.priority,
      starts_at: primaryCampaign.starts_at,
      ends_at: primaryCampaign.ends_at,
      linked_products: linkedProducts,
      linked_categories: linkedCategories,
    } : null,
    metrics,
    surfaces,
    risks: risks.slice(0, 12),
    next_actions: nextActions,
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildExecutiveActionsCsv(db: DatabaseShape) {
  const actionCenter = getExecutiveActionCenterData(db);
  const rows = [
    ["id", "type", "domain", "severity", "title", "responsible", "status", "external", "overdue", "next_action", "route"],
    ...actionCenter.items.map((item) => [
      item.id,
      item.type,
      item.domain,
      item.severity,
      item.title,
      item.responsible_suggested,
      item.status,
      item.is_external_blocker ? "sim" : "nao",
      item.overdue ? "sim" : "nao",
      item.recommended_next_action,
      item.route,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(";")).join("\n");
}

function buildExecutiveResponsibilityMatrix(db: DatabaseShape) {
  const actionCenter = getExecutiveActionCenterData(db);
  const bi = buildExecutiveBi(db);
  const ownerSlaByRole = new Map(bi.owner_sla.map((owner) => [owner.owner_role, owner]));
  const matrix = new Map<string, {
    owner_role: string;
    owner_label: string;
    suggested_responsible: string;
    total_actions: number;
    critical: number;
    high: number;
    overdue: number;
    external_blockers: number;
    internal_blockers: number;
    operation_total: number;
    operation_overdue: number;
    operation_stuck: number;
    oldest_age_minutes: number;
    routes: string[];
    top_actions: Array<{ id: string; severity: string; title: string; route: string; next_action: string; external: boolean }>;
  }>();
  const ensureOwner = (ownerRole: string, suggestedResponsible: string) => {
    const ownerSla = ownerSlaByRole.get(ownerRole);
    const current = matrix.get(ownerRole) ?? {
      owner_role: ownerRole,
      owner_label: ownerSla?.owner_label || suggestedResponsible || ownerRole,
      suggested_responsible: suggestedResponsible || ownerSla?.owner_label || ownerRole,
      total_actions: 0,
      critical: 0,
      high: 0,
      overdue: 0,
      external_blockers: 0,
      internal_blockers: 0,
      operation_total: ownerSla?.total ?? 0,
      operation_overdue: ownerSla?.overdue ?? 0,
      operation_stuck: ownerSla?.stuck ?? 0,
      oldest_age_minutes: ownerSla?.oldest_age_minutes ?? 0,
      routes: [],
      top_actions: [],
    };
    matrix.set(ownerRole, current);
    return current;
  };

  bi.owner_sla.forEach((owner) => {
    ensureOwner(owner.owner_role, owner.owner_label);
  });

  actionCenter.items.forEach((item) => {
    const owner = ensureOwner(item.owner_role || "sem_responsavel", item.responsible_suggested);
    owner.total_actions += 1;
    if (item.severity === "CRITICO") owner.critical += 1;
    if (item.severity === "ALTO") owner.high += 1;
    if (item.overdue) owner.overdue += 1;
    if (item.is_external_blocker) owner.external_blockers += 1;
    if (!item.is_external_blocker && (item.severity === "CRITICO" || item.severity === "ALTO")) owner.internal_blockers += 1;
    if (!owner.routes.includes(item.route)) owner.routes.push(item.route);
    if (owner.top_actions.length < 4) {
      owner.top_actions.push({
        id: item.id,
        severity: item.severity,
        title: item.title,
        route: item.route,
        next_action: item.recommended_next_action,
        external: item.is_external_blocker,
      });
    }
  });

  const owners = [...matrix.values()].sort((a, b) => {
    const criticalDelta = b.critical - a.critical;
    if (criticalDelta !== 0) return criticalDelta;
    const overdueDelta = b.overdue + b.operation_overdue - (a.overdue + a.operation_overdue);
    if (overdueDelta !== 0) return overdueDelta;
    return b.total_actions + b.operation_total - (a.total_actions + a.operation_total);
  });

  return {
    generated_at: new Date().toISOString(),
    summary: {
      owners: owners.length,
      owners_with_critical: owners.filter((owner) => owner.critical > 0).length,
      owners_with_external_blockers: owners.filter((owner) => owner.external_blockers > 0).length,
      owners_with_overdue: owners.filter((owner) => owner.overdue > 0 || owner.operation_overdue > 0).length,
      actions_total: owners.reduce((total, owner) => total + owner.total_actions, 0),
      operation_total: owners.reduce((total, owner) => total + owner.operation_total, 0),
    },
    owners,
  };
}

async function buildExecutiveDecisionBoard(db: DatabaseShape) {
  const [
    phase1,
    phase2,
    security,
    goLive,
    release,
  ] = await Promise.all([
    getPhase1ReadinessReport(),
    getPhase2ReadinessReport(),
    getSecurityReadinessReport(),
    getGoLiveReadinessReport(),
    getReleaseReadinessReport(db),
  ]);
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const operation = getOperationReadinessReport(db);
  const marketing = getMarketingReadiness(db);
  const integrations = getIntegrationReadiness(db);
  const actionCenter = getExecutiveActionCenterData(db, { fiscalReadiness: fiscal, operationReadiness: operation, marketingReadiness: marketing });
  const queueStats = getQueueStats();
  const reconciliation = getAdminReconciliationSummary(db) as unknown as Record<string, unknown>;
  const bi = buildExecutiveBi(db);
  const providers = listIntegrationProviders(db);
  const requiredProviderBlockers = providers.filter((provider) => provider.is_required_for_production && (!provider.is_configured || provider.status !== "production"));
  const readNumber = (source: Record<string, unknown>, key: string) => {
    const value = source[key];
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  };
  const gates = [
    { key: "phase1", label: "Fase 1 infra local", ready: Boolean(phase1.ok), blockers: Number(phase1.blockers || 0), warnings: Number(phase1.warnings || 0), owner: "DevOps" },
    { key: "phase2", label: "Fase 2 providers", ready: Boolean(phase2.phase2_ready), blockers: Number(phase2.blockers || 0), warnings: Number(phase2.warnings || 0), owner: "Admin Master / Fornecedores" },
    { key: "security", label: "Seguranca", ready: Boolean(security.ready), blockers: Number(security.blockers || 0), warnings: Number(security.warnings || 0), owner: "DevOps / Security" },
    { key: "fiscal", label: "Fiscal minimo", ready: Boolean(fiscal.ready), blockers: Number(fiscal.blockers || 0), warnings: Number(fiscal.warnings || 0), owner: "Fiscal / Contador" },
    { key: "operations", label: "Operacao", ready: Boolean(operation.ready), blockers: Number(operation.blockers || 0), warnings: Number(operation.warnings || 0), owner: "Operacao" },
    { key: "integrations", label: "Integracoes", ready: Boolean(integrations.ready), blockers: Number(integrations.blockers || 0), warnings: Number(integrations.warnings || 0), owner: "Admin Master" },
    { key: "marketing", label: "Marketing", ready: Boolean(marketing.ready), blockers: Number(marketing.blockers || 0), warnings: Number(marketing.warnings || 0), owner: "Comercial / Marketing" },
    { key: "release", label: "Release", ready: Boolean(release.ready), blockers: Number(release.blockers || 0), warnings: Number(release.warnings || 0), owner: "Tecnologia" },
    { key: "go_live", label: "Go-live aberto", ready: Boolean(goLive.go_live_ready), blockers: Number(goLive.blockers || 0), warnings: Number(goLive.warnings || 0), owner: "Direcao / Admin Master" },
  ].map((gate) => ({
    ...gate,
    status: gate.ready ? "pronto" : gate.blockers > 0 ? "bloqueado" : "atencao",
  }));
  const blockers = gates.reduce((total, gate) => total + gate.blockers, 0);
  const warnings = gates.reduce((total, gate) => total + gate.warnings, 0);
  const canOperateAssisted = fiscal.ready && operation.ready && actionCenter.summary.critical === 0;
  const canOpenPublic = blockers === 0 && requiredProviderBlockers.length === 0 && security.ready && Boolean(goLive.go_live_ready);
  const verdict = canOpenPublic
    ? {
      status: "liberado_controlado",
      label: "Go-live controlado liberavel",
      detail: "Gates criticos sem bloqueio detectado; manter monitoramento assistido e plano de rollback.",
      next_action: "Validar dominio HTTPS, backup/restore e observabilidade no ambiente final antes da janela.",
    }
    : canOperateAssisted
      ? {
        status: "operacao_assistida",
        label: "Operacao assistida liberada",
        detail: "Fluxo interno pode operar com acompanhamento, mas producao aberta ainda depende de gates externos/tecnicos.",
        next_action: "Executar fila 24h e manter blockers externos registrados sem token falso.",
      }
      : {
        status: "bloqueado",
        label: "Go-live bloqueado",
        detail: "Ha bloqueios criticos em fiscal, operacao, seguranca, integracoes ou release.",
        next_action: actionCenter.items[0]?.recommended_next_action || "Resolver o primeiro blocker critico do Centro de Acoes.",
      };
  const next24h = actionCenter.items.slice(0, 8).map((item) => ({
    id: item.id,
    severity: item.severity,
    title: item.title,
    owner: item.responsible_suggested,
    route: item.route,
    action: item.recommended_next_action,
    external: item.is_external_blocker,
  }));
  const next72h = [
    requiredProviderBlockers.length > 0 ? {
      title: "Fechar providers obrigatorios",
      owner: "Admin Master / Fornecedores",
      detail: `${requiredProviderBlockers.length} provider(s) obrigatorio(s) ainda pendente(s) para producao.`,
      route: "/admin/integracoes",
      external: true,
    } : null,
    !fiscal.ready ? {
      title: "Validar fiscal minimo com contador",
      owner: "Fiscal / Contador",
      detail: `${fiscal.blockers} blocker(s) fiscal(is) impedem liberacao aberta.`,
      route: "/admin/fiscal-financeiro",
      external: true,
    } : null,
    marketing.blockers > 0 || marketing.warnings > 0 ? {
      title: "Preparar campanha sem pendencias",
      owner: "Comercial / Marketing",
      detail: `${marketing.blockers} blocker(s), ${marketing.warnings} warning(s) em marketing.`,
      route: "/admin/marketing",
      external: false,
    } : null,
    actionCenter.summary.overdue > 0 ? {
      title: "Zerar SLA vencido",
      owner: "Gerente ecommerce / Operacao",
      detail: `${actionCenter.summary.overdue} item(ns) vencido(s) no Centro de Acoes.`,
      route: "/admin/meu-workspace",
      external: false,
    } : null,
  ].filter(Boolean);

  return {
    generated_at: new Date().toISOString(),
    verdict,
    scorecard: {
      blockers,
      warnings,
      external_blockers: actionCenter.summary.external_blockers + requiredProviderBlockers.length,
      internal_blockers: actionCenter.summary.internal_blockers,
      overdue_actions: actionCenter.summary.overdue,
      revenue_at_risk: bi.executive_focus.revenue_at_risk,
      paid_revenue: bi.summary.paid_revenue,
      active_orders: bi.summary.orders_total,
    },
    gates,
    operational_signals: {
      queue_provider: appConfig.queueProvider,
      pending_jobs: Object.values(queueStats.queues ?? {}).reduce((total, queue) => total + Number(queue.queued ?? 0), 0),
      failed_jobs: Object.values(queueStats.queues ?? {}).reduce((total, queue) => total + Number(queue.failed ?? 0), 0),
      database_provider: appConfig.dbProvider,
      reconciliation_pending: readNumber(reconciliation, "pending"),
      reconciliation_critical: readNumber(reconciliation, "critical"),
    },
    next_24h: next24h,
    next_72h: next72h,
  };
}

async function buildExecutiveBriefing(db: DatabaseShape) {
  const decisionBoard = await buildExecutiveDecisionBoard(db);
  const routine = buildExecutiveRoutine(db);
  const campaign = buildExecutiveCampaignCockpit(db);
  const bi = buildExecutiveBi(db);
  const actionCenter = getExecutiveActionCenterData(db);
  const generatedAt = new Date().toISOString();
  const meetingAgenda = [
    {
      title: "Decisao de abertura",
      detail: decisionBoard.verdict.detail,
      owner: "Direcao / Admin Master",
      next_action: decisionBoard.verdict.next_action,
    },
    {
      title: "Receita e funil",
      detail: `${bi.summary.orders_total} pedido(s) ativo(s), R$ ${bi.summary.paid_revenue.toFixed(2)} pagos, R$ ${bi.summary.revenue_at_risk.toFixed(2)} em risco.`,
      owner: "Gerente ecommerce",
      next_action: bi.executive_focus.next_action,
    },
    {
      title: "Campanha ativa",
      detail: campaign.active_campaign ? `${campaign.active_campaign.name}: ${campaign.risks.length} risco(s), ${campaign.metrics.orders} pedido(s) atribuido(s).` : "Sem campanha ativa detectada.",
      owner: "Comercial / Marketing",
      next_action: campaign.next_actions[0] || "Manter monitoramento comercial da campanha ativa.",
    },
  ];
  const handoff = [
    ...decisionBoard.next_24h.slice(0, 6).map((item) => ({
      window: "24h",
      title: item.title,
      owner: item.owner,
      route: item.route,
      external: item.external,
      next_action: item.action,
    })),
    ...decisionBoard.next_72h.slice(0, 4).map((item) => ({
      window: "72h",
      title: item.title,
      owner: item.owner,
      route: item.route,
      external: item.external,
      next_action: item.detail,
    })),
  ];
  const risks = [
    ...decisionBoard.gates.filter((gate) => gate.status !== "pronto").slice(0, 8).map((gate) => ({
      area: gate.label,
      severity: gate.status === "bloqueado" ? "bloqueio" : "atencao",
      detail: `${gate.blockers} blocker(s), ${gate.warnings} warning(s).`,
      owner: gate.owner,
    })),
    ...campaign.risks.slice(0, 4).map((risk) => ({
      area: "Campanha",
      severity: risk.severity,
      detail: `${risk.title}: ${risk.detail}`,
      owner: "Comercial / Marketing",
    })),
  ];
  const markdown = [
    "# Ata executiva automatica",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    "## Veredito",
    "",
    `- Status: ${decisionBoard.verdict.label}`,
    `- Decisao: ${decisionBoard.verdict.detail}`,
    `- Proxima decisao: ${decisionBoard.verdict.next_action}`,
    "",
    "## Scorecard",
    "",
    `- Blockers: ${decisionBoard.scorecard.blockers}`,
    `- Warnings: ${decisionBoard.scorecard.warnings}`,
    `- Externos: ${decisionBoard.scorecard.external_blockers}`,
    `- Internos: ${decisionBoard.scorecard.internal_blockers}`,
    `- Receita em risco: R$ ${decisionBoard.scorecard.revenue_at_risk.toFixed(2)}`,
    `- Pedidos ativos: ${decisionBoard.scorecard.active_orders}`,
    "",
    "## Agenda da reuniao",
    "",
    ...meetingAgenda.map((item) => `- ${item.title} (${item.owner}): ${item.detail} Proxima acao: ${item.next_action}`),
    "",
    "## Rotina do dia",
    "",
    ...routine.checkpoints.map((checkpoint) => `- ${checkpoint.when} ${checkpoint.label} [${checkpoint.status}] ${checkpoint.actions[0]}`),
    "",
    "## Handoff 24h/72h",
    "",
    ...(handoff.length > 0
      ? handoff.map((item) => `- ${item.window} ${item.external ? "BLOQUEADO EXTERNO" : "interno"} - ${item.title} (${item.owner}): ${item.next_action}`)
      : ["- Sem handoff pendente alem do monitoramento padrao."]),
    "",
    "## Riscos",
    "",
    ...(risks.length > 0
      ? risks.map((risk) => `- [${risk.severity}] ${risk.area} (${risk.owner}): ${risk.detail}`)
      : ["- Nenhum risco relevante detectado pelos gates carregados."]),
    "",
    "## Acoes abertas",
    "",
    ...(actionCenter.items.slice(0, 10).map((item) => `- [${item.severity}] ${item.title} - ${item.responsible_suggested}: ${item.recommended_next_action}`)),
    "",
  ].join("\n");

  return {
    generated_at: generatedAt,
    verdict: decisionBoard.verdict,
    scorecard: decisionBoard.scorecard,
    meeting_agenda: meetingAgenda,
    routine: routine.checkpoints,
    handoff,
    risks,
    markdown,
  };
}

function buildMyWorkspace(db: DatabaseShape, profileId: string | null | undefined) {
  const profile = getPermissionProfile(profileId);
  const actionCenter = getExecutiveActionCenterData(db);
  const operations = listOrderOperationStates(db);
  const myQueues = {
    orders: operations.filter((entry) => entry.current_owner_role === profile.slug || (!entry.current_owner_role && entry.owner_label?.toLowerCase().includes(profile.name.toLowerCase()))).slice(0, 8),
    overdue: operations.filter((entry) => entry.is_overdue && (entry.current_owner_role === profile.slug || profile.slug === "admin_master" || profile.slug === "gerente_ecommerce")).slice(0, 8),
  };

  const roleConfigs: Record<string, { title: string; shortcuts: Array<{ label: string; href: string }> }> = {
    admin_master: { title: "Workspace do Admin Master", shortcuts: [{ label: "Produção segura", href: "/admin/readiness" }, { label: "Integracoes", href: "/admin/integracoes" }, { label: "Usuarios", href: "/admin/usuarios" }] },
    gerente_ecommerce: { title: "Workspace do Gerente de Ecommerce", shortcuts: [{ label: "Pedidos", href: "/admin/pedidos" }, { label: "Operacao", href: "/admin/operacao" }, { label: "Marketing", href: "/admin/marketing" }] },
    gestor_comercial: { title: "Workspace do Gestor Comercial", shortcuts: [{ label: "Marketing", href: "/admin/marketing" }, { label: "Clientes", href: "/admin/clientes-suporte" }, { label: "Venda assistida", href: "/admin/venda-assistida" }] },
    caixa_financeiro: { title: "Workspace do Caixa e Financeiro", shortcuts: [{ label: "Fiscal/Financeiro", href: "/admin/fiscal-financeiro" }, { label: "Pedidos", href: "/admin/pedidos" }] },
    fiscal_contador: { title: "Workspace Fiscal", shortcuts: [{ label: "Fiscal/Financeiro", href: "/admin/fiscal-financeiro" }, { label: "Readiness", href: "/admin/readiness" }] },
    separacao_expedicao: { title: "Workspace de Separacao e Expedicao", shortcuts: [{ label: "Operacao", href: "/admin/operacao" }, { label: "Pedidos", href: "/admin/pedidos" }] },
    catalogo_conteudo: { title: "Workspace de Catalogo e Conteudo", shortcuts: [{ label: "Produtos", href: "/admin/produtos" }, { label: "Catalogo", href: "/admin/catalogo" }, { label: "Marketing", href: "/admin/marketing" }] },
    atendimento_suporte: { title: "Workspace de Atendimento", shortcuts: [{ label: "Clientes", href: "/admin/clientes-suporte" }, { label: "Pedidos", href: "/admin/pedidos" }] },
    operador_pedidos: { title: "Workspace do Operador de Pedidos", shortcuts: [{ label: "Pedidos", href: "/admin/pedidos" }, { label: "Operacao", href: "/admin/operacao" }] },
    supervisor_loja: { title: "Workspace do Supervisor de Loja", shortcuts: [{ label: "Operacao", href: "/admin/operacao" }, { label: "Pedidos", href: "/admin/pedidos" }, { label: "Catalogo", href: "/admin/catalogo" }] },
    __invalid__: { title: "Workspace administrativo", shortcuts: [{ label: "Central Executiva", href: "/admin" }] },
  };

  const config = roleConfigs[profile.slug] ?? roleConfigs.__invalid__;
  return {
    profile: {
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      level: profile.level,
    },
    title: config.title,
    kpis: {
      action_center_critical: actionCenter.summary.critical,
      my_orders_queue: myQueues.orders.length,
      overdue_tasks: myQueues.overdue.length,
      external_blockers: actionCenter.summary.external_blockers,
    },
    alerts: actionCenter.items.filter((item) => item.owner_role === profile.slug || profile.slug === "admin_master" || profile.slug === "gerente_ecommerce").slice(0, 8),
    queues: myQueues,
    blockers: actionCenter.items.filter((item) => item.is_external_blocker || item.blocks_go_live).slice(0, 6),
    shortcuts: config.shortcuts,
  };
}

async function handleAdminCreateProduct(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.products.create", () => {
    const db = readDb();
    const body = req.body as Partial<DbProduct>;
    if (!isNonEmptyString(body.name || "")) {
      return { status: 400, payload: buildError("Informe o nome do produto") };
    }
    if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) {
      return { status: 400, payload: buildError("Informe um preco valido") };
    }
    const now = new Date().toISOString();
    const slugBase = slugify(String(body.slug || body.name));
    const uniqueSlug = db.products.some((item) => item.slug === slugBase) ? `${slugBase}-${Date.now().toString().slice(-4)}` : slugBase;
    const imageUrl = body.image_url?.toString().trim() || "/placeholder.svg";
    const images = Array.isArray(body.images) && body.images.length > 0 ? body.images.map((item) => String(item)) : [imageUrl];
    const requestedActive = body.is_active ?? true;
    const hasRealImage = !isPlaceholderProductImage(imageUrl) || images.some((item) => !isPlaceholderProductImage(item));
    if (requestedActive && !hasRealImage) {
      return { status: 400, payload: buildError("Produto ativo precisa de imagem real antes de publicar no catalogo.") };
    }
    const product: DbProduct = {
      id: createId(),
      sku: body.sku?.toString().trim() || `GML-${Date.now().toString().slice(-6)}`,
      name: String(body.name).trim(),
      slug: uniqueSlug,
      subcategory: body.subcategory?.toString().trim() || null,
      description: body.description?.toString().trim() || null,
      short_description: body.short_description?.toString().trim() || body.description?.toString().trim() || null,
      long_description: body.long_description?.toString().trim() || body.description?.toString().trim() || null,
      application: body.application?.toString().trim() || null,
      sale_type: body.sale_type || "unidade",
      unit_measure: body.unit_measure || "un",
      display_unit: body.display_unit?.toString().trim() || body.unit_measure || "un",
      base_price: Number(body.price),
      promotional_price: body.original_price ? Number(body.original_price) : null,
      price: Number(body.price),
      original_price: body.original_price ? Number(body.original_price) : null,
      category_id: body.category_id || null,
      brand_id: body.brand_id || null,
      sales_unit: body.sales_unit?.toString().trim() || "un",
      measures: body.measures?.toString().trim() || body.diameter?.toString().trim() || null,
      material: body.material?.toString().trim() || null,
      diameter: body.diameter?.toString().trim() || null,
      weight: body.weight ? Number(body.weight) : null,
      dimensions: body.dimensions?.toString().trim() || null,
      width: body.width ? Number(body.width) : null,
      height: body.height ? Number(body.height) : null,
      length: body.length ? Number(body.length) : null,
      thickness: body.thickness ? Number(body.thickness) : null,
      linear_measure: body.linear_measure ? Number(body.linear_measure) : null,
      square_measure: body.square_measure ? Number(body.square_measure) : null,
      area_per_piece: body.area_per_piece ? Number(body.area_per_piece) : null,
      area_per_box: body.area_per_box ? Number(body.area_per_box) : null,
      area_per_package: body.area_per_package ? Number(body.area_per_package) : null,
      meters_per_piece: body.meters_per_piece ? Number(body.meters_per_piece) : null,
      pieces_per_box: body.pieces_per_box ? Number(body.pieces_per_box) : null,
      meters_per_box: body.meters_per_box ? Number(body.meters_per_box) : null,
      meters_per_package: body.meters_per_package ? Number(body.meters_per_package) : null,
      volume_per_unit: body.volume_per_unit ? Number(body.volume_per_unit) : null,
      volume_per_package: body.volume_per_package ? Number(body.volume_per_package) : null,
      weight_per_unit: body.weight_per_unit ? Number(body.weight_per_unit) : null,
      weight_per_package: body.weight_per_package ? Number(body.weight_per_package) : null,
      pieces_per_package: body.pieces_per_package ? Number(body.pieces_per_package) : null,
      packaging_closed: typeof body.packaging_closed === "boolean" ? body.packaging_closed : null,
      open_package_allowed: typeof body.open_package_allowed === "boolean" ? body.open_package_allowed : null,
      minimum_sale_quantity: body.minimum_sale_quantity ? Number(body.minimum_sale_quantity) : null,
      sale_multiple: body.sale_multiple ? Number(body.sale_multiple) : null,
      fractional_sale_allowed: typeof body.fractional_sale_allowed === "boolean" ? body.fractional_sale_allowed : null,
      default_loss_margin: body.default_loss_margin ? Number(body.default_loss_margin) : null,
      loss_margin: body.loss_margin ? Number(body.loss_margin) : null,
      stock_minimum: Math.max(Number(body.stock_minimum || 5), 0),
      unit: body.unit?.toString().trim() || "un",
      stock: Math.max(Number(body.stock || 0), 0),
      status_product: body.status_product || "active",
      availability: body.availability || "disponivel",
      delivery_type: body.delivery_type || "pickup_or_delivery",
      is_on_request: Boolean(body.is_on_request),
      is_heavy: Boolean(body.is_heavy),
      is_bulky: Boolean(body.is_bulky),
      top_seller: Boolean(body.top_seller),
      related_product_ids: Array.isArray(body.related_product_ids) ? body.related_product_ids.map((item) => String(item)) : [],
      variations: Array.isArray(body.variations) ? body.variations : [],
      is_active: requestedActive,
      is_featured: body.is_featured ?? false,
      rating: Number(body.rating || 4.8),
      review_count: Math.max(Number(body.review_count || 0), 0),
      image_url: imageUrl,
      images,
      image_alt_text: body.image_alt_text?.toString().trim() || String(body.name).trim(),
      image_review_status:
        body.image_review_status === "approved" ||
        body.image_review_status === "manual_review" ||
        body.image_review_status === "suspect" ||
        body.image_review_status === "missing" ||
        body.image_review_status === "duplicate" ||
        body.image_review_status === "broken"
          ? body.image_review_status
          : "manual_review",
      image_review_notes: body.image_review_notes?.toString().trim() || "Produto novo exige revisao humana da coerencia entre imagem e descricao.",
      created_at: now,
    };
    db.products.unshift(product);
    createAuditEvent(db, {
      eventType: "catalog.product_created",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: { product_id: product.id, product_name: product.name, sku: product.sku, stock: product.stock, price: product.price },
    });
    writeDb(db);
    return { status: 201, payload: withRelations(db, product) };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateProduct(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.products.update", () => {
    const db = readDb();
    const productIndex = db.products.findIndex((item) => item.id === String(req.params.id));
    const product = productIndex >= 0 ? db.products[productIndex] : null;
    if (!product) {
      return { status: 404, payload: buildError("Produto nao encontrado") };
    }
    const body = req.body as Partial<DbProduct>;
    const previousValue = {
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      is_active: product.is_active,
      is_featured: product.is_featured,
      category_id: product.category_id,
      brand_id: product.brand_id,
      image_url: product.image_url,
      image_alt_text: product.image_alt_text ?? null,
      image_review_status: product.image_review_status ?? null,
      image_review_notes: product.image_review_notes ?? null,
      ncm: product.ncm,
      cest: product.cest,
      origin_code: product.origin_code,
      fiscal_group: product.fiscal_group,
      tax_classification_status: product.tax_classification_status,
    };
    if (typeof body.name !== "undefined" && isNonEmptyString(body.name)) product.name = body.name.trim();
    if (typeof body.slug !== "undefined") {
      const nextSlug = slugify(String(body.slug || product.name));
      if (!nextSlug) {
        return { status: 400, payload: buildError("Informe um slug publico valido") };
      }
      const slugInUse = db.products.some((item) => item.id !== product.id && item.slug === nextSlug);
      if (slugInUse) {
        return { status: 409, payload: buildError("Slug publico ja esta em uso por outro produto") };
      }
      product.slug = nextSlug;
    }
    if (typeof body.sku === "string") product.sku = body.sku.trim() || null;
    if (typeof body.price !== "undefined" && Number.isFinite(Number(body.price))) product.price = Number(body.price);
    if (typeof body.base_price !== "undefined" && Number.isFinite(Number(body.base_price))) product.base_price = Number(body.base_price);
    if (typeof body.original_price !== "undefined" && Number.isFinite(Number(body.original_price))) product.original_price = Number(body.original_price);
    if (typeof body.promotional_price !== "undefined" && Number.isFinite(Number(body.promotional_price))) product.promotional_price = Number(body.promotional_price);
    if (typeof body.stock !== "undefined" && Number.isFinite(Number(body.stock))) product.stock = Math.max(Number(body.stock), 0);
    if (typeof body.is_active !== "undefined") product.is_active = Boolean(body.is_active);
    if (typeof body.is_featured !== "undefined") product.is_featured = Boolean(body.is_featured);
    if (typeof body.image_url !== "undefined") product.image_url = body.image_url?.toString().trim() || product.image_url;
    if (typeof body.image_alt_text !== "undefined") product.image_alt_text = body.image_alt_text?.toString().trim() || null;
    if (
      typeof body.image_review_status !== "undefined" &&
      (body.image_review_status === "approved" ||
        body.image_review_status === "manual_review" ||
        body.image_review_status === "suspect" ||
        body.image_review_status === "missing" ||
        body.image_review_status === "duplicate" ||
        body.image_review_status === "broken")
    ) {
      product.image_review_status = body.image_review_status;
    }
    if (typeof body.image_review_notes !== "undefined") product.image_review_notes = body.image_review_notes?.toString().trim() || null;
    if (typeof body.description !== "undefined") product.description = body.description?.toString().trim() || null;
    if (typeof body.short_description !== "undefined") product.short_description = body.short_description?.toString().trim() || null;
    if (typeof body.long_description !== "undefined") product.long_description = body.long_description?.toString().trim() || null;
    if (typeof body.application !== "undefined") product.application = body.application?.toString().trim() || null;
    if (typeof body.subcategory !== "undefined") product.subcategory = body.subcategory?.toString().trim() || null;
    if (typeof body.ncm !== "undefined") product.ncm = body.ncm?.toString().trim() || null;
    if (typeof body.cest !== "undefined") product.cest = body.cest?.toString().trim() || null;
    if (typeof body.origin_code !== "undefined") product.origin_code = body.origin_code?.toString().trim() || null;
    if (typeof body.fiscal_group !== "undefined") product.fiscal_group = body.fiscal_group?.toString().trim() || null;
    if (
      typeof body.tax_classification_status !== "undefined" &&
      (body.tax_classification_status === "pending" || body.tax_classification_status === "review" || body.tax_classification_status === "ready")
    ) {
      product.tax_classification_status = body.tax_classification_status;
    }
    if (typeof body.sale_type !== "undefined") product.sale_type = body.sale_type;
    if (typeof body.unit_measure !== "undefined") product.unit_measure = body.unit_measure;
    if (typeof body.display_unit !== "undefined") product.display_unit = body.display_unit?.toString().trim() || null;
    if (typeof body.availability !== "undefined") product.availability = body.availability;
    if (typeof body.delivery_type !== "undefined") product.delivery_type = body.delivery_type;
    if (typeof body.stock_minimum !== "undefined" && Number.isFinite(Number(body.stock_minimum))) product.stock_minimum = Math.max(Number(body.stock_minimum), 0);
    if (typeof body.sales_unit !== "undefined") product.sales_unit = body.sales_unit?.toString().trim() || "un";
    if (typeof body.measures !== "undefined") product.measures = body.measures?.toString().trim() || null;
    if (typeof body.material !== "undefined") product.material = body.material?.toString().trim() || null;
    if (typeof body.diameter !== "undefined") product.diameter = body.diameter?.toString().trim() || null;
    if (typeof body.dimensions !== "undefined") product.dimensions = body.dimensions?.toString().trim() || null;
    if (typeof body.category_id !== "undefined") product.category_id = body.category_id || null;
    if (typeof body.brand_id !== "undefined") product.brand_id = body.brand_id || null;
    if (typeof body.unit !== "undefined") product.unit = body.unit?.toString().trim() || "un";
    if (typeof body.weight !== "undefined" && Number.isFinite(Number(body.weight))) product.weight = Number(body.weight);
    if (typeof body.width !== "undefined" && Number.isFinite(Number(body.width))) product.width = Number(body.width);
    if (typeof body.height !== "undefined" && Number.isFinite(Number(body.height))) product.height = Number(body.height);
    if (typeof body.length !== "undefined" && Number.isFinite(Number(body.length))) product.length = Number(body.length);
    if (typeof body.thickness !== "undefined" && Number.isFinite(Number(body.thickness))) product.thickness = Number(body.thickness);
    if (typeof body.linear_measure !== "undefined" && Number.isFinite(Number(body.linear_measure))) product.linear_measure = Number(body.linear_measure);
    if (typeof body.square_measure !== "undefined" && Number.isFinite(Number(body.square_measure))) product.square_measure = Number(body.square_measure);
    if (typeof body.area_per_piece !== "undefined" && Number.isFinite(Number(body.area_per_piece))) product.area_per_piece = Number(body.area_per_piece);
    if (typeof body.area_per_box !== "undefined" && Number.isFinite(Number(body.area_per_box))) product.area_per_box = Number(body.area_per_box);
    if (typeof body.area_per_package !== "undefined" && Number.isFinite(Number(body.area_per_package))) product.area_per_package = Number(body.area_per_package);
    if (typeof body.meters_per_piece !== "undefined" && Number.isFinite(Number(body.meters_per_piece))) product.meters_per_piece = Number(body.meters_per_piece);
    if (typeof body.pieces_per_box !== "undefined" && Number.isFinite(Number(body.pieces_per_box))) product.pieces_per_box = Number(body.pieces_per_box);
    if (typeof body.meters_per_box !== "undefined" && Number.isFinite(Number(body.meters_per_box))) product.meters_per_box = Number(body.meters_per_box);
    if (typeof body.meters_per_package !== "undefined" && Number.isFinite(Number(body.meters_per_package))) product.meters_per_package = Number(body.meters_per_package);
    if (typeof body.volume_per_unit !== "undefined" && Number.isFinite(Number(body.volume_per_unit))) product.volume_per_unit = Number(body.volume_per_unit);
    if (typeof body.volume_per_package !== "undefined" && Number.isFinite(Number(body.volume_per_package))) product.volume_per_package = Number(body.volume_per_package);
    if (typeof body.weight_per_unit !== "undefined" && Number.isFinite(Number(body.weight_per_unit))) product.weight_per_unit = Number(body.weight_per_unit);
    if (typeof body.weight_per_package !== "undefined" && Number.isFinite(Number(body.weight_per_package))) product.weight_per_package = Number(body.weight_per_package);
    if (typeof body.pieces_per_package !== "undefined" && Number.isFinite(Number(body.pieces_per_package))) product.pieces_per_package = Number(body.pieces_per_package);
    if (typeof body.packaging_closed !== "undefined") product.packaging_closed = Boolean(body.packaging_closed);
    if (typeof body.open_package_allowed !== "undefined") product.open_package_allowed = Boolean(body.open_package_allowed);
    if (typeof body.minimum_sale_quantity !== "undefined" && Number.isFinite(Number(body.minimum_sale_quantity))) product.minimum_sale_quantity = Number(body.minimum_sale_quantity);
    if (typeof body.sale_multiple !== "undefined" && Number.isFinite(Number(body.sale_multiple))) product.sale_multiple = Number(body.sale_multiple);
    if (typeof body.fractional_sale_allowed !== "undefined") product.fractional_sale_allowed = Boolean(body.fractional_sale_allowed);
    if (typeof body.default_loss_margin !== "undefined" && Number.isFinite(Number(body.default_loss_margin))) product.default_loss_margin = Number(body.default_loss_margin);
    if (typeof body.loss_margin !== "undefined" && Number.isFinite(Number(body.loss_margin))) product.loss_margin = Number(body.loss_margin);
    if (typeof body.is_on_request !== "undefined") product.is_on_request = Boolean(body.is_on_request);
    if (typeof body.is_heavy !== "undefined") product.is_heavy = Boolean(body.is_heavy);
    if (typeof body.is_bulky !== "undefined") product.is_bulky = Boolean(body.is_bulky);
    if (typeof body.top_seller !== "undefined") product.top_seller = Boolean(body.top_seller);
    if (typeof body.status_product !== "undefined") product.status_product = body.status_product;
    if (typeof body.rating !== "undefined" && Number.isFinite(Number(body.rating))) product.rating = Number(body.rating);
    if (typeof body.review_count !== "undefined" && Number.isFinite(Number(body.review_count))) product.review_count = Math.max(Number(body.review_count), 0);
    if (Array.isArray(body.related_product_ids)) product.related_product_ids = body.related_product_ids.map((item) => String(item));
    if (Array.isArray(body.images) && body.images.length > 0) product.images = body.images.map((item) => String(item));
    const hasRealImage = !isPlaceholderProductImage(product.image_url) || (Array.isArray(product.images) && product.images.some((item) => !isPlaceholderProductImage(item)));
    if (product.is_active && !hasRealImage) {
      return { status: 400, payload: buildError("Produto ativo precisa de imagem real antes de publicar no catalogo.") };
    }
    createAuditEvent(db, {
      eventType: "catalog.product_updated",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      previousValue,
      newValue: {
        name: product.name,
        slug: product.slug,
        price: product.price,
        stock: product.stock,
        is_active: product.is_active,
        is_featured: product.is_featured,
        category_id: product.category_id,
        brand_id: product.brand_id,
        image_url: product.image_url,
        image_alt_text: product.image_alt_text ?? null,
        image_review_status: product.image_review_status ?? null,
        image_review_notes: product.image_review_notes ?? null,
        ncm: product.ncm,
        cest: product.cest,
        origin_code: product.origin_code,
        fiscal_group: product.fiscal_group,
        tax_classification_status: product.tax_classification_status,
      },
      payload: { product_id: product.id },
    });
    writeDb(db);
    return { status: 200, payload: withRelations(db, product) };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateCategory(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.categories.create", () => {
    const db = readDb();
    const body = req.body as Partial<DbCategory>;
    if (!isNonEmptyString(body.name || "")) {
      return { status: 400, payload: buildError("Informe o nome da categoria") };
    }
    const slugBase = slugify(String(body.slug || body.name));
    const uniqueSlug = db.categories.some((item) => item.slug === slugBase) ? `${slugBase}-${Date.now().toString().slice(-4)}` : slugBase;
    const category: DbCategory = {
      id: createId(),
      name: String(body.name).trim(),
      slug: uniqueSlug,
      icon: body.icon?.toString(),
      description: body.description?.toString().trim() || null,
      image_url: body.image_url?.toString().trim() || null,
      sort_order: db.categories.length + 1,
      is_active: true,
    };
    db.categories.push(category);
    createAuditEvent(db, {
      eventType: "catalog.category_created",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: { category_id: category.id, category_name: category.name, slug: category.slug },
    });
    writeDb(db);
    return { status: 201, payload: category };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateFiscalProfile(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_profiles.update", () => {
    const db = readDb();
    const profile = db.fiscalProfiles.find((entry) => entry.id === String(req.params.id));
    if (!profile) {
      return { status: 404, payload: buildError("Perfil fiscal nao encontrado") };
    }
    const previousValue = {
      ncm: profile.ncm,
      cest: profile.cest,
      origin_code: profile.origin_code,
      tax_rule_status: profile.tax_rule_status,
    };
    const body = req.body as Partial<DbFiscalProfile>;
    if (typeof body.ncm === "string") profile.ncm = body.ncm.trim() || null;
    if (typeof body.cest === "string") profile.cest = body.cest.trim() || null;
    if (typeof body.cfop_internal_default === "string") profile.cfop_internal_default = body.cfop_internal_default.trim() || "5102";
    if (typeof body.cfop_interstate_default === "string") profile.cfop_interstate_default = body.cfop_interstate_default.trim() || "6102";
    if (typeof body.origin_code === "string") profile.origin_code = body.origin_code.trim() || "0";
    if (typeof body.cst_icms_default === "string") profile.cst_icms_default = body.cst_icms_default.trim() || null;
    if (typeof body.csosn_default === "string") profile.csosn_default = body.csosn_default.trim() || null;
    if (typeof body.requires_difal === "boolean") profile.requires_difal = body.requires_difal;
    if (typeof body.requires_fcp === "boolean") profile.requires_fcp = body.requires_fcp;
    if (body.tax_rule_status === "pending" || body.tax_rule_status === "review" || body.tax_rule_status === "ready") {
      profile.tax_rule_status = body.tax_rule_status;
    }
    if (typeof body.notes === "string") profile.notes = body.notes.trim() || null;
    profile.updated_at = new Date().toISOString();

    const product = db.products.find((entry) => entry.id === profile.product_id);
    if (product) {
      product.ncm = profile.ncm;
      product.cest = profile.cest;
      product.origin_code = profile.origin_code;
      product.tax_classification_status = profile.tax_rule_status;
      product.fiscal_group = product.fiscal_group ?? product.subcategory ?? product.material ?? null;
    }
    db.catalogStaging
      .filter((item) => item.mapped_product_id === profile.product_id)
      .forEach((item) => refreshCatalogStagingItem(db, item));

    createAuditEvent(db, {
      eventType: "fiscal.profile_updated",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      previousValue,
      newValue: {
        ncm: profile.ncm,
        cest: profile.cest,
        origin_code: profile.origin_code,
        tax_rule_status: profile.tax_rule_status,
      },
      payload: { fiscal_profile_id: profile.id, product_id: profile.product_id },
    });
    writeDb(db);
    return { status: 200, payload: profile };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminSyncFiscalProfilesFromProductsBatch(_req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_profiles.sync_from_products_batch", () => {
    const db = readDb();
    let processed = 0;
    let changed = 0;
    let unchanged = 0;
    const items: Array<{ profile_id: string; product_id: string; applied_fields: string[] }> = [];

    for (const profile of db.fiscalProfiles) {
      if (profile.tax_rule_status === "ready") continue;
      const product = db.products.find((entry) => entry.id === profile.product_id);
      if (!product) continue;

      processed += 1;
      const previousValue = {
        ncm: profile.ncm,
        cest: profile.cest,
        origin_code: profile.origin_code,
        tax_rule_status: profile.tax_rule_status,
      };
      const appliedFields: string[] = [];

      if (!profile.ncm && product.ncm) {
        profile.ncm = product.ncm;
        appliedFields.push("ncm");
      }
      if (!profile.cest && product.cest) {
        profile.cest = product.cest;
        appliedFields.push("cest");
      }
      if (!profile.origin_code && product.origin_code) {
        profile.origin_code = product.origin_code;
        appliedFields.push("origin_code");
      }
      if (profile.tax_rule_status === "pending" && (profile.ncm || profile.origin_code)) {
        profile.tax_rule_status = "review";
        appliedFields.push("tax_rule_status");
      }

      if (appliedFields.length === 0) {
        unchanged += 1;
        continue;
      }

      profile.updated_at = new Date().toISOString();
      product.ncm = profile.ncm;
      product.cest = profile.cest;
      product.origin_code = profile.origin_code;
      product.tax_classification_status = profile.tax_rule_status;
      db.catalogStaging
        .filter((item) => item.mapped_product_id === profile.product_id)
        .forEach((item) => refreshCatalogStagingItem(db, item));

      createAuditEvent(db, {
        eventType: "fiscal.profile_synced_from_product_batch",
        correlationId,
        actorId,
        actorName,
        sourceChannel: "integration",
        previousValue,
        newValue: {
          ncm: profile.ncm,
          cest: profile.cest,
          origin_code: profile.origin_code,
          tax_rule_status: profile.tax_rule_status,
        },
        payload: { fiscal_profile_id: profile.id, product_id: profile.product_id, applied_fields: appliedFields },
      });

      changed += 1;
      items.push({ profile_id: profile.id, product_id: profile.product_id, applied_fields: appliedFields });
    }

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        processed,
        changed,
        unchanged,
        items,
        readiness: getAdminFiscalReadiness(db),
        workboard: getAdminFiscalWorkboard(db),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

function isFiscalProfileReadyEligible(db: ReturnType<typeof readDb>, profile: DbFiscalProfile) {
  const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
  const hasTaxCode = Boolean(profile.cst_icms_default || profile.csosn_default);
  const hasWeight = Boolean(product?.weight || product?.weight_per_unit || product?.weight_per_package);
  const hasDimensions = Boolean(
    product?.dimensions ||
      product?.measures ||
      typeof product?.width === "number" ||
      typeof product?.height === "number" ||
      typeof product?.length === "number",
  );

  return Boolean(
    profile.ncm &&
      profile.origin_code &&
      profile.cfop_internal_default &&
      profile.cfop_interstate_default &&
      hasTaxCode &&
      hasWeight &&
      hasDimensions,
  );
}

function canApplyFiscalProfileTemplate(
  sourceProduct: DbProduct | null,
  targetProduct: DbProduct | null,
  sourceProfile: DbFiscalProfile,
  targetProfile: DbFiscalProfile,
) {
  if (!sourceProduct || !targetProduct) return false;
  if (sourceProfile.establishment_id !== targetProfile.establishment_id) return false;
  if (sourceProfile.id === targetProfile.id) return false;

  const sameFiscalGroup =
    typeof sourceProduct.fiscal_group === "string" &&
    typeof targetProduct.fiscal_group === "string" &&
    sourceProduct.fiscal_group.trim() &&
    sourceProduct.fiscal_group.trim().toLowerCase() === targetProduct.fiscal_group.trim().toLowerCase();
  const sameCategory = sourceProduct.category_id && targetProduct.category_id && sourceProduct.category_id === targetProduct.category_id;
  const sameSubcategory =
    typeof sourceProduct.subcategory === "string" &&
    typeof targetProduct.subcategory === "string" &&
    sourceProduct.subcategory.trim() &&
    sourceProduct.subcategory.trim().toLowerCase() === targetProduct.subcategory.trim().toLowerCase();

  return Boolean(sameFiscalGroup || sameCategory || sameSubcategory);
}

function hasFiscalTemplatePayload(profile: DbFiscalProfile) {
  return Boolean(
    profile.ncm ||
      profile.cest ||
      profile.origin_code ||
      profile.cfop_internal_default ||
      profile.cfop_interstate_default ||
      profile.cst_icms_default ||
      profile.csosn_default,
  );
}

async function handleAdminMarkFiscalProfilesReadyBatch(_req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_profiles.mark_ready_eligible_batch", () => {
    const db = readDb();
    let processed = 0;
    let changed = 0;
    let unchanged = 0;
    const items: Array<{ profile_id: string; product_id: string; reason: string }> = [];

    for (const profile of db.fiscalProfiles) {
      if (profile.tax_rule_status === "ready") continue;
      processed += 1;
      if (!isFiscalProfileReadyEligible(db, profile)) {
        unchanged += 1;
        continue;
      }

      const previousValue = { tax_rule_status: profile.tax_rule_status };
      profile.tax_rule_status = "ready";
      profile.updated_at = new Date().toISOString();

      const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      if (product) {
        product.tax_classification_status = "ready";
      }

      createAuditEvent(db, {
        eventType: "fiscal.profile_marked_ready_batch",
        correlationId,
        actorId,
        actorName,
        sourceChannel: "integration",
        previousValue,
        newValue: { tax_rule_status: profile.tax_rule_status },
        payload: { fiscal_profile_id: profile.id, product_id: profile.product_id },
      });

      changed += 1;
      items.push({
        profile_id: profile.id,
        product_id: profile.product_id,
        reason: "Perfil completo e elegivel para promocao automatica a ready.",
      });
    }

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        processed,
        changed,
        unchanged,
        items,
        readiness: getAdminFiscalReadiness(db, { scope: "minimal-go-live" }),
        workboard: getAdminFiscalWorkboard(db, { scope: "minimal-go-live" }),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminApplyFiscalProfileTemplate(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_profiles.apply_template_batch", () => {
    const db = readDb();
    const sourceProfile = db.fiscalProfiles.find((entry) => entry.id === String(req.params.id)) ?? null;
    if (!sourceProfile) {
      return { status: 404, payload: buildError("Perfil fiscal modelo nao encontrado") };
    }

    const sourceProduct = db.products.find((entry) => entry.id === sourceProfile.product_id) ?? null;
    if (!hasFiscalTemplatePayload(sourceProfile)) {
      return { status: 400, payload: buildError("Perfil fiscal modelo sem dados suficientes para replicacao") };
    }

    let processed = 0;
    let changed = 0;
    let unchanged = 0;
    const items: Array<{ profile_id: string; product_id: string; applied_fields: string[]; reason: string }> = [];
    const skipped: Array<{ profile_id: string; reason: string }> = [];

    for (const targetProfile of db.fiscalProfiles) {
      if (targetProfile.tax_rule_status === "ready") continue;
      const targetProduct = db.products.find((entry) => entry.id === targetProfile.product_id) ?? null;
      if (!canApplyFiscalProfileTemplate(sourceProduct, targetProduct, sourceProfile, targetProfile)) continue;

      processed += 1;
      const previousValue = {
        ncm: targetProfile.ncm,
        cest: targetProfile.cest,
        origin_code: targetProfile.origin_code,
        cst_icms_default: targetProfile.cst_icms_default,
        csosn_default: targetProfile.csosn_default,
        tax_rule_status: targetProfile.tax_rule_status,
      };
      const appliedFields: string[] = [];

      if (!targetProfile.ncm && sourceProfile.ncm) {
        targetProfile.ncm = sourceProfile.ncm;
        appliedFields.push("ncm");
      }
      if (!targetProfile.cest && sourceProfile.cest) {
        targetProfile.cest = sourceProfile.cest;
        appliedFields.push("cest");
      }
      if (!targetProfile.origin_code && sourceProfile.origin_code) {
        targetProfile.origin_code = sourceProfile.origin_code;
        appliedFields.push("origin_code");
      }
      if (!targetProfile.cfop_internal_default && sourceProfile.cfop_internal_default) {
        targetProfile.cfop_internal_default = sourceProfile.cfop_internal_default;
        appliedFields.push("cfop_internal_default");
      }
      if (!targetProfile.cfop_interstate_default && sourceProfile.cfop_interstate_default) {
        targetProfile.cfop_interstate_default = sourceProfile.cfop_interstate_default;
        appliedFields.push("cfop_interstate_default");
      }
      if (!targetProfile.cst_icms_default && !targetProfile.csosn_default) {
        if (sourceProfile.cst_icms_default) {
          targetProfile.cst_icms_default = sourceProfile.cst_icms_default;
          appliedFields.push("cst_icms_default");
        } else if (sourceProfile.csosn_default) {
          targetProfile.csosn_default = sourceProfile.csosn_default;
          appliedFields.push("csosn_default");
        }
      }

      if (appliedFields.length === 0) {
        unchanged += 1;
        skipped.push({
          profile_id: targetProfile.id,
          reason: "Perfil semelhante sem campos faltantes compativeis para o modelo selecionado.",
        });
        continue;
      }

      targetProfile.requires_difal = sourceProfile.requires_difal;
      targetProfile.requires_fcp = sourceProfile.requires_fcp;
      if (targetProfile.tax_rule_status === "pending") {
        targetProfile.tax_rule_status = "review";
        appliedFields.push("tax_rule_status");
      }
      targetProfile.updated_at = new Date().toISOString();

      if (targetProduct) {
        if (!targetProduct.ncm && targetProfile.ncm) targetProduct.ncm = targetProfile.ncm;
        if (!targetProduct.cest && targetProfile.cest) targetProduct.cest = targetProfile.cest;
        if (!targetProduct.origin_code && targetProfile.origin_code) targetProduct.origin_code = targetProfile.origin_code;
        targetProduct.tax_classification_status = targetProfile.tax_rule_status;
      }

      db.catalogStaging
        .filter((item) => item.mapped_product_id === targetProfile.product_id)
        .forEach((item) => refreshCatalogStagingItem(db, item));

      createAuditEvent(db, {
        eventType: "fiscal.profile_template_applied_batch",
        correlationId,
        actorId,
        actorName,
        sourceChannel: "integration",
        previousValue,
        newValue: {
          ncm: targetProfile.ncm,
          cest: targetProfile.cest,
          origin_code: targetProfile.origin_code,
          cst_icms_default: targetProfile.cst_icms_default,
          csosn_default: targetProfile.csosn_default,
          tax_rule_status: targetProfile.tax_rule_status,
        },
        payload: {
          source_profile_id: sourceProfile.id,
          fiscal_profile_id: targetProfile.id,
          product_id: targetProfile.product_id,
          applied_fields: appliedFields,
        },
      });

      changed += 1;
      items.push({
        profile_id: targetProfile.id,
        product_id: targetProfile.product_id,
        applied_fields: appliedFields,
        reason: "Perfil semelhante recebeu dados faltantes do modelo fiscal selecionado.",
      });
    }

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        source_profile_id: sourceProfile.id,
        processed,
        changed,
        unchanged,
        items,
        skipped,
        readiness: getAdminFiscalReadiness(db, { scope: "minimal-go-live" }),
        workboard: getAdminFiscalWorkboard(db, { scope: "minimal-go-live" }),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminRefreshCatalogStaging(_req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.refresh", () => {
    const db = readDb();
    const summary = refreshCatalogStagingBatch(db);
    createAuditEvent(db, {
      eventType: "catalog_staging.batch_refreshed",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: summary as unknown as Record<string, unknown>,
    });
    writeDb(db);
    return { status: 200, payload: { ok: true, ...summary, staging_summary: getCatalogStagingSummary(db) } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminPublishReadyCatalogStaging(_req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.publish_ready", () => {
    const db = readDb();
    let published = 0;
    const failures: string[] = [];
    db.catalogStaging
      .filter((item) => item.publish_flag && item.review_status !== "rejected")
      .forEach((item) => {
        refreshCatalogStagingItem(db, item);
        if (item.review_status !== "approved" || item.fiscal_pending_fields.length > 0) return;
        try {
          publishCatalogStagingItem(db, item);
          published += 1;
        } catch (_error) {
          failures.push(item.normalized_name);
        }
      });
    createAuditEvent(db, {
      eventType: "catalog_staging.batch_published",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: { published, failures_count: failures.length },
    });
    writeDb(db);
    return { status: 200, payload: { ok: true, published, failures, staging_summary: getCatalogStagingSummary(db) } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminAuthorizeReadyFiscalDocumentsBatch(_req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_documents.authorize_ready_batch", () => {
    const db = readDb();
    let processed = 0;
    let changed = 0;
    let unchanged = 0;
    const items: Array<{ document_id: string; order_id: string | null; number: string | null }> = [];

    for (const document of db.fiscalDocuments) {
      if (document.status_sefaz !== "pending") continue;
      processed += 1;

      if (!document.number || !document.series || !document.access_key || !document.cfop_summary) {
        unchanged += 1;
        continue;
      }

      applyFiscalDocumentStatusUpdate({
        db,
        document,
        nextStatus: "authorized",
        actorId,
        actorName,
        fallbackCorrelationId: correlationId,
        message: document.message ?? "Documento autorizado em lote a partir de dados completos ja registrados.",
        number: document.number,
        accessKey: document.access_key,
        series: document.series,
        cfopSummary: document.cfop_summary,
      });
      changed += 1;
      items.push({ document_id: document.id, order_id: document.order_id, number: document.number });
    }

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        processed,
        changed,
        unchanged,
        items,
        readiness: getAdminFiscalReadiness(db),
        workboard: getAdminFiscalWorkboard(db),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateFiscalDocumentsGoLiveGateBatch(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_documents.go_live_gate_batch", () => {
    const db = readDb();
    const ids = Array.isArray(req.body.document_ids) ? req.body.document_ids.map((entry) => String(entry)) : [];
    if (!ids.length) {
      return { status: 400, payload: buildError("Nenhum documento fiscal informado para a acao em lote") };
    }

    const nextGateStatus = req.body.gate_status === "deferred" ? "deferred" : req.body.gate_status === "required" ? "required" : null;
    if (!nextGateStatus) {
      return { status: 400, payload: buildError("Status de gate de go-live invalido") };
    }

    const note = typeof req.body.note === "string" ? req.body.note : null;
    let changed = 0;
    let unchanged = 0;
    const items: Array<{ document_id: string; gate_status: "required" | "deferred" }> = [];

    for (const id of ids) {
      const document = db.fiscalDocuments.find((entry) => entry.id === id);
      if (!document) continue;
      const currentGateStatus = document.go_live_gate_status === "deferred" ? "deferred" : "required";
      if (currentGateStatus === nextGateStatus && (note === null || (document.go_live_gate_note ?? null) === (note.trim() || null))) {
        unchanged += 1;
        continue;
      }

      const mutation = applyFiscalDocumentGoLiveGateUpdate({
        db,
        document,
        nextGateStatus,
        actorId,
        actorName,
        fallbackCorrelationId: correlationId,
        note,
      });
      if (!mutation.ok) {
        return { status: 400, payload: buildError(mutation.error) };
      }
      changed += 1;
      items.push({ document_id: document.id, gate_status: nextGateStatus });
    }

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        changed,
        unchanged,
        items,
        readiness: getAdminFiscalReadiness(db, { scope: "minimal-go-live" }),
        workboard: getAdminFiscalWorkboard(db, { scope: "minimal-go-live" }),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateCatalogStagingItem(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.update", () => {
    const db = readDb();
    const item = db.catalogStaging.find((entry) => entry.id === String(req.params.id));
    if (!item) {
      return { status: 404, payload: buildError("Item de staging nao encontrado") };
    }
    const previousValue = {
      review_status: item.review_status,
      review_reason: item.review_reason,
      mapped_product_id: item.mapped_product_id,
    };
    const body = req.body as Partial<DbCatalogStagingItem>;
    if (body.review_status === "approved" || body.review_status === "review" || body.review_status === "rejected") {
      item.review_status = body.review_status;
    }
    if (typeof body.review_reason === "string") item.review_reason = body.review_reason.trim() || null;
    if (Array.isArray(body.fiscal_pending_fields)) item.fiscal_pending_fields = body.fiscal_pending_fields.map((entry) => String(entry));
    if (typeof body.mapped_product_id === "string") item.mapped_product_id = body.mapped_product_id.trim() || null;
    refreshCatalogStagingItem(db, item);
    createAuditEvent(db, {
      eventType: "catalog_staging.item_updated",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      previousValue,
      newValue: {
        review_status: item.review_status,
        review_reason: item.review_reason,
        mapped_product_id: item.mapped_product_id,
      },
      payload: { staging_item_id: item.id },
    });
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminApplyCatalogStagingSuggestions(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.apply_suggestions", () => {
    const db = readDb();
    const item = db.catalogStaging.find((entry) => entry.id === String(req.params.id));
    if (!item) {
      return { status: 404, payload: buildError("Item de staging nao encontrado") };
    }
    if (!item.mapped_product_id) {
      return { status: 400, payload: buildError("Item de staging sem produto mapeado") };
    }

    const product = db.products.find((entry) => entry.id === item.mapped_product_id);
    if (!product) {
      return { status: 404, payload: buildError("Produto mapeado nao encontrado") };
    }

    const applyCatalogStagingSuggestions = (stagingItem: typeof item, mappedProduct: typeof product) => {
      const profile =
        db.fiscalProfiles.find((entry) => entry.product_id === mappedProduct.id && entry.establishment_id === "est-comercial") ??
        db.fiscalProfiles.find((entry) => entry.product_id === mappedProduct.id) ??
        null;

      const appliedFields: string[] = [];
      const previousValue = {
        product: {
          ncm: mappedProduct.ncm,
          origin_code: mappedProduct.origin_code,
          fiscal_group: mappedProduct.fiscal_group,
          dimensions: mappedProduct.dimensions,
          measures: mappedProduct.measures,
          weight: mappedProduct.weight,
          tax_classification_status: mappedProduct.tax_classification_status,
        },
        profile: profile
          ? {
              ncm: profile.ncm,
              origin_code: profile.origin_code,
              tax_rule_status: profile.tax_rule_status,
            }
          : null,
        staging: {
          review_status: stagingItem.review_status,
          fiscal_pending_fields: [...stagingItem.fiscal_pending_fields],
        },
      };

      if (!mappedProduct.ncm && stagingItem.suggested_ncm) {
        mappedProduct.ncm = stagingItem.suggested_ncm;
        appliedFields.push("product.ncm");
      }
      if (!mappedProduct.origin_code && stagingItem.suggested_origin_code) {
        mappedProduct.origin_code = stagingItem.suggested_origin_code;
        appliedFields.push("product.origin_code");
      }
      if (!mappedProduct.fiscal_group && stagingItem.suggested_family) {
        mappedProduct.fiscal_group = stagingItem.suggested_family;
        appliedFields.push("product.fiscal_group");
      }
      if (!mappedProduct.dimensions && stagingItem.suggested_dimensions) {
        mappedProduct.dimensions = stagingItem.suggested_dimensions;
        appliedFields.push("product.dimensions");
      }
      if (!mappedProduct.measures && stagingItem.suggested_dimensions) {
        mappedProduct.measures = stagingItem.suggested_dimensions;
        appliedFields.push("product.measures");
      }
      if (
        !(typeof mappedProduct.weight === "number" && mappedProduct.weight > 0) &&
        typeof stagingItem.suggested_weight === "number" &&
        stagingItem.suggested_weight > 0
      ) {
        mappedProduct.weight = stagingItem.suggested_weight;
        appliedFields.push("product.weight");
      }
      if (mappedProduct.tax_classification_status === "pending" && (mappedProduct.ncm || mappedProduct.origin_code || mappedProduct.fiscal_group)) {
        mappedProduct.tax_classification_status = "review";
        appliedFields.push("product.tax_classification_status");
      }

      if (profile) {
        if (!profile.ncm && mappedProduct.ncm) {
          profile.ncm = mappedProduct.ncm;
          appliedFields.push("profile.ncm");
        }
        if (!profile.origin_code && mappedProduct.origin_code) {
          profile.origin_code = mappedProduct.origin_code;
          appliedFields.push("profile.origin_code");
        }
        if (profile.tax_rule_status === "pending" && (profile.ncm || profile.origin_code)) {
          profile.tax_rule_status = "review";
          appliedFields.push("profile.tax_rule_status");
        }
        if (appliedFields.some((field) => field.startsWith("profile."))) {
          profile.updated_at = new Date().toISOString();
        }
      }

      db.catalogStaging
        .filter((entry) => entry.mapped_product_id === mappedProduct.id)
        .forEach((entry) => refreshCatalogStagingItem(db, entry));

      createAuditEvent(db, {
        eventType: "catalog_staging.suggestions_applied",
        correlationId,
        actorId,
        actorName,
        sourceChannel: "integration",
        previousValue,
        newValue: {
          product: {
            ncm: mappedProduct.ncm,
            origin_code: mappedProduct.origin_code,
            fiscal_group: mappedProduct.fiscal_group,
            dimensions: mappedProduct.dimensions,
            measures: mappedProduct.measures,
            weight: mappedProduct.weight,
            tax_classification_status: mappedProduct.tax_classification_status,
          },
          profile: profile
            ? {
                ncm: profile.ncm,
                origin_code: profile.origin_code,
                tax_rule_status: profile.tax_rule_status,
              }
            : null,
          staging: {
            review_status: stagingItem.review_status,
            fiscal_pending_fields: [...stagingItem.fiscal_pending_fields],
          },
        },
        payload: {
          staging_item_id: stagingItem.id,
          mapped_product_id: mappedProduct.id,
          applied_fields: appliedFields,
        },
      });

      return { appliedFields, profile };
    };

    const { appliedFields, profile } = applyCatalogStagingSuggestions(item, product);

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        applied_fields: appliedFields,
        product: withRelations(db, product),
        profile,
        staging_item: item,
        staging_summary: getCatalogStagingSummary(db),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminApplyCatalogStagingSuggestionsBatch(_req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.apply_suggestions_batch", () => {
    const db = readDb();

    const applyCatalogStagingSuggestions = (item: DatabaseShape["catalogStaging"][number], product: DbProduct) => {
      const profile =
        db.fiscalProfiles.find((entry) => entry.product_id === product.id && entry.establishment_id === "est-comercial") ??
        db.fiscalProfiles.find((entry) => entry.product_id === product.id) ??
        null;

      const appliedFields: string[] = [];
      const previousValue = {
        product: {
          ncm: product.ncm,
          origin_code: product.origin_code,
          fiscal_group: product.fiscal_group,
          dimensions: product.dimensions,
          measures: product.measures,
          weight: product.weight,
          tax_classification_status: product.tax_classification_status,
        },
        profile: profile
          ? {
              ncm: profile.ncm,
              origin_code: profile.origin_code,
              tax_rule_status: profile.tax_rule_status,
            }
          : null,
        staging: {
          review_status: item.review_status,
          fiscal_pending_fields: [...item.fiscal_pending_fields],
        },
      };

      if (!product.ncm && item.suggested_ncm) {
        product.ncm = item.suggested_ncm;
        appliedFields.push("product.ncm");
      }
      if (!product.origin_code && item.suggested_origin_code) {
        product.origin_code = item.suggested_origin_code;
        appliedFields.push("product.origin_code");
      }
      if (!product.fiscal_group && item.suggested_family) {
        product.fiscal_group = item.suggested_family;
        appliedFields.push("product.fiscal_group");
      }
      if (!product.dimensions && item.suggested_dimensions) {
        product.dimensions = item.suggested_dimensions;
        appliedFields.push("product.dimensions");
      }
      if (!product.measures && item.suggested_dimensions) {
        product.measures = item.suggested_dimensions;
        appliedFields.push("product.measures");
      }
      if (!(typeof product.weight === "number" && product.weight > 0) && typeof item.suggested_weight === "number" && item.suggested_weight > 0) {
        product.weight = item.suggested_weight;
        appliedFields.push("product.weight");
      }
      if (product.tax_classification_status === "pending" && (product.ncm || product.origin_code || product.fiscal_group)) {
        product.tax_classification_status = "review";
        appliedFields.push("product.tax_classification_status");
      }

      if (profile) {
        if (!profile.ncm && product.ncm) {
          profile.ncm = product.ncm;
          appliedFields.push("profile.ncm");
        }
        if (!profile.origin_code && product.origin_code) {
          profile.origin_code = product.origin_code;
          appliedFields.push("profile.origin_code");
        }
        if (profile.tax_rule_status === "pending" && (profile.ncm || profile.origin_code)) {
          profile.tax_rule_status = "review";
          appliedFields.push("profile.tax_rule_status");
        }
        if (appliedFields.some((field) => field.startsWith("profile."))) {
          profile.updated_at = new Date().toISOString();
        }
      }

      db.catalogStaging
        .filter((entry) => entry.mapped_product_id === product.id)
        .forEach((entry) => refreshCatalogStagingItem(db, entry));

      createAuditEvent(db, {
        eventType: "catalog_staging.suggestions_applied",
        correlationId,
        actorId,
        actorName,
        sourceChannel: "integration",
        previousValue,
        newValue: {
          product: {
            ncm: product.ncm,
            origin_code: product.origin_code,
            fiscal_group: product.fiscal_group,
            dimensions: product.dimensions,
            measures: product.measures,
            weight: product.weight,
            tax_classification_status: product.tax_classification_status,
          },
          profile: profile
            ? {
                ncm: profile.ncm,
                origin_code: profile.origin_code,
                tax_rule_status: profile.tax_rule_status,
              }
            : null,
          staging: {
            review_status: item.review_status,
            fiscal_pending_fields: [...item.fiscal_pending_fields],
          },
        },
        payload: {
          staging_item_id: item.id,
          mapped_product_id: product.id,
          applied_fields: appliedFields,
        },
      });

      return appliedFields;
    };

    const eligibleItems = db.catalogStaging.filter(
      (item) =>
        Boolean(item.mapped_product_id) &&
        item.review_status !== "approved" &&
        (
          Boolean(item.suggested_ncm) ||
          Boolean(item.suggested_origin_code) ||
          Boolean(item.suggested_family) ||
          Boolean(item.suggested_dimensions) ||
          (typeof item.suggested_weight === "number" && item.suggested_weight > 0)
        ),
    );

    const processed: Array<{ item_id: string; mapped_product_id: string; applied_fields: string[] }> = [];
    const failures: Array<{ item_id: string; reason: string }> = [];

    for (const item of eligibleItems) {
      const product = db.products.find((entry) => entry.id === item.mapped_product_id);
      if (!product) {
        failures.push({ item_id: item.id, reason: "Produto mapeado nao encontrado" });
        continue;
      }

      const appliedFields = applyCatalogStagingSuggestions(item, product);
      processed.push({
        item_id: item.id,
        mapped_product_id: product.id,
        applied_fields: appliedFields,
      });
    }

    writeDb(db);
    return {
      status: 200,
      payload: {
        ok: true,
        processed: processed.length,
        changed: processed.filter((entry) => entry.applied_fields.length > 0).length,
        unchanged: processed.filter((entry) => entry.applied_fields.length === 0).length,
        failures,
        items: processed,
        staging_summary: getCatalogStagingSummary(db),
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminPublishCatalogStagingItem(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.publish_item", () => {
    const db = readDb();
    const item = db.catalogStaging.find((entry) => entry.id === String(req.params.id));
    if (!item) {
      return { status: 404, payload: buildError("Item de staging nao encontrado") };
    }
    refreshCatalogStagingItem(db, item);
    try {
      publishCatalogStagingItem(db, item);
    } catch (error) {
      return { status: 400, payload: buildError(error instanceof Error ? error.message : "Falha ao publicar item do staging") };
    }
    createAuditEvent(db, {
      eventType: "catalog_staging.item_published",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: { staging_item_id: item.id, mapped_product_id: item.mapped_product_id },
    });
    writeDb(db);
    return { status: 200, payload: { ok: true, mapped_product_id: item.mapped_product_id } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminMaterializeCatalogLaunchBatch(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.materialize_launch_batch", () => {
    const db = readDb();
    const limit = Math.min(Math.max(Number(req.body?.limit || req.query.limit || 12), 1), 60);
    const requestedIds = Array.isArray(req.body?.staging_ids)
      ? req.body.staging_ids.map((entry: unknown) => String(entry).trim()).filter(Boolean)
      : [];
    const requestedSourceBatch =
      typeof req.body?.source_batch === "string" && req.body.source_batch.trim().length > 0
        ? req.body.source_batch.trim()
        : typeof req.query.source_batch === "string" && req.query.source_batch.trim().length > 0
          ? req.query.source_batch.trim()
          : null;
    const batch = getCatalogLaunchBatch(db, limit);

    const items = requestedIds.length > 0
      ? requestedIds.map((id) => db.catalogStaging.find((item) => item.id === id)).filter(Boolean) as DbCatalogStagingItem[]
      : requestedSourceBatch
        ? batch.shortlist
            .map((entry) => db.catalogStaging.find((item) => item.id === entry.id))
            .filter((item): item is DbCatalogStagingItem => Boolean(item) && item.source_batch === requestedSourceBatch)
            .slice(0, limit)
        : batch.shortlist.map((entry) => db.catalogStaging.find((item) => item.id === entry.id)).filter(Boolean) as DbCatalogStagingItem[];
    const materialized: Array<{ staging_item_id: string; mapped_product_id: string }> = [];

    for (const item of items) {
      const mappedProductId = materializeCatalogStagingProductOrigin(db, item);
      materialized.push({
        staging_item_id: item.id,
        mapped_product_id: mappedProductId,
      });
    }

    createAuditEvent(db, {
      eventType: "catalog_staging.launch_batch_materialized",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: {
        limit,
        requested_ids: requestedIds,
        requested_source_batch: requestedSourceBatch,
        selected: batch.selected,
        items: materialized,
      },
    });

    writeDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        requested_limit: limit,
        selected: items.length,
        materialized: materialized.length,
        items: materialized,
        launch_batch: getCatalogLaunchBatch(db, limit),
        staging_summary: getCatalogStagingSummary(db),
      },
    };
  });

  res.status(result.status).json(result.payload);
}

async function handleAdminAlignCatalogGoLiveGate(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.catalog_staging.align_go_live_gate", () => {
    const db = readDb();
    const limit = Math.min(Math.max(Number(req.body?.limit || req.query.limit || 12), 1), 60);
    const aligned = alignCatalogStagingGoLiveGateToLaunchBatch(db, limit);

    createAuditEvent(db, {
      eventType: "catalog_staging.go_live_gate_aligned",
      correlationId,
      actorId,
      actorName,
      sourceChannel: "integration",
      payload: {
        limit,
        changed: aligned.changed,
        required: aligned.required,
        deferred: aligned.deferred,
      },
    });

    writeDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        requested_limit: limit,
        changed: aligned.changed,
        required: aligned.required,
        deferred: aligned.deferred,
        launch_batch: aligned.launch_batch,
        staging_summary: getCatalogStagingSummary(db),
      },
    };
  });

  res.status(result.status).json(result.payload);
}

async function handleAdminCreateInventoryTransfer(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.inventory.transfer", () => {
    const db = readDb();
    const body = req.body as {
      product_id?: string;
      quantity?: number;
      source_establishment_id?: string;
      target_establishment_id?: string;
      notes?: string;
    };
    const product = db.products.find((entry) => entry.id === body.product_id);
    if (!product) {
      return { status: 404, payload: buildError("Produto nao encontrado para transferencia") };
    }
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { status: 400, payload: buildError("Informe uma quantidade valida para transferencia") };
    }
    const transfer = applyInventoryTransfer({
      db,
      product,
      quantity,
      sourceEstablishmentId: String(body.source_establishment_id || ""),
      targetEstablishmentId: String(body.target_establishment_id || ""),
      notes: body.notes,
      actorId,
      actorName,
      correlationId,
    });
    if (!transfer.ok) {
      return { status: 400, payload: buildError(transfer.error) };
    }

    writeDb(db);
    return {
      status: 201,
      payload: {
        ok: true,
        transfer_document: transfer.fiscalDocument,
        target_lot: transfer.targetLot,
      },
    };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateFiscalDocumentStatus(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_documents.status", () => {
    const db = readDb();
    const document = db.fiscalDocuments.find((entry) => entry.id === String(req.params.id));
    if (!document) {
      return { status: 404, payload: buildError("Documento fiscal nao encontrado") };
    }
    const nextStatus = req.body.status as DbFiscalDocument["status_sefaz"];
    if (!validFiscalDocumentStatuses.includes(nextStatus)) {
      return { status: 400, payload: buildError("Status fiscal invalido") };
    }
    const mutation = applyFiscalDocumentStatusUpdate({
      db,
      document,
      nextStatus,
      actorId,
      actorName,
      fallbackCorrelationId: correlationId,
      message: typeof req.body.message === "string" ? req.body.message : null,
      number: typeof req.body.number === "string" ? req.body.number : null,
      series: typeof req.body.series === "string" ? req.body.series : null,
      accessKey: typeof req.body.access_key === "string" ? req.body.access_key : null,
      cfopSummary: typeof req.body.cfop_summary === "string" ? req.body.cfop_summary : null,
    });
    if (!mutation.ok) {
      return { status: 400, payload: buildError(mutation.error) };
    }

    writeDb(db);
    return { status: 200, payload: document };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateDeliveryZone(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.delivery_zones.create", () => {
    const db = readDb();
    const mutation = createDeliveryZone({
      db,
      body: req.body as Partial<DbDeliveryZone>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateDeliveryZone(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.delivery_zones.update", () => {
    const db = readDb();
    const mutation = updateDeliveryZone({
      db,
      deliveryZoneId: String(req.params.id),
      body: req.body as Partial<DbDeliveryZone>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateFreightCarrier(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.freight_carriers.create", () => {
    const db = readDb();
    const mutation = createFreightCarrier({
      db,
      body: req.body as Partial<DbFreightCarrier>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateFreightCarrier(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.freight_carriers.update", () => {
    const db = readDb();
    const mutation = updateFreightCarrier({
      db,
      carrierId: String(req.params.id),
      body: req.body as Partial<DbFreightCarrier>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateStore(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.stores.create", () => {
    const db = readDb();
    const mutation = createStore({
      db,
      body: req.body as Partial<DbStore>,
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: mutation.payload };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateSeller(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.sellers.create", () => {
    const db = readDb();
    const mutation = createSeller({
      db,
      body: req.body as {
        email?: string;
        password?: string;
        fullName?: string;
        sellerCode?: string;
        roleLabel?: DbSeller["role_label"];
        primaryStoreId?: string | null;
        allowedStoreIds?: string[];
      },
      actorId,
      actorName,
      correlationId,
    });
    if (!mutation.ok) {
      return { status: mutation.status, payload: buildError(mutation.message) };
    }
    writeDb(db);
    return { status: mutation.status, payload: buildSellerView(db, mutation.payload) };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminConvertQuote(req: express.Request, res: express.Response) {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.quotes.convert", () => {
    const db = readDb();
    const defaultSellerEstablishment = getDefaultSellerEstablishment(db);
    const quote = db.quotes.find((item) => item.id === String(req.params.id));
    if (!quote) {
      return { status: 404, payload: buildError("Orcamento nao encontrado") };
    }
    if (!defaultSellerEstablishment) {
      return { status: 500, payload: buildError("Nenhum estabelecimento vendedor padrao foi configurado") };
    }
    const conversion = convertQuoteToAssistedOrder({
      db,
      quote,
      actorId,
      actorName,
      defaultSellerEstablishment,
      buildItemFiscalSnapshot: (productId, establishmentId) => {
        const product = db.products.find((entry) => entry.id === productId);
        return product ? buildItemFiscalSnapshot(db, product, establishmentId) : null;
      },
    });
    if (!conversion.ok) {
      return { status: 400, payload: buildError(conversion.error) };
    }
    writeDb(db);
    return { status: 200, payload: { order: conversion.order, quote: conversion.quote } };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminCreateLead(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.leads.create", () => {
    const db = readDb();
    const body = req.body as Partial<DbLead>;
    if (!isNonEmptyString(body.name || "")) {
      return { status: 400, payload: buildError("Informe o nome do lead") };
    }
    const lead = createAdminLead({
      db,
      body: {
        ...body,
        email: isNonEmptyString(body.email || "") ? normalizeEmail(String(body.email)) : null,
        phone: isNonEmptyString(body.phone || "") ? cleanDigits(String(body.phone)) : null,
        product_interest: isNonEmptyString(body.product_interest || "") ? String(body.product_interest).trim() : null,
        page_origin: isNonEmptyString(body.page_origin || "") ? String(body.page_origin).trim() : null,
        notes: isNonEmptyString(body.notes || "") ? String(body.notes).trim() : null,
      },
      actorId,
      actorName,
      correlationId,
    });
    incrementBusinessMetric("leads.created");
    writeDb(db);
    return { status: 201, payload: lead };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateLead(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.leads.update", () => {
    const db = readDb();
    const lead = db.leads.find((entry) => entry.id === String(req.params.id));
    if (!lead) {
      return { status: 404, payload: buildError("Lead nao encontrado") };
    }
    const body = req.body as Partial<DbLead>;
    updateAdminLead({
      db,
      lead,
      body,
      actorId,
      actorName,
      correlationId,
    });
    incrementBusinessMetric("leads.updated");
    writeDb(db);
    return { status: 200, payload: lead };
  });
  res.status(result.status).json(result.payload);
}

async function handleAdminUpdateContent(req: express.Request, res: express.Response) {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.content.update", () => {
    const db = readDb();
    const body = req.body as Partial<DbSiteContent>;
    const nextContent = applySiteContentUpdate({
      db,
      body,
      actorId,
      actorName,
      correlationId,
    });
    incrementBusinessMetric("content.updated");
    writeDb(db);
    return { status: 200, payload: nextContent };
  });
  res.status(result.status).json(result.payload);
}

async function handleUpdateCustomerProfile(req: express.Request, res: express.Response) {
  const actorId = res.locals.user.id as string;
  const actorName = (res.locals.user.user_metadata?.full_name || res.locals.user.email) as string;
  const correlationId = (res.locals.requestId ?? createId()) as string;
  const result = await runSerializedMutation("customer.profile.update", () => {
    const db = readDb();
    const body = req.body as Partial<DbCustomerProfile>;
    const next = applyCustomerProfileUpdate({
      db,
      user: res.locals.user,
      body,
      actorId,
      actorName,
      correlationId,
      normalizeEmail,
      isValidEmail,
    });
    incrementBusinessMetric("customers.profile_updated");
    writeDb(db);
    return { status: 200, payload: next };
  });
  res.status(result.status).json(result.payload);
}

async function handleCreateQuote(req: express.Request, res: express.Response) {
  const user = res.locals.user;
  const result = await runSerializedMutation("quotes.create", () => {
    const db = readDb();
    const body = req.body as {
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      notes?: string;
      sellerId?: string | null;
      sellerName?: string | null;
      storeId?: string | null;
      storeName?: string | null;
      correlationId?: string;
      items?: Array<{ productId?: string; quantity?: number }>;
    };
    if (!isNonEmptyString(body.customerName || "")) {
      return { status: 400, payload: buildError("Informe o nome do cliente") };
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return { status: 400, payload: buildError("Adicione pelo menos um item ao orcamento") };
    }

    const quoteRows = body.items
      .map((item) => ({
        product: db.products.find((entry) => entry.id === item.productId),
        quantity: Number(item.quantity || 0),
      }))
      .filter((entry) => entry.product && entry.quantity > 0) as Array<{ product: DbProduct; quantity: number }>;

    if (quoteRows.length === 0) {
      return { status: 400, payload: buildError("Itens do orcamento invalidos") };
    }

    const created = createQuoteWithLead({
      db,
      customerName: body.customerName.trim(),
      customerEmail: body.customerEmail?.trim() || null,
      customerPhone: body.customerPhone?.trim() || null,
      notes: body.notes?.trim() || null,
      sellerId: body.sellerId ?? user.id,
      sellerName: body.sellerName ?? user.user_metadata?.full_name ?? user.email,
      storeId: body.storeId ?? user.user_metadata?.store_id ?? null,
      storeName: body.storeName ?? user.user_metadata?.store_name ?? null,
      correlationId: body.correlationId || createId(),
      items: quoteRows,
    });
    incrementBusinessMetric("quotes.created");
    writeDb(db);
    return { status: 200, payload: { quote: created.quote, items: created.quoteItems } };
  });

  if (result.status === 200) {
    const payload = result.payload as { quote: DbQuote };
    if (payload.quote.customer_email) {
      queueEmailDelivery({
        to: payload.quote.customer_email,
        subject: `Orcamento ${payload.quote.quote_number} criado`,
        html: `<p>Seu orcamento <strong>${payload.quote.quote_number}</strong> foi registrado.</p><p>Total estimado: R$ ${payload.quote.total.toFixed(2).replace(".", ",")}.</p>`,
        text: `Seu orcamento ${payload.quote.quote_number} foi registrado. Total estimado: R$ ${payload.quote.total.toFixed(2).replace(".", ",")}.`,
        tags: [{ name: "category", value: "quote_created" }],
        idempotencyKey: `quote-${payload.quote.id}`,
      });
    }
    queueAnalyticsDelivery({
      name: "generate_lead",
      userId: user.id,
      params: {
        lead_type: "quote",
        value: payload.quote.total,
      },
    });
  }

  res.status(result.status).json(result.payload);
}

function getPublicQuoteRequests(db: DatabaseShape) {
  return listQuoteRequestAdminRows(db);
}

async function handleCreatePublicQuoteRequest(req: express.Request, res: express.Response) {
  const requestId = (res.locals.requestId ?? createId()) as string;
  if (!isModuleEnabled("M1")) {
    res.status(403).json(buildError("Carrinho de orcamento indisponivel no momento"));
    return;
  }
  const result = await runSerializedMutation("gamel.public_quote_request.create", () => {
    const db = readDb();
    const body = req.body as Record<string, unknown>;

    if (hasUnsafePublicPayload(body) || hasUnsafeQuoteRequestPayload(body)) {
      incrementSecurityMetric("malicious_payload_rejected");
      logWarn({
        event: "security.public_quote_payload_rejected",
        module: "quotes",
        requestId,
        data: { path: req.path, method: req.method },
      });
      return { status: 400, payload: buildError("Revise os campos enviados e tente novamente") };
    }

    const created = createPublicQuoteRequest(db, normalizeQuoteRequestInput(body), `gamel-web-${requestId}`);
    if (!created.ok) return { status: created.status, payload: buildError(created.error) };
    incrementBusinessMetric("quotes.public_submitted");
    writeDb(db);
    logInfo({
      event: "quote.public_created",
      module: "quotes",
      requestId,
      data: {
        quote_request_id: created.request.id,
        protocol: created.request.protocol,
        phone_mask: maskPhoneForLog(created.request.customer_phone),
        item_count: created.items.length,
        page_origin: created.request.page_origin,
      },
    });
    return { status: created.status, payload: serializeQuoteRequest(created.request, created.items, created.duplicate) };
  });

  if (result.status === 201) {
    const payload = result.payload as { request: { protocol: string }; itemsAccepted: number };
    queueAnalyticsDelivery({
      name: "generate_lead",
      params: {
        lead_type: "quote_request",
        quote_number: payload.request.protocol,
        item_count: payload.itemsAccepted,
      },
    });
  }

  res.status(result.status).json(result.payload);
}

async function handleCreateCartAbandonmentLead(req: express.Request, res: express.Response) {
  const correlationId = (res.locals.requestId ?? createId()) as string;
  const result = await runSerializedMutation("leads.cart_abandonment.create", () => {
    const db = readDb();
    const body = req.body as {
      items?: Array<{ name?: string; sku?: string; quantity?: number }>;
      totalEstimated?: number;
      pageOrigin?: string;
      correlationId?: string;
    };
    const lead = createCartAbandonmentLead({
      db,
      items: body.items,
      totalEstimated: Number(body.totalEstimated || 0),
      pageOrigin: body.pageOrigin || "/carrinho",
      correlationId: body.correlationId || correlationId,
    });
    incrementBusinessMetric("leads.cart_abandonment_created");
    writeDb(db);
    return { status: 201, payload: lead };
  });

  queueAnalyticsDelivery({
    name: "generate_lead",
    params: {
      lead_type: "cart_abandonment",
      value: Number((req.body as { totalEstimated?: number })?.totalEstimated || 0),
    },
  });
  res.status(result.status).json(result.payload);
}

async function handleCreateAuditEvent(req: express.Request, res: express.Response) {
  const result = await runSerializedMutation("audit.create", () => {
    const db = readDb();
    const order = req.body.orderId ? db.orders.find((item) => item.id === req.body.orderId) : null;
    const entry = createAuditEvent(db, {
      eventType: (req.body.eventType as string) || "custom.event",
      orderId: (req.body.orderId as string) ?? null,
      correlationId: (req.body.correlationId as string) || order?.correlation_id || createId(),
      actorId: res.locals.user.id,
      actorName: res.locals.user.user_metadata?.full_name || res.locals.user.email,
      sourceChannel: (req.body.sourceChannel as SourceChannel) || order?.source_channel || "web",
      previousValue: (req.body.previousValue as Record<string, unknown>) ?? null,
      newValue: (req.body.newValue as Record<string, unknown>) ?? null,
      payload: (req.body.metadata as Record<string, unknown>) ?? null,
    });
    writeDb(db);
    return { status: 200, payload: entry };
  });
  res.status(result.status).json(result.payload);
}

app.get("/api/admin/brands", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminBrands(db));
});

app.post("/api/admin/brands", requireAdminModule("catalog", "full"), async (req, res) => {
  await handleAdminCreateBrand(req, res);
});

app.patch("/api/admin/brands/:id", requireAdminModule("catalog", "full"), async (req, res) => {
  await handleAdminUpdateBrand(req, res);
});

app.post("/api/auth/signup", rateLimit({ windowMs: appConfig.auth.rateLimitWindowMs, max: appConfig.auth.rateLimitMax, message: "Limite de tentativas excedido" }), async (req, res) => {
  if (!appConfig.auth.publicSignupEnabled) {
    incrementSecurityMetric("auth_failed");
    logWarn({
      event: "auth.public_signup_blocked",
      module: "auth",
      requestId: res.locals.requestId ?? null,
      data: { reason: "public_signup_disabled" },
    });
    res.status(403).json(buildError("Cadastro publico desativado. Usuarios devem ser criados pelo administrador."));
    return;
  }

  const db = readDb();
  const { email, password, fullName } = req.body as { email?: string; password?: string; fullName?: string };

  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    res.status(400).json(buildError("Informe um e-mail valido"));
    return;
  }
  if (!isNonEmptyString(password) || !isStrongPassword(password)) {
    res.status(400).json(buildError(`A senha deve ter pelo menos ${appConfig.auth.passwordMinLength} caracteres`));
    return;
  }
  if (!isNonEmptyString(fullName) || fullName.trim().length < 3) {
    res.status(400).json(buildError("Informe o nome completo"));
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  if (db.users.some((item) => item.email.toLowerCase() === normalizedEmail)) {
    res.status(400).json(buildError("already registered"));
    return;
  }

  const hashed = hashPassword(password.trim());
  const token = createSessionToken();
  const user = {
    id: createId(),
    email: normalizedEmail,
    password_hash: hashed.hash,
    password_salt: hashed.salt,
    role: "customer" as const,
    is_active: true,
    user_metadata: {
      full_name: fullName.trim(),
      store_id: null,
      store_name: null,
      can_start_assisted_sale: false,
      permission_profile_id: null,
      job_title: null,
    },
    session_token: token,
    session_expires_at: getSessionExpiry(),
    session_persistent: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };

  db.users.push(user);
  writeDb(db);
  setSessionCookie(res, token);
  setCsrfCookie(req, res, token);
  queueAnalyticsDelivery({
    name: "sign_up",
    userId: user.id,
    params: { method: "password" },
  });
  queueEmailDelivery({
    to: user.email,
    ...buildWelcomeEmail(user.user_metadata.full_name),
    tags: [{ name: "category", value: "signup" }],
    idempotencyKey: `signup-${user.id}`,
  });
  res.json({ user: sanitizeUser(user), token });
});

app.post("/api/auth/signin", rateLimit({ windowMs: appConfig.auth.rateLimitWindowMs, max: appConfig.auth.rateLimitMax, message: "Limite de tentativas excedido" }), (req, res) => {
  const db = readDb();
  const { email, password } = req.body as { email?: string; password?: string };

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json(buildError("Informe e-mail e senha"));
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const user = db.users.find((item) => item.email.toLowerCase() === normalizedEmail);

  if (!user || !verifyPassword(password, user)) {
    incrementSecurityMetric("auth_failed");
    logWarn({
      event: "auth.signin_failed",
      module: "auth",
      requestId: res.locals.requestId ?? null,
      data: { email_domain: normalizedEmail.split("@")[1] ?? null, user_found: Boolean(user) },
    });
    res.status(400).json(buildError("Invalid login credentials"));
    return;
  }
  if (user.is_active === false) {
    logWarn({
      event: "auth.signin_inactive_user",
      module: "auth",
      requestId: res.locals.requestId ?? null,
      data: { user_id: user.id },
    });
    res.status(403).json(buildError("Usuario inativo"));
    return;
  }
  if (user.role === "admin" && !getPermissionProfile(getUserPermissionProfileId(user)).isActive) {
    logWarn({
      event: "auth.signin_inactive_admin_profile",
      module: "auth",
      requestId: res.locals.requestId ?? null,
      data: { user_id: user.id, profile_id: getUserPermissionProfileId(user) },
    });
    res.status(403).json(buildError("Perfil administrativo inativo"));
    return;
  }

  user.session_token = createSessionToken();
  user.session_expires_at = getSessionExpiry();
  user.session_persistent = true;
  user.last_login_at = new Date().toISOString();
  user.updated_at = new Date().toISOString();
  writeDb(db);
  setSessionCookie(res, user.session_token);
  setCsrfCookie(req, res, user.session_token);
  logInfo({
    event: "auth.signin_success",
    module: "auth",
    requestId: res.locals.requestId ?? null,
    data: { user_id: user.id, role: user.role, profile_id: getUserPermissionProfileId(user) },
  });
  res.json({ user: sanitizeUser(user as unknown as Record<string, unknown>), token: user.session_token });
});

app.post("/api/auth/signout", requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find((item) => item.id === res.locals.user.id);
  if (user) {
    user.session_token = null;
    user.session_expires_at = null;
    writeDb(db);
  }
  setSessionCookie(res, null);
  clearCsrfCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (_req, res) => {
  res.json({ user: sanitizeUser(res.locals.user) });
});

app.post("/api/auth/request-otp", rateLimit({ windowMs: appConfig.auth.rateLimitWindowMs, max: appConfig.auth.rateLimitMax, message: "Limite de codigos excedido" }), async (req, res) => {
  const db = readDb();
  const body = req.body as { email?: string; purpose?: "signin" | "reauth" | "reset_password" };
  if (!isNonEmptyString(body.email || "")) {
    res.status(400).json(buildError("Informe o e-mail"));
    return;
  }

  const email = normalizeEmail(body.email!);
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    res.json({
      ok: true,
      channel: "email",
      expires_in_minutes: appConfig.auth.otpMinutes,
      debug_code: undefined,
    });
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.authOtps.unshift({
    id: createId(),
    email,
    code,
    purpose: body.purpose === "reauth" || body.purpose === "reset_password" ? body.purpose : "signin",
    expires_at: new Date(Date.now() + 1000 * 60 * appConfig.auth.otpMinutes).toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
  });
  writeDb(db);
  const otpEmail = buildOtpEmail(code, body.purpose === "reauth" || body.purpose === "reset_password" ? body.purpose : "signin");
  queueEmailDelivery({
    to: email,
    ...otpEmail,
    tags: [{ name: "category", value: body.purpose === "reset_password" ? "reset_password" : "otp" }],
    idempotencyKey: `otp-${email}-${body.purpose || "signin"}-${code}`,
  });
  res.json({
    ok: true,
    channel: "email",
    expires_in_minutes: appConfig.auth.otpMinutes,
    debug_code: appEnv === "production" ? undefined : code,
  });
});

app.post("/api/auth/verify-otp", rateLimit({ windowMs: appConfig.auth.rateLimitWindowMs, max: appConfig.auth.rateLimitMax, message: "Limite de verificacoes excedido" }), (req, res) => {
  const db = readDb();
  const body = req.body as { email?: string; code?: string };
  if (!isNonEmptyString(body.email || "") || !isNonEmptyString(body.code || "")) {
    res.status(400).json(buildError("Informe e-mail e codigo"));
    return;
  }

  const email = normalizeEmail(body.email!);
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    res.status(400).json(buildError("Codigo invalido ou expirado"));
    return;
  }

  const otp = db.authOtps.find((item) => item.email === email && item.code === body.code && item.consumed_at === null);
  if (!otp || new Date(otp.expires_at) <= new Date()) {
    res.status(400).json(buildError("Codigo invalido ou expirado"));
    return;
  }

  otp.consumed_at = new Date().toISOString();
  user.session_token = createSessionToken();
  user.session_expires_at = getSessionExpiry();
  user.session_persistent = true;
  writeDb(db);
  setSessionCookie(res, user.session_token);
  setCsrfCookie(req, res, user.session_token);
  res.json({ user: sanitizeUser(user as unknown as Record<string, unknown>), token: user.session_token });
});

app.post("/api/auth/reset-password", rateLimit({ windowMs: appConfig.auth.rateLimitWindowMs, max: appConfig.auth.rateLimitMax, message: "Limite de redefinicoes excedido" }), (req, res) => {
  const db = readDb();
  const body = req.body as { email?: string; code?: string; password?: string };
  if (!isNonEmptyString(body.email || "") || !isNonEmptyString(body.code || "") || !isNonEmptyString(body.password || "")) {
    res.status(400).json(buildError("Informe e-mail, codigo e nova senha"));
    return;
  }
  if (!isStrongPassword(body.password!)) {
    res.status(400).json(buildError(`A senha deve ter pelo menos ${appConfig.auth.passwordMinLength} caracteres`));
    return;
  }
  const email = normalizeEmail(body.email!);
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  const otp = db.authOtps.find((item) => item.email === email && item.code === body.code && item.purpose === "reset_password" && item.consumed_at === null);
  if (!user || !otp || new Date(otp.expires_at) <= new Date()) {
    res.status(400).json(buildError("Codigo invalido ou expirado"));
    return;
  }
  otp.consumed_at = new Date().toISOString();
  const hashed = hashPassword(body.password!.trim());
  user.password_hash = hashed.hash;
  user.password_salt = hashed.salt;
  user.session_token = createSessionToken();
  user.session_expires_at = getSessionExpiry();
  writeDb(db);
  setSessionCookie(res, user.session_token);
  setCsrfCookie(req, res, user.session_token);
  res.json({ ok: true, user: sanitizeUser(user as unknown as Record<string, unknown>), token: user.session_token });
});

app.post("/api/auth/reauthenticate", requireAuth, rateLimit({ windowMs: appConfig.auth.rateLimitWindowMs, max: appConfig.auth.rateLimitMax, message: "Limite de tentativas excedido" }), (req, res) => {
  const db = readDb();
  const body = req.body as { password?: string };
  if (!isNonEmptyString(body.password || "")) {
    res.status(400).json(buildError("Informe a senha"));
    return;
  }

  const user = db.users.find((item) => item.id === res.locals.user.id);
  if (!user || !verifyPassword(body.password!, user)) {
    res.status(401).json(buildError("Senha invalida"));
    return;
  }

  user.session_token = createSessionToken();
  user.session_expires_at = getSessionExpiry();
  writeDb(db);
  setSessionCookie(res, user.session_token);
  setCsrfCookie(req, res, user.session_token);
  res.json({ ok: true, token: user.session_token });
});

app.get("/api/customer-center/profile", requireAuth, (_req, res) => {
  const db = readDb();
  const profile = getOrCreateCustomerProfile(db, res.locals.user);
  writeDb(db);
  res.json(profile);
});

app.put("/api/customer-center/profile", requireAuth, (req, res) => {
  void handleUpdateCustomerProfile(req, res);
});

app.get("/api/stores", (_req, res) => {
  const db = readDb();
  res.json(db.stores.filter((item) => item.is_active));
});

app.get("/api/site-content", (_req, res) => {
  const db = readDb();
  res.json(db.siteContent);
});

app.get("/api/commercial-settings", (_req, res) => {
  const db = readDb();
  res.json(db.commercialSettings);
});

app.get("/api/public-apis/status", (_req, res) => {
  res.json(getPublicApiRuntimeStatus());
});

app.get("/api/platform/modules", (_req, res) => {
  res.json(activeModuleRegistry);
});

app.get("/api/delivery-zones", (_req, res) => {
  const db = readDb();
  res.json(db.deliveryZones.filter((item) => item.is_active));
});

app.get("/api/address/cep/:cep", async (req, res) => {
  const cep = String(req.params.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) {
    res.status(400).json(buildError("CEP invalido"));
    return;
  }

  const result = await lookupBrazilianAddressByCep(cep);
  if (!result.ok) {
    res.status(404).json(result);
    return;
  }

  res.json(result);
});

app.get("/api/company/cnpj/:cnpj", async (req, res) => {
  const cnpj = String(req.params.cnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14) {
    res.status(400).json(buildError("CNPJ invalido"));
    return;
  }

  const result = await lookupBrazilianCompanyByCnpj(cnpj);
  if (!result.ok) {
    res.status(404).json(result);
    return;
  }

  res.json(result);
});

app.get("/api/shipping/quote", rateLimit({ windowMs: 60_000, max: 60, message: "Limite de consultas de frete excedido" }), async (req, res) => {
  const db = readDb();
  const cep = String(req.query.cep || "").replace(/\D/g, "");
  const subtotal = Number(req.query.subtotal || 0);
  const rawItems = typeof req.query.items === "string" ? req.query.items : "[]";

  if (cep.length !== 8) {
    res.status(400).json(buildError("CEP invalido"));
    return;
  }

  const options: Array<{
    id: string;
    name: string;
    price: number;
    estimatedDays: string;
    description: string;
    deliveryType: "pickup" | "delivery";
    zoneId?: string | null;
    provider?: string;
    coverage?: "pickup" | "local" | "national";
  }> = [];

  if (db.commercialSettings.pickup_enabled) {
    options.push({
      id: "pickup",
      name: "Retirada na loja",
      price: 0,
      estimatedDays: "Mesmo dia",
      description: db.commercialSettings.pickup_message,
      deliveryType: "pickup",
      zoneId: null,
      coverage: "pickup",
    });
  }

  const matchedZone = db.deliveryZones.find((zone) => {
    if (!zone.is_active || !zone.delivery_enabled) return false;
    if (!zone.zip_code) return false;
    const cleanZone = zone.zip_code.replace(/\D/g, "");
    return cleanZone.length >= 5 ? cep.startsWith(cleanZone.slice(0, 5)) : false;
  });

  let externalOptions: Array<{
    id: string;
    name: string;
    price: number;
    estimatedDays: string;
    description: string;
    deliveryType: "pickup" | "delivery";
    zoneId?: string | null;
    provider?: string;
    isCheapest?: boolean;
    isFastest?: boolean;
  }> = [];
  let externalMessage = "";
  try {
    const parsedItems = JSON.parse(rawItems) as Array<{ productId: string; quantity: number }>;
    const productRows = Array.isArray(parsedItems)
      ? parsedItems
          .map((item) => ({
            product: db.products.find((product) => product.id === item.productId),
            quantity: Number(item.quantity || 0),
          }))
          .filter((item): item is { product: DbProduct; quantity: number } => Boolean(item.product) && item.quantity > 0)
      : [];

    if (productRows.length > 0) {
      const external = await freightService.quote({
        cep,
        subtotal,
        items: productRows,
        strategy: req.query.strategy === "fastest" ? "fastest" : "cheapest",
      });
      externalOptions = external.options;
      externalMessage = external.message;
    }
  } catch {
    externalOptions = [];
  }

  if (db.commercialSettings.local_delivery_enabled && matchedZone) {
    const fee = subtotal >= 500 ? 0 : matchedZone.delivery_fee;
    options.push({
      id: `delivery-${matchedZone.id}`,
      name: `Entrega local - ${matchedZone.neighborhood}`,
      price: fee,
      estimatedDays: `${matchedZone.estimated_days} dia(s)`,
      description: matchedZone.notes || db.commercialSettings.delivery_message,
      deliveryType: "delivery",
      zoneId: matchedZone.id,
      coverage: "local",
    });
  }

  if (externalOptions.length > 0) {
    options.push(...externalOptions.map((option) => ({ ...option, coverage: "national" as const })));
  }

  const freightStatus = getFreightProviderStatus();
  const nationalRequested = !matchedZone;
  const automaticFreightProviders = ["melhor-envio", "correios", "frenet", "frete-barato", "fretebarato", "cepcerto", "fake"];
  const nationalFreightReady = automaticFreightProviders.includes(appConfig.freightProvider) && freightStatus.ready && externalOptions.length > 0;
  const nationalMissing =
    appConfig.freightProvider === "melhor-envio" || appConfig.freightProvider === "correios"
      ? freightStatus.missing
      : appConfig.freightProvider === "fake"
        ? []
      : ["FREIGHT_PROVIDER=melhor-envio", "MELHOR_ENVIO_TOKEN", "MELHOR_ENVIO_ORIGIN_ZIP", "CORREIOS_TOKEN", "CORREIOS_ORIGIN_ZIP"];
  const underAnalysis = nationalRequested && !nationalFreightReady;
  const regionLabel = matchedZone ? `${matchedZone.neighborhood}, ${matchedZone.city}/${matchedZone.state}` : `Brasil - CEP ${cep}`;
  const message = matchedZone
    ? "Entrega local disponivel para esta regiao."
    : nationalFreightReady
      ? "Frete nacional cotado por transportadora homologada."
      : externalMessage || "Entrega nacional solicitada. Configure Correios ou Melhor Envio homologado para liberar cotacao automatica para este CEP.";

  res.json({
    options,
    regionLabel,
    underAnalysis,
    message,
    nationalCoverage: {
      requested: nationalRequested,
      ready: nationalFreightReady,
      provider: automaticFreightProviders.includes(appConfig.freightProvider) ? appConfig.freightProvider : "local-rules",
      mode: nationalFreightReady ? "automatic" : nationalRequested ? "provider_required" : "local",
      missing: nationalRequested && !nationalFreightReady ? nationalMissing : [],
      message,
    },
  });
});

app.get("/api/admin/freight/observability", requireAdminModule("delivery", "view"), (_req, res) => {
  const db = readDb();
  const now = Date.now();
  const dayAgo = now - 1000 * 60 * 60 * 24;
  const recentHistory = db.freightQuoteHistory.filter((entry) => new Date(entry.created_at).getTime() >= dayAgo);
  const recentErrors = db.freightErrorLogs.filter((entry) => new Date(entry.created_at).getTime() >= dayAgo);
  const validCache = db.freightQuoteCache.filter((entry) => new Date(entry.expires_at).getTime() > now);
  const providerCounts = recentHistory.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.provider] = (acc[entry.provider] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    summary: {
      cache_entries: db.freightQuoteCache.length,
      cache_valid: validCache.length,
      quotes_24h: recentHistory.length,
      errors_24h: recentErrors.length,
      fallback_24h: recentHistory.filter((entry) => entry.fallback_used).length,
      avg_response_time_ms:
        recentHistory.length > 0
          ? Number((recentHistory.reduce((sum, entry) => sum + entry.response_time_ms, 0) / recentHistory.length).toFixed(2))
          : 0,
    },
    providers: providerCounts,
    recent_quotes: db.freightQuoteHistory.slice(0, 50),
    recent_errors: db.freightErrorLogs.slice(0, 50),
  });
});

app.get("/api/admin/stores", requireAdminModule("delivery", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminStores(db));
});

app.get("/api/admin/delivery-zones", requireAdminModule("delivery", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminDeliveryZones(db));
});

app.get("/api/admin/freight-carriers", requireAdminModule("delivery", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminFreightCarriers(db));
});

app.get("/api/admin/orders/:id/freight-profile", requireAdminModule("delivery", "view"), (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === String(req.params.id));
  if (!order) {
    res.status(404).json(buildError("Pedido nao encontrado"));
    return;
  }
  res.json(buildOrderFreightProfile(db, order));
});

app.post("/api/admin/freight-carriers", requireAdminModule("delivery", "limited"), (req, res) => {
  void handleAdminCreateFreightCarrier(req, res);
});

app.patch("/api/admin/freight-carriers/:id", requireAdminModule("delivery", "limited"), (req, res) => {
  void handleAdminUpdateFreightCarrier(req, res);
});

app.post("/api/admin/delivery-zones", requireAdminModule("delivery", "limited"), (req, res) => {
  void handleAdminCreateDeliveryZone(req, res);
});

app.patch("/api/admin/delivery-zones/:id", requireAdminModule("delivery", "limited"), (req, res) => {
  void handleAdminUpdateDeliveryZone(req, res);
});

app.post("/api/admin/stores", requireAdminModule("delivery", "limited"), (req, res) => {
  void handleAdminCreateStore(req, res);
});

app.get("/api/admin/sellers", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(db.sellers.map((item) => sellerView(db, item)));
});

app.post("/api/admin/sellers", requireAdminModule("orders", "limited"), (req, res) => {
  void handleAdminCreateSeller(req, res);
});

app.get("/api/coupons/:code", (req, res) => {
  const db = readDb();
  const orderValue = Number(req.query.orderValue || 0);
  const { coupon, error } = resolveCoupon(db, req.params.code, orderValue);
  if (error) {
    const status = error.includes("nao encontrado") ? 404 : 400;
    res.status(status).json(buildError(error));
    return;
  }
  res.json(coupon);
});

app.post("/api/assisted-sales/start", requireAuth, (_req, res) => {
  const db = readDb();
  const user = res.locals.user;
  if (!canStartAssistedSale(user)) {
    res.status(403).json(buildError("Usuario sem permissao para iniciar compra assistida"));
    return;
  }
  const correlationId = createId();
  const sellerContext = {
    seller_id: user.id,
    seller_name: user.user_metadata?.full_name || user.email,
    store_id: user.user_metadata?.store_id || "garanhuns",
    store_name: user.user_metadata?.store_name || "Showroom Garanhuns",
    can_start_assisted_sale: true,
  };
  const startedEvent = createAuditEvent(db, {
    eventType: "assisted_sale.started",
    correlationId,
    actorId: user.id,
    actorName: user.user_metadata?.full_name || user.email,
    sourceChannel: "store",
    payload: { mode: "showroom", entrypoint: "seller-console" },
  });
  const modeActivatedEvent = createAuditEvent(db, {
    eventType: "assisted_sale.mode_activated",
    correlationId,
    actorId: user.id,
    actorName: user.user_metadata?.full_name || user.email,
    sourceChannel: "store",
    payload: { ...sellerContext, order_type: "assisted", order_origin: "showroom" },
  });
  const sellerAssignedEvent = createAuditEvent(db, {
    eventType: "assisted_sale.seller_auto_assigned",
    correlationId,
    actorId: user.id,
    actorName: user.user_metadata?.full_name || user.email,
    sourceChannel: "store",
    payload: { seller_id: sellerContext.seller_id, seller_name: sellerContext.seller_name },
  });
  const storeAssignedEvent = createAuditEvent(db, {
    eventType: "assisted_sale.store_auto_assigned",
    correlationId,
    actorId: user.id,
    actorName: user.user_metadata?.full_name || user.email,
    sourceChannel: "store",
    payload: { store_id: sellerContext.store_id, store_name: sellerContext.store_name },
  });
  writeDb(db);
  res.json({
    correlation_id: correlationId,
    mode: {
      order_type: "assisted",
      order_origin: "showroom",
      source_channel: "store",
      source_actor: "human",
      assisted_sale: true,
      delivery_required: true,
      pickup_allowed: false,
    },
    seller: sellerContext,
    events: [startedEvent, modeActivatedEvent, sellerAssignedEvent, storeAssignedEvent],
  });
});

app.post("/api/orders", (req, res) => {
  void handleCreateOrder(req, res, req.body as Parameters<typeof handleCreateOrder>[2]);
});

app.post("/api/orders/:id/payment", async (req, res) => {
  await handleOrderPaymentMutation(req, res, String(req.params.id), req.body as { action?: "initiate" | "approve" | "fail"; paymentMethod?: PaymentMethod; paymentReference?: string | null; trackingToken?: string | null });
});

app.get("/api/orders/me", requireAuth, (_req, res) => {
  const db = readDb();
  res.json(listUserOrders(db, res.locals.user.id));
});

app.get("/api/orders/:id/items", (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === String(req.params.id));
  if (!order) {
    res.status(404).json(buildError("Pedido nao encontrado"));
    return;
  }
  const trackingToken = typeof req.query.trackingToken === "string" ? req.query.trackingToken : null;
  const access = canAccessOrder(order, getCurrentUserOptional(req), trackingToken);
  if (!access.allowed) {
    res.status(403).json(buildError("Acesso negado"));
    return;
  }
  res.json(listOrderItems(db, String(req.params.id)));
});

app.get("/api/orders/track/:token", (req, res) => {
  const db = readDb();
  const trackingView = getTrackedOrderView(db, req.params.token);
  if (!trackingView) {
    res.status(404).json(buildError("Pedido nao encontrado"));
    return;
  }
  res.json(trackingView);
});

app.get("/api/orders/:id/payments", requireAuth, (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === String(req.params.id));
  if (!order) {
    res.status(404).json(buildError("Pedido nao encontrado"));
    return;
  }
  const access = canAccessOrder(order, res.locals.user, null);
  if (!access.allowed) {
    res.status(403).json(buildError("Acesso negado"));
    return;
  }
  res.json(getOrderPaymentView(db, String(req.params.id)));
});

app.get("/api/payment-provider/status", (_req, res) => {
  res.json(getPaymentProviderStatus());
});

app.get("/api/freight-provider/status", (_req, res) => {
  res.json(getFreightProviderStatus());
});

app.post("/api/orders/:id/payment-intent", async (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === String(req.params.id));
  if (!order) {
    res.status(404).json(buildError("Pedido nao encontrado"));
    return;
  }
  const body = req.body as { trackingToken?: string | null };
  const access = canAccessOrder(order, getCurrentUserOptional(req), body.trackingToken);
  if (!access.allowed) {
    res.status(403).json(buildError("Acesso negado"));
    return;
  }

  if (!order.payment_reference) {
    order.payment_reference = `${String(order.payment_method).toUpperCase()}-${order.order_number}`;
    order.updated_at = new Date().toISOString();
    writeDb(db);
  }

  const orderItems = db.orderItems.filter((item) => item.order_id === order.id);
  res.json({
    order_id: order.id,
    intent: configuredPaymentProvider === "manual" ? buildPaymentIntent(order) : await createProviderPaymentIntent({ order, items: orderItems }),
  });
});

app.post("/api/payments/webhook/mercadopago", async (req, res) => {
  await handleMercadoPagoWebhook(req, res);
});

app.post("/api/payments/webhook", (req, res) => {
  void handleGenericPaymentWebhook(req, res, req.body as {
    eventType?: "payment_succeeded" | "payment_failed" | "payment_refunded";
    orderId?: string;
    externalReference?: string;
    amount?: number;
    idempotencyKey?: string;
    provider?: DbPaymentRecord["provider"];
  });
});

app.post("/api/quotes", requireAuth, (req, res) => {
  void handleCreateQuote(req, res);
});

app.post("/api/quote-requests", rateLimit({ windowMs: appConfig.rateLimit.quoteWindowMs, max: appConfig.rateLimit.quoteMax, message: "Muitas solicitacoes de orcamento em pouco tempo" }), (req, res) => {
  void handleCreatePublicQuoteRequest(req, res);
});

app.get("/api/quote-requests/:id/pdf", rateLimit({ windowMs: appConfig.rateLimit.quoteWindowMs, max: appConfig.rateLimit.quoteMax, message: "Muitas solicitacoes em pouco tempo" }), (req, res) => {
  const db = readDb();
  const request = db.quoteRequests.find((entry) => entry.id === String(req.params.id));
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!request || !token || token !== request.access_token) {
    res.status(404).json(buildError("Solicitacao de orcamento nao encontrada"));
    return;
  }
  // O token de acesso (UUID aleatorio, entregue so a quem enviou a solicitacao) ja prova a posse
  // do pedido - o PDF e o proprio comprovante do cliente, nao material de marketing, entao seu
  // download nao deve depender do opt-in de contato comercial por e-mail/telefone.

  const items = db.quoteRequestItems.filter((item) => item.quote_request_id === request.id).sort((a, b) => a.sort_order - b.sort_order);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="orcamento-${request.protocol}.pdf"`);
  const doc = generateQuoteRequestPdf(request, items);
  doc.pipe(res);
});

app.post("/api/leads/cart-abandonment", rateLimit({ windowMs: appConfig.rateLimit.quoteWindowMs, max: appConfig.rateLimit.quoteMax, message: "Muitas solicitacoes em pouco tempo" }), (req, res) => {
  void handleCreateCartAbandonmentLead(req, res);
});

app.get("/api/admin/quotes", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminQuotes(db));
});

app.get("/api/admin/quotes/:id/items", requireAdminModule("orders", "view"), (req, res) => {
  const db = readDb();
  res.json(listAdminQuoteItems(db, String(req.params.id)));
});

app.get("/api/admin/quote-requests", requireAdminPermission("quote_request.read"), (_req, res) => {
  const db = readDb();
  res.json({ requests: getPublicQuoteRequests(db) });
});

app.get("/api/admin/quote-requests/:id", requireAdminPermission("quote_request.read_detail"), (req, res) => {
  const db = readDb();
  const detail = getQuoteRequestAdminDetail(db, String(req.params.id));
  if (!detail) {
    res.status(404).json(buildError("Solicitacao nao encontrada"));
    return;
  }
  res.json(detail);
});

app.get("/api/admin/quote-requests/:id/pdf", requireAdminPermission("quote_request.read_detail"), (req, res) => {
  const db = readDb();
  const request = db.quoteRequests.find((entry) => entry.id === String(req.params.id));
  if (!request) {
    res.status(404).json(buildError("Solicitacao nao encontrada"));
    return;
  }
  const items = db.quoteRequestItems.filter((item) => item.quote_request_id === request.id).sort((a, b) => a.sort_order - b.sort_order);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="orcamento-${request.protocol}.pdf"`);
  const doc = generateQuoteRequestPdf(request, items);
  doc.pipe(res);
});

app.patch("/api/admin/quote-requests/:id/status", requireAdminPermission("quote_request.update_status"), async (req, res) => {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.quote_request.status", () => {
    const db = readDb();
    const status = String(req.body?.status || "") as QuoteRequestStatus;
    if (!quoteRequestStatuses.includes(status)) return { status: 400, payload: buildError("Status invalido") };
    const mutation = updateQuoteRequestStatus(db, String(req.params.id), status, { actorId, actorName }, String(req.body?.note || ""));
    if (!mutation.ok) return { status: mutation.status, payload: buildError(mutation.error) };
    writeDb(db);
    return { status: 200, payload: getQuoteRequestAdminDetail(db, String(req.params.id)) };
  });
  res.status(result.status).json(result.payload);
});

app.patch("/api/admin/quote-requests/:id/responsible", requireAdminPermission("quote_request.assign"), async (req, res) => {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.quote_request.responsible", () => {
    const db = readDb();
    const mutation = assignQuoteRequestResponsible(
      db,
      String(req.params.id),
      { userId: req.body?.responsible_user_id ?? req.body?.userId ?? null, name: req.body?.responsible_name ?? req.body?.name ?? null },
      { actorId, actorName },
    );
    if (!mutation.ok) return { status: mutation.status, payload: buildError(mutation.error) };
    writeDb(db);
    return { status: 200, payload: getQuoteRequestAdminDetail(db, String(req.params.id)) };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/quote-requests/:id/notes", requireAdminPermission("quote_request.add_note"), async (req, res) => {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.quote_request.note", () => {
    const db = readDb();
    const mutation = createQuoteRequestNote(db, String(req.params.id), String(req.body?.note || ""), { actorId, actorName });
    if (!mutation.ok) return { status: mutation.status, payload: buildError(mutation.error) };
    writeDb(db);
    return { status: 201, payload: mutation.note };
  });
  res.status(result.status).json(result.payload);
});

app.patch("/api/admin/quote-requests/:id/next-action", requireAdminPermission("quote_request.add_note"), async (req, res) => {
  const { actorId, actorName } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.quote_request.next_action", () => {
    const db = readDb();
    const mutation = updateQuoteRequestNextAction(
      db,
      String(req.params.id),
      { nextAction: req.body?.next_action ?? req.body?.nextAction ?? null, dueAt: req.body?.next_action_due_at ?? req.body?.dueAt ?? null },
      { actorId, actorName },
    );
    if (!mutation.ok) return { status: mutation.status, payload: buildError(mutation.error) };
    writeDb(db);
    return { status: 200, payload: getQuoteRequestAdminDetail(db, String(req.params.id)) };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/quotes/:id/convert", requireAdminModule("orders", "limited"), (req, res) => {
  void handleAdminConvertQuote(req, res);
});

app.get("/api/admin/executive/summary", requireAdminModule("orders", "view"), async (_req, res) => {
  const db = readDb();
  const fiscalMinimal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const operations = getOperationReadinessReport(db);
  const marketing = getMarketingReadiness(db);
  const imageAudit = getAdminCatalogImageAudit(db);
  const [integrationOverview, phase1, phase2, security, goLive] = await Promise.all([
    getIntegrationOverview(),
    getPhase1ReadinessReport(),
    getPhase2ReadinessReport(),
    getSecurityReadinessReport(),
    getGoLiveReadinessReport(),
  ]);

  const providers = listIntegrationProviders(db);
  const activeOrders = db.orders.filter((order) => order.status !== "cancelled");
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const last7Days = now - 7 * 24 * 60 * 60 * 1000;
  const last30Days = now - 30 * 24 * 60 * 60 * 1000;
  const orderStatus = activeOrders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});
  const ordersToday = activeOrders.filter((order) => new Date(order.created_at).getTime() >= startOfToday.getTime());
  const ordersWeek = activeOrders.filter((order) => new Date(order.created_at).getTime() >= last7Days);
  const ordersMonth = activeOrders.filter((order) => new Date(order.created_at).getTime() >= last30Days);
  const totalRevenue = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const averageTicket = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0;
  const requiredProviders = providers.filter((provider) => provider.is_required_for_production);
  const requiredReady = requiredProviders.filter((provider) => provider.is_configured && provider.status === "production").length;
  const blockedExternal = requiredProviders.filter((provider) => !provider.is_configured || /bloquead/i.test(provider.status) || /pendente/i.test(provider.status)).length;
  const sandbox = providers.filter((provider) => provider.status === "sandbox" || String(provider.public_config_json?.mode || "").toLowerCase().includes("sandbox")).length;
  const readinessBlockers = phase1.blockers + phase2.blockers + security.blockers + fiscalMinimal.blockers + operations.blockers + goLive.blockers;
  const readinessWarnings = phase1.warnings + phase2.warnings + security.warnings + fiscalMinimal.warnings + operations.warnings + goLive.warnings + marketing.warnings;
  const readinessScore = Math.max(0, 100 - (readinessBlockers * 14 + readinessWarnings * 3));
  const queueStats = getQueueStats();
  const pendingJobs = Object.values(queueStats?.queues ?? {}).reduce((total, queue) => total + Number((queue as Record<string, unknown>).queued ?? 0), 0);
  const failedJobs = Object.values(queueStats?.queues ?? {}).reduce((total, queue) => total + Number((queue as Record<string, unknown>).failed ?? 0), 0);
  const visualQuarantineQueue = db.products
    .filter(
      (product) =>
        !product.is_active &&
        (product.image_review_notes?.includes("Retirado de publicacao") ||
          product.image_review_notes?.includes("Retirado de publicação")),
    )
    .map((product) => ({
      id: product.id,
      sku: product.sku ?? null,
      name: product.name,
      image_review_status: product.image_review_status ?? "manual_review",
      image_review_notes: product.image_review_notes ?? null,
    }))
    .slice(0, 8);
  const alerts = [
    !fiscalMinimal.ready ? {
      priority: "CRITICO",
      title: "Fiscal minimo bloqueado",
      detail: `${Number(fiscalMinimal.metrics.pending_fiscal_profiles ?? fiscalMinimal.blockers ?? 0)} perfil(is) do mix minimo seguem sem NCM/tax_code validado.`,
      href: "/admin/fiscal-financeiro",
    } : null,
    imageAudit.active_summary.critical > 0 ? {
      priority: "ALTO",
      title: "Catalogo com imagem critica",
      detail: `${imageAudit.active_summary.critical} produto(s) ativo(s) estao sem imagem valida ou com placeholder.`,
      href: "/admin/produtos",
    } : null,
    imageAudit.active_summary.suspect > 0 ? {
      priority: "ALTO",
      title: "Imagens suspeitas no catalogo",
      detail: `${imageAudit.active_summary.suspect} produto(s) ativo(s) tem imagem generica, duplicada ou metadados divergentes.`,
      href: "/admin/produtos",
    } : null,
    visualQuarantineQueue.length > 0 ? {
      priority: "MEDIO",
      title: "Produtos retirados de publicacao por risco visual",
      detail: `${visualQuarantineQueue.length} SKU(s) aguardam revisao humana antes de voltar para home, vitrine ou campanha.`,
      href: "/admin/produtos",
    } : null,
    Number(orderStatus.payment_approved ?? 0) + Number(orderStatus.confirmed ?? 0) > 0 ? {
      priority: "MEDIO",
      title: "Pedidos pagos aguardando separacao",
      detail: `${Number(orderStatus.payment_approved ?? 0) + Number(orderStatus.confirmed ?? 0)} pedido(s) pagos aguardam fila operacional.`,
      href: "/admin/operacao",
    } : null,
    blockedExternal > 0 ? {
      priority: "ALTO",
      title: "Integracoes obrigatorias ainda nao homologadas",
      detail: `${blockedExternal} integracao(oes) obrigatoria(s) seguem bloqueadas para producao real.`,
      href: "/admin/integracoes",
    } : null,
  ].filter(Boolean);

  const recommendations = [
    imageAudit.active_summary.critical > 0 || imageAudit.active_summary.suspect > 0
      ? {
          title: "Revisar imagens do catalogo",
          detail: "Priorize SKUs ativos com imagem critica ou suspeita antes de qualquer campanha.",
          owner: "Catalogo e conteudo",
          href: "/admin/produtos",
        }
      : null,
    visualQuarantineQueue.length > 0
      ? {
          title: "Tratar fila de quarentena visual",
          detail: "Existem produtos retirados de publicacao. Confirmar troca de imagem, alt text e coerencia antes de reativar.",
          owner: "Catalogo e conteudo",
          href: "/admin/produtos",
        }
      : null,
    !fiscalMinimal.ready
      ? {
          title: "Fechar fiscal minimo com contador",
          detail: "Aplicar close pack validado e rerodar fiscal:check:minimal.",
          owner: "Fiscal / Contador",
          href: "/admin/fiscal-financeiro",
        }
      : null,
    blockedExternal > 0
      ? {
          title: "Homologar providers reais",
          detail: "Mercado Pago, frete real, email e observabilidade continuam fora do go-live aberto.",
          owner: "Admin Master / DevOps",
          href: "/admin/integracoes",
        }
      : null,
  ].filter(Boolean);

  res.json({
    generated_at: new Date().toISOString(),
    executive: {
      readiness_score: readinessScore,
      maturity_level: readinessBlockers === 0 ? "APTO COM RESSALVAS" : "TESTE INTERNO",
      environment: appConfig.env,
      blockers: readinessBlockers,
      warnings: readinessWarnings,
    },
    orders: {
      total: activeOrders.length,
      pending: Number(orderStatus.pending ?? 0) + Number(orderStatus.awaiting_payment ?? 0),
      today: ordersToday.length,
      week: ordersWeek.length,
      month: ordersMonth.length,
      revenue: totalRevenue,
      average_ticket: averageTicket,
      paid_waiting_separation: Number(orderStatus.payment_approved ?? 0) + Number(orderStatus.confirmed ?? 0),
      awaiting_payment: Number(orderStatus.awaiting_payment ?? 0),
      expedition_attention: activeOrders.filter((order) => ["in_separation", "in_expedition", "shipped", "out_for_delivery"].includes(order.status)).length,
    },
      catalog: {
        total_products: db.products.length,
        low_stock: db.products.filter((product) => product.stock > 0 && product.stock <= 5).length,
        active_products: db.products.filter((product) => product.is_active).length,
        active_without_stock: db.products.filter((product) => product.is_active && Number(product.stock) <= 0).length,
        active_without_fiscal: db.products.filter((product) => product.is_active && (!product.ncm || product.tax_classification_status !== "ready")).length,
        visual_quarantine_active: visualQuarantineQueue.length,
        image_audit: imageAudit.summary,
        image_audit_active: imageAudit.active_summary,
        image_audit_inactive: imageAudit.inactive_summary,
        image_audit_progress: {
          review_required: imageAudit.review_required,
          review_required_active: imageAudit.review_required_active,
          human_override_total: imageAudit.summary.human_override_total,
          resolved_by_override:
            imageAudit.summary.duplicate_override + imageAudit.summary.generic_override + imageAudit.summary.metadata_override,
          duplicate_override: imageAudit.summary.duplicate_override,
          generic_override: imageAudit.summary.generic_override,
          metadata_override: imageAudit.summary.metadata_override,
          categories_with_backlog: imageAudit.category_summary.filter((category) => category.suspect > 0 || category.critical > 0 || category.manual_review > 0).length,
        },
        image_audit_assignment: imageAudit.assignment_summary,
        visual_quarantine_queue: visualQuarantineQueue,
      },
    fiscal: {
      ready: fiscalMinimal.ready,
      blockers: fiscalMinimal.blockers,
      warnings: fiscalMinimal.warnings,
      pending_profiles: Number(fiscalMinimal.metrics.pending_fiscal_profiles ?? 0),
      pending_documents: Number(fiscalMinimal.metrics.pending_fiscal_documents ?? 0),
    },
    integrations: {
      total: providers.length,
      required: requiredProviders.length,
      required_ready: requiredReady,
      blocked_external: blockedExternal,
      sandbox,
      active: providers.filter((provider) => provider.status === "production").length,
      overview: integrationOverview,
    },
    security: {
      blockers: security.blockers,
      warnings: security.warnings,
      secure_cookies: appConfig.secureCookies,
      csrf_configured: Boolean(appConfig.auth.csrfSecret.trim()),
    },
    performance: {
      queue_provider: appConfig.queueProvider,
      database_provider: appConfig.dbProvider,
      pending_jobs: pendingJobs,
      failed_jobs: failedJobs,
    },
    alerts,
    recommendations,
  });
});

app.get("/api/admin/executive/report", requireAdminModule("orders", "view"), (req, res) => {
  const db = readDb();
  const report = buildExecutiveReport(db);
  if (req.query.format === "md" || req.query.format === "markdown") {
    res.type("text/markdown").send(report.markdown);
    return;
  }
  res.json(report);
});

app.get("/api/admin/executive/actions.csv", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.type("text/csv").send(`${buildExecutiveActionsCsv(db)}\n`);
});

app.get("/api/admin/executive/decision-board", requireAdminModule("orders", "view"), async (_req, res) => {
  const db = readDb();
  res.json(await buildExecutiveDecisionBoard(db));
});

app.get("/api/admin/executive/briefing", requireAdminModule("orders", "view"), async (req, res) => {
  const db = readDb();
  const briefing = await buildExecutiveBriefing(db);
  if (req.query.format === "md" || req.query.format === "markdown") {
    res.type("text/markdown").send(briefing.markdown);
    return;
  }
  res.json(briefing);
});

app.get("/api/admin/management/tasks", requireAdminModule("orders", "view"), (req, res) => {
  const tasks = buildAdminManagementTasks(readDb());
  if (req.query.format === "csv") {
    res.type("text/csv").send(`${renderAdminManagementTasksCsv(tasks)}\n`);
    return;
  }
  res.json({ generated_at: new Date().toISOString(), tasks });
});

app.post("/api/admin/management/tasks", requireAdminModule("orders", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.management.task.create", () => {
    const db = readDb();
    const payload = upsertAdminManagementTask(db, null, req.body ?? {}, context);
    writeDb(db);
    return { status: 201, payload };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.patch("/api/admin/management/tasks/:id", requireAdminModule("orders", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.management.task.update", () => {
    const db = readDb();
    const payload = upsertAdminManagementTask(db, String(req.params.id), req.body ?? {}, context);
    writeDb(db);
    return { status: 200, payload };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/management/tasks/:id/events", requireAdminModule("orders", "view"), (req, res) => {
  res.json({ task_id: String(req.params.id), events: getAdminManagementTaskEvents(readDb(), String(req.params.id)) });
});

app.get("/api/admin/management/daily", requireAdminModule("orders", "view"), (_req, res) => {
  res.json(buildAdminDailyManagement(readDb()));
});

app.get("/api/admin/catalog/image-audit", requireAdminModule("catalog", "view"), (req, res) => {
  const db = readDb();
  const productId = typeof req.query.productId === "string" ? req.query.productId : null;
  res.json(getAdminCatalogImageAudit(db, { productId }));
});

app.get("/api/admin/catalog/pim-readiness", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminCatalogPimReadiness(db));
});

app.get("/api/admin/products/:id/quality-score", requireAdminModule("catalog", "view"), (req, res) => {
  const db = readDb();
  const score = getAdminProductQualityScore(db, String(req.params.id));
  if (!score) {
    res.status(404).json(buildError("Produto nao encontrado"));
    return;
  }
  res.json(score);
});

app.get("/api/admin/media-library", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminMediaLibrary(db));
});

app.get("/api/admin/media-library/usage-map", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminMediaUsageMap(db));
});

app.post("/api/admin/media-library/:id/review", requireAnyAdminPermission(["catalog.edit", "products.media_manage"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.media_library.review", () => {
    const db = readDb();
    const reviewed = applyMediaLibraryReview(db, {
      mediaId: String(req.params.id),
      decision: String(req.body?.decision || "manual_review") as "approved" | "manual_review" | "suspect" | "rejected" | "reopen",
      note: typeof req.body?.note === "string" ? req.body.note : null,
    });
    if (!reviewed.ok) return { status: 404, payload: buildError(reviewed.error) };
    createAdminAuditEvent(db, req, {
      eventType: "catalog.media_review_updated",
      entity: "media_library",
      entityId: String(req.params.id),
      payload: {
        decision: req.body?.decision ?? "manual_review",
        actor_id: actorId,
        actor_name: actorName,
        correlation_id: correlationId,
      },
    });
    writeDb(db);
    return { status: 200, payload: reviewed.product };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/wms/summary", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminWmsSummary(db));
});

app.get("/api/admin/wms/picking-queue", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminWmsPickingQueue(db));
});

app.get("/api/admin/wms/inventory-health", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminWmsInventoryHealth(db));
});

app.post("/api/admin/wms/picking-tasks", requireAnyAdminPermission(["orders.release_to_picking", "orders.advance_stage", "shipping.manage"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.wms.create_task", () => {
    const db = readDb();
    const created = createPickingTask({
      db,
      orderId: String(req.body?.orderId || ""),
      actorId,
      actorName,
      correlationId,
    });
    if (!created.ok) return { status: 400, payload: buildError(created.error) };
    writeDb(db);
    return { status: created.reused ? 200 : 201, payload: created };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/wms/picking-tasks/:id/assign", requireAnyAdminPermission(["orders.assign_owner", "orders.release_to_picking", "shipping.manage"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.wms.assign_task", () => {
    const db = readDb();
    const assigned = assignPickingTask({
      db,
      taskId: String(req.params.id),
      userId: String(req.body?.userId || ""),
      actorId,
      actorName,
      correlationId,
    });
    if (!assigned.ok) return { status: 400, payload: buildError(assigned.error) };
    writeDb(db);
    return { status: 200, payload: assigned.task };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/wms/picking-tasks/:id/start", requireAnyAdminPermission(["orders.advance_stage", "orders.release_to_picking", "shipping.update_status"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const actorProfileId = getUserPermissionProfileId(res.locals.user as DatabaseShape["users"][number]);
  const result = await runSerializedMutation("admin.wms.start_task", () => {
    const db = readDb();
    const started = startPickingTask({
      db,
      taskId: String(req.params.id),
      actorId,
      actorName,
      actorProfileId,
      correlationId,
    });
    if (!started.ok) return { status: 400, payload: buildError(started.error) };
    writeDb(db);
    return { status: 200, payload: started.task };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/wms/picking-tasks/:id/confirm-item", requireAnyAdminPermission(["orders.advance_stage", "shipping.update_status", "stock.report_issue"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.wms.confirm_item", () => {
    const db = readDb();
    const confirmed = confirmPickingTaskItem({
      db,
      taskId: String(req.params.id),
      itemId: String(req.body?.itemId || ""),
      quantityPicked: Number(req.body?.quantityPicked ?? 0),
      divergenceReason: typeof req.body?.divergenceReason === "string" ? req.body.divergenceReason : null,
      actorId,
      actorName,
      correlationId,
    });
    if (!confirmed.ok) return { status: 400, payload: buildError(confirmed.error) };
    writeDb(db);
    return { status: 200, payload: { task: confirmed.task, item: confirmed.item } };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/wms/picking-tasks/:id/complete", requireAnyAdminPermission(["orders.advance_stage", "shipping.update_status"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const actorProfileId = getUserPermissionProfileId(res.locals.user as DatabaseShape["users"][number]);
  const result = await runSerializedMutation("admin.wms.complete_task", () => {
    const db = readDb();
    const completed = completePickingTask({
      db,
      taskId: String(req.params.id),
      actorId,
      actorName,
      actorProfileId,
      correlationId,
    });
    if (!completed.ok) return { status: 400, payload: buildError(completed.error) };
    writeDb(db);
    return { status: 200, payload: completed.task };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/wms/stock-movements", requireAnyAdminPermission(["catalog.edit", "stock.report_issue"]), async (req, res) => {
  const result = await runSerializedMutation("admin.wms.stock_movement", () => {
    const db = readDb();
    const product = db.products.find((entry) => entry.id === String(req.body?.productId || ""));
    if (!product) return { status: 404, payload: buildError("Produto nao encontrado") };
    const establishmentId = String(req.body?.establishmentId || "est-comercial");
    createStockMovement({
      db,
      product,
      quantity: Number(req.body?.quantity ?? 0),
      establishmentId,
      movementType: String(req.body?.movementType || "ajuste") as "entrada" | "baixa" | "ajuste",
      reason: String(req.body?.reason || "Ajuste operacional WMS"),
    });
    writeDb(db);
    return { status: 201, payload: { ok: true } };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/customer-center/overview", requireAdminModule("customers", "view"), (_req, res) => {
  const db = readDb();
  const profiles = db.customerProfiles;
  const returns = listAdminReturnRequests(db);
  const tickets = listAdminSupportTickets(db);

  res.json({
    profiles: {
      total: profiles.length,
      business: profiles.filter((profile) => profile.customerType === "business").length,
      pro: profiles.filter((profile) => profile.customerType === "pro").length,
      retail: profiles.filter((profile) => profile.customerType === "retail").length,
    },
    returns: returns.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tickets: tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
});

app.get("/api/admin/customer-center/returns", requireAdminModule("customers", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminReturnRequests(db));
});

app.get("/api/admin/customer-center/tickets", requireAdminModule("customers", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminSupportTickets(db));
});

app.patch("/api/admin/customer-center/returns/:id", requireAdminModule("customers", "limited"), (req, res) => {
  void runSerializedMutation("admin.customer_center.return_status", () => {
    const db = readDb();
    const actor = res.locals.user as { id: string; email: string; user_metadata?: { full_name?: string } };
    const mutation = applyAdminReturnStatusUpdate({
      db,
      returnId: String(req.params.id),
      nextStatus: String(req.body?.status || "") as never,
      actorId: actor?.id ?? null,
      actorName: actor?.user_metadata?.full_name || actor?.email || "admin",
    });

    if (!mutation.ok) {
      return mutation;
    }

    writeDb(db);
    incrementBusinessMetric("customer_center.return_status_updated");
    return mutation;
  }).then((mutation) => {
    if (!mutation.ok) {
      res.status(mutation.error === "Solicitacao de devolucao nao encontrada" ? 404 : 400).json({ error: mutation.error });
      return;
    }
    res.json(mutation.request);
  }).catch(() => {
    res.status(500).json(buildError("Falha ao atualizar devolucao"));
  });
});

app.patch("/api/admin/customer-center/tickets/:id", requireAdminModule("customers", "limited"), (req, res) => {
  void runSerializedMutation("admin.customer_center.ticket_status", () => {
    const db = readDb();
    const actor = res.locals.user as { id: string; email: string; user_metadata?: { full_name?: string } };
    const mutation = applyAdminTicketStatusUpdate({
      db,
      ticketId: String(req.params.id),
      nextStatus: String(req.body?.status || "") as never,
      actorId: actor?.id ?? null,
      actorName: actor?.user_metadata?.full_name || actor?.email || "admin",
    });

    if (!mutation.ok) {
      return mutation;
    }

    writeDb(db);
    incrementBusinessMetric("customer_center.ticket_status_updated");
    return mutation;
  }).then((mutation) => {
    if (!mutation.ok) {
      res.status(mutation.error === "Ticket nao encontrado" ? 404 : 400).json({ error: mutation.error });
      return;
    }
    res.json(mutation.ticket);
  }).catch(() => {
    res.status(500).json(buildError("Falha ao atualizar ticket"));
  });
});

app.get("/api/admin/permissions/overview", requireAdmin, (_req, res) => {
  res.json(getPermissionProfiles());
});

app.get("/api/admin/roles", requireAdminPermission("roles.manage"), (_req, res) => {
  res.json(getPermissionProfiles());
});

app.delete("/api/admin/roles/:id", requireAdminPermission("roles.manage"), (req, res) => {
  const db = readDb();
  const actor = res.locals.user as AdminManagedUser;
  createAdminAuditEvent(db, req, {
    eventType: "admin.role_delete_denied",
    actor,
    entity: "admin_role",
    entityId: String(req.params.id),
    payload: { reason: "system_roles_are_not_deletable" },
  });
  writeDb(db);
  res.status(405).json(buildError("Perfis de sistema nao podem ser excluidos pelo painel"));
});

app.get("/api/admin/users", requireAdminPermission("users.manage"), (_req, res) => {
  const db = readDb();
  res.json(db.users.filter((user) => user.role === "admin").map(buildAdminUserView));
});

app.post("/api/admin/users", requireAdminPermission("users.manage"), async (req, res) => {
  const actor = res.locals.user as AdminManagedUser;
  const body = req.body as {
    name?: string;
    email?: string;
    password?: string;
    profileId?: string;
    jobTitle?: string;
    storeId?: string | null;
    storeName?: string | null;
    isActive?: boolean;
  };

  if (!isNonEmptyString(body.name) || body.name.trim().length < 3) {
    res.status(400).json(buildError("Informe o nome do usuario administrativo"));
    return;
  }
  if (!isNonEmptyString(body.email) || !isValidEmail(body.email)) {
    res.status(400).json(buildError("Informe um e-mail valido"));
    return;
  }
  if (!isNonEmptyString(body.password) || !isStrongPassword(body.password)) {
    res.status(400).json(buildError(`A senha deve ter pelo menos ${appConfig.auth.passwordMinLength} caracteres`));
    return;
  }

  const profile = requireValidAdminProfile(body.profileId);
  if (!profile || !profile.isActive) {
    res.status(400).json(buildError("Perfil administrativo invalido"));
    return;
  }
  if (getPermissionProfile(getUserPermissionProfileId(actor)).slug !== "admin_master" && getPermissionProfile(getUserPermissionProfileId(actor)).level <= profile.level) {
    res.status(403).json(buildError("Nao e permitido criar usuario com nivel igual ou superior ao seu"));
    return;
  }

  const result = await runSerializedMutation("admin.users.create", () => {
    const db = readDb();
    const normalizedEmail = normalizeEmail(body.email!);
    if (db.users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
      return { status: 400, payload: buildError("E-mail ja cadastrado") };
    }

    const now = new Date().toISOString();
    const hashed = hashPassword(body.password!.trim());
    const user: AdminManagedUser = {
      id: createId(),
      email: normalizedEmail,
      password_hash: hashed.hash,
      password_salt: hashed.salt,
      role: "admin",
      is_active: body.isActive !== false,
      user_metadata: {
        full_name: body.name!.trim(),
        store_id: body.storeId ?? "garanhuns",
        store_name: body.storeName ?? "Showroom Garanhuns",
        can_start_assisted_sale: profile.level >= 50,
        permission_profile_id: profile.slug,
        job_title: body.jobTitle?.trim() || profile.name,
      },
      session_token: null,
      session_expires_at: null,
      session_persistent: true,
      created_at: now,
      updated_at: now,
      last_login_at: null,
    };
    db.users.push(user);
    createAdminAuditEvent(db, req, {
      eventType: "admin.user_created",
      actor,
      entity: "admin_user",
      entityId: user.id,
      newValue: buildAdminUserView(user),
    });
    writeDb(db);
    return { status: 201, payload: buildAdminUserView(user) };
  });

  res.status(result.status).json(result.payload);
});

app.patch("/api/admin/users/:id", requireAdminPermission("users.manage"), async (req, res) => {
  const actor = res.locals.user as AdminManagedUser;
  const body = req.body as {
    name?: string;
    email?: string;
    password?: string;
    profileId?: string;
    jobTitle?: string | null;
    storeId?: string | null;
    storeName?: string | null;
    isActive?: boolean;
  };

  const result = await runSerializedMutation("admin.users.update", () => {
    const db = readDb();
    const target = db.users.find((user) => user.id === String(req.params.id) && user.role === "admin");
    if (!target) return { status: 404, payload: buildError("Usuario administrativo nao encontrado") };

    const nextProfile = typeof body.profileId === "string" ? requireValidAdminProfile(body.profileId) : null;
    if (typeof body.profileId === "string" && !nextProfile) {
      return { status: 400, payload: buildError("Perfil administrativo invalido") };
    }
    if (!canManageAdminUser(actor, target, nextProfile?.slug ?? undefined)) {
      return { status: 403, payload: buildError("Nao e permitido gerenciar usuario de nivel igual ou superior") };
    }
    if (target.id === actor.id && nextProfile && getPermissionProfile(getUserPermissionProfileId(actor)).level < nextProfile.level) {
      return { status: 403, payload: buildError("Nao e permitido elevar o proprio privilegio") };
    }

    const previousValue = buildAdminUserView(target);
    const currentProfile = getPermissionProfile(getUserPermissionProfileId(target));
    const nextActive = typeof body.isActive === "boolean" ? body.isActive : target.is_active !== false;
    const nextProfileForLastMasterCheck = nextProfile ?? currentProfile;
    if ((target.is_active !== false && !nextActive && currentProfile.slug === "admin_master") || (currentProfile.slug === "admin_master" && nextProfileForLastMasterCheck.slug !== "admin_master")) {
      if (countActiveAdminMasters(db) <= 1) {
        return { status: 400, payload: buildError("Nao e permitido desativar ou rebaixar o ultimo Admin Master ativo") };
      }
    }

    if (typeof body.name === "string" && body.name.trim().length >= 3) target.user_metadata.full_name = body.name.trim();
    if (typeof body.email === "string") {
      if (!isValidEmail(body.email)) return { status: 400, payload: buildError("Informe um e-mail valido") };
      const normalizedEmail = normalizeEmail(body.email);
      if (db.users.some((user) => user.id !== target.id && user.email.toLowerCase() === normalizedEmail)) {
        return { status: 400, payload: buildError("E-mail ja cadastrado") };
      }
      target.email = normalizedEmail;
    }
    if (typeof body.password === "string" && body.password.trim()) {
      if (!isStrongPassword(body.password)) return { status: 400, payload: buildError(`A senha deve ter pelo menos ${appConfig.auth.passwordMinLength} caracteres`) };
      const hashed = hashPassword(body.password.trim());
      target.password_hash = hashed.hash;
      target.password_salt = hashed.salt;
      target.session_token = null;
      target.session_expires_at = null;
    }
    if (nextProfile) {
      target.user_metadata.permission_profile_id = nextProfile.slug;
      target.user_metadata.can_start_assisted_sale = nextProfile.level >= 50;
    }
    if (typeof body.jobTitle !== "undefined") target.user_metadata.job_title = body.jobTitle?.trim() || null;
    if (typeof body.storeId !== "undefined") target.user_metadata.store_id = body.storeId;
    if (typeof body.storeName !== "undefined") target.user_metadata.store_name = body.storeName;
    target.is_active = nextActive;
    if (!nextActive) {
      target.session_token = null;
      target.session_expires_at = null;
    }
    target.updated_at = new Date().toISOString();

    createAdminAuditEvent(db, req, {
      eventType: "admin.user_updated",
      actor,
      entity: "admin_user",
      entityId: target.id,
      previousValue,
      newValue: buildAdminUserView(target),
    });
    writeDb(db);
    return { status: 200, payload: buildAdminUserView(target) };
  });

  res.status(result.status).json(result.payload);
});

app.get("/api/admin/audit-logs", requireAnyAdminPermission(["audit.view", "audit.operation_view"]), (req, res) => {
  const db = readDb();
  const actorId = typeof req.query.actorId === "string" ? req.query.actorId : null;
  const action = typeof req.query.action === "string" ? req.query.action : null;
  const entity = typeof req.query.entity === "string" ? req.query.entity : null;
  const actor = res.locals.user as AdminManagedUser;
  const canViewAllAudit = canAdminPerform(getUserPermissionProfileId(actor), "audit.view");
  const logs = db.auditLogs
    .filter((entry) => !actorId || entry.actor_id === actorId)
    .filter((entry) => !action || entry.event_type.includes(action))
    .filter((entry) => !entity || entry.payload?.entity === entity)
    .filter((entry) => canViewAllAudit || entry.event_type.startsWith("order.") || entry.event_type.startsWith("admin.permission_denied"))
    .slice(0, 250);
  res.json(logs);
});

app.delete("/api/admin/audit-logs/:id", requireAdminPermission("audit.view"), (req, res) => {
  const db = readDb();
  const actor = res.locals.user as AdminManagedUser;
  createAdminAuditEvent(db, req, {
    eventType: "admin.audit_delete_denied",
    actor,
    entity: "audit_log",
    entityId: String(req.params.id),
    payload: { reason: "audit_logs_are_immutable" },
  });
  writeDb(db);
  res.status(405).json(buildError("Logs de auditoria sao imutaveis e nao podem ser excluidos"));
});

app.get("/api/public/theme/active", (_req, res) => {
  const db = readDb();
  res.json(getPublicMarketingState(db).theme);
});

app.get("/api/public/campaigns/active", (_req, res) => {
  const db = readDb();
  res.json(getPublicMarketingState(db));
});

app.get("/api/public/banners", (req, res) => {
  const db = readDb();
  const placement = typeof req.query.placement === "string" ? req.query.placement : null;
  const state = getPublicMarketingState(db);
  res.json(placement ? state.banners.filter((banner) => banner.placement === placement) : state.banners);
});

app.get("/api/public/showcases", (_req, res) => {
  const db = readDb();
  res.json(getPublicMarketingState(db).showcases);
});

app.get("/api/public/content/pages/:slug", (req, res) => {
  const db = readDb();
  const page = db.siteContent.pages.find((entry) => entry.slug === req.params.slug && entry.is_published);
  if (!page) {
    res.status(404).json(buildError("Pagina nao encontrada"));
    return;
  }
  res.json(page);
});

app.get("/api/public/campaigns/:slug", (req, res) => {
  const db = readDb();
  const page = getCampaignLandingPageBySlug(db, req.params.slug);
  if (!page) {
    res.status(404).json(buildError("Campanha nao encontrada"));
    return;
  }
  if (!page.is_active_now) {
    res.status(410).json({ ...buildError("Campanha indisponivel ou encerrada"), campaign: page.campaign, fallback: true });
    return;
  }
  res.json(page);
});

app.post("/api/public/marketing-events", rateLimit({ windowMs: 60_000, max: 80, message: "Muitas interacoes de marketing em pouco tempo" }), async (req, res) => {
  const result = await runSerializedMutation("marketing.event.create", () => {
    const db = readDb();
    const event = createMarketingEvent(db, {
      ...(req.body as Partial<DbMarketingEvent>),
      source_path: typeof req.body?.source_path === "string" ? req.body.source_path : req.headers.referer ?? null,
      metadata_json: normalizeJsonRecord(req.body?.metadata_json),
    });
    writeDb(db);
    return { status: 201, payload: event };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/preview", requireAdminModule("marketing", "view"), (req, res) => {
  const db = readDb();
  const previewAt = typeof req.query.at === "string" ? req.query.at : null;
  const reference = previewAt ? new Date(previewAt) : new Date();
  if (Number.isNaN(reference.getTime())) {
    res.status(400).json(buildError("Parametro at invalido para preview de campanha."));
    return;
  }
  res.json({
    preview_at: reference.toISOString(),
    state: getPublicMarketingState(db, reference),
    overview: getMarketingOverview(db, reference),
  });
});

app.get("/api/admin/marketing/calendar", requireAdminModule("marketing", "view"), (_req, res) => {
  const db = readDb();
  res.json({
    themes: db.ecommerceThemes,
    campaigns: db.marketingCampaigns,
    banners: db.marketingBanners,
    landing_pages: db.campaignLandingPages,
    assets: db.marketingAssets,
    coupons: db.coupons,
    readiness: getMarketingReadiness(db),
  });
});

app.get("/api/admin/marketing/campaign-readiness", requireAdminModule("marketing", "view"), (_req, res) => {
  const db = readDb();
  res.json(getCampaignPublicationReadiness(db));
});

app.get("/api/admin/marketing/themes", requireAdminModule("marketing", "view"), (req, res) => {
  const db = readDb();
  res.json(db.ecommerceThemes.slice(0, getListLimit(req)));
});

app.post("/api/admin/marketing/themes", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.theme.create", () => {
    const db = readDb();
    const name = String(req.body?.name || "Novo tema");
    const body: Partial<DbEcommerceTheme> = {
      name,
      slug: normalizeMarketingSlug(req.body?.slug, name),
      description: req.body?.description ?? null,
      type: req.body?.type || "monthly",
      status: normalizeLifecycleStatus(req.body?.status) as DbEcommerceTheme["status"],
      priority: Number(req.body?.priority ?? 10),
      starts_at: req.body?.starts_at ?? null,
      ends_at: req.body?.ends_at ?? null,
      timezone: req.body?.timezone || "America/Fortaleza",
      color_primary: req.body?.color_primary || "#b91c1c",
      color_secondary: req.body?.color_secondary || "#facc15",
      color_accent: req.body?.color_accent || "#111827",
      background_color: req.body?.background_color || "#ffffff",
      text_color: req.body?.text_color || "#111827",
      button_style: req.body?.button_style || "solid",
      badge_style: req.body?.badge_style || "standard",
      desktop_hero_image: req.body?.desktop_hero_image ?? null,
      mobile_hero_image: req.body?.mobile_hero_image ?? null,
      background_image: req.body?.background_image ?? null,
      logo_variant: req.body?.logo_variant ?? null,
      headline: req.body?.headline || name,
      subheadline: req.body?.subheadline ?? null,
      cta_label: req.body?.cta_label || "Ver ofertas",
      cta_url: req.body?.cta_url || "/produtos",
      whatsapp_message: req.body?.whatsapp_message ?? null,
      seo_title: req.body?.seo_title ?? null,
      seo_description: req.body?.seo_description ?? null,
      seo_keywords: normalizeStringArray(req.body?.seo_keywords),
      metadata_json: normalizeJsonRecord(req.body?.metadata_json),
      created_by: context.actorId,
      updated_by: context.actorId,
      approved_by: null,
      published_at: null,
    };
    const item = createOrUpdateMarketingEntity(db, db.ecommerceThemes, body, "theme", context);
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/themes/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.theme.update", () => {
    const db = readDb();
    const item = createOrUpdateMarketingEntity(db, db.ecommerceThemes, req.body as Partial<DbEcommerceTheme>, "theme", context, String(req.params.id));
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/campaigns", requireAdminModule("marketing", "view"), (req, res) => {
  const db = readDb();
  res.json(db.marketingCampaigns.slice(0, getListLimit(req)));
});

app.post("/api/admin/marketing/campaigns", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.campaign.create", () => {
    const db = readDb();
    const campaign = createMarketingCampaign(db, req.body as Partial<DbMarketingCampaign>, context);
    writeDb(db);
    return { status: 201, payload: campaign };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/campaigns/:id", requireAdminModule("marketing", "view"), (req, res) => {
  const db = readDb();
  const campaign = db.marketingCampaigns.find((entry) => entry.id === String(req.params.id));
  if (!campaign) {
    res.status(404).json(buildError("Campanha nao encontrada"));
    return;
  }
  res.json(campaign);
});

app.put("/api/admin/marketing/campaigns/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.campaign.update", () => {
    const db = readDb();
    const campaign = updateMarketingCampaign(db, String(req.params.id), req.body as Partial<DbMarketingCampaign>, context);
    writeDb(db);
    return { status: 200, payload: campaign };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/marketing/campaigns/:id/duplicate", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.campaign.duplicate", () => {
    const db = readDb();
    const campaign = duplicateMarketingCampaign(db, String(req.params.id), context);
    writeDb(db);
    return { status: 201, payload: campaign };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

for (const [action, status] of [
  ["publish", "active"],
  ["pause", "paused"],
  ["end", "ended"],
] as const) {
  app.post(`/api/admin/marketing/campaigns/:id/${action}`, requireAdminModule("marketing", "limited"), async (req, res) => {
    const context = getMarketingMutationContext(res);
    const result = await runSerializedMutation(`admin.marketing.campaign.${action}`, () => {
      const db = readDb();
      const campaign = setMarketingCampaignStatus(db, String(req.params.id), status, context);
      writeDb(db);
      return { status: 200, payload: campaign };
    }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
    res.status(result.status).json(result.payload);
  });
}

app.get("/api/admin/marketing/banners", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().marketingBanners);
});

app.post("/api/admin/marketing/banners", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.banner.create", () => {
    const db = readDb();
    const name = String(req.body?.name || "Novo banner");
    const body: Partial<DbMarketingBanner> = {
      name,
      slug: normalizeMarketingSlug(req.body?.slug, name),
      placement: req.body?.placement || "home_hero",
      status: normalizeLifecycleStatus(req.body?.status) as DbMarketingBanner["status"],
      priority: Number(req.body?.priority ?? 10),
      starts_at: req.body?.starts_at ?? null,
      ends_at: req.body?.ends_at ?? null,
      desktop_image: req.body?.desktop_image ?? null,
      mobile_image: req.body?.mobile_image ?? null,
      alt_text: req.body?.alt_text ?? null,
      title: req.body?.title ?? name,
      subtitle: req.body?.subtitle ?? null,
      cta_label: req.body?.cta_label ?? null,
      cta_url: req.body?.cta_url ?? null,
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      product_id: req.body?.product_id ?? null,
      category_id: req.body?.category_id ?? null,
      open_in_new_tab: Boolean(req.body?.open_in_new_tab),
      tracking_key: req.body?.tracking_key ?? null,
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.marketingBanners, body, "banner", context);
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/banners/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.banner.update", () => {
    const db = readDb();
    const item = createOrUpdateMarketingEntity(db, db.marketingBanners, req.body as Partial<DbMarketingBanner>, "banner", context, String(req.params.id));
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.delete("/api/admin/marketing/banners/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const result = await runSerializedMutation("admin.marketing.banner.delete", () => {
    const db = readDb();
    const index = db.marketingBanners.findIndex((entry) => entry.id === String(req.params.id));
    if (index === -1) return { status: 404, payload: buildError("Banner nao encontrado.") };
    db.marketingBanners.splice(index, 1);
    writeDb(db);
    return { status: 204, payload: null };
  });
  if (result.status === 204) {
    res.status(204).end();
    return;
  }
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/cards", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().marketingCards);
});

app.post("/api/admin/marketing/cards", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.card.create", () => {
    const db = readDb();
    const name = String(req.body?.name || "Novo card");
    const body: Partial<DbMarketingCard> = {
      name,
      placement: req.body?.placement || "home",
      status: normalizeLifecycleStatus(req.body?.status) as DbMarketingCard["status"],
      priority: Number(req.body?.priority ?? 10),
      starts_at: req.body?.starts_at ?? null,
      ends_at: req.body?.ends_at ?? null,
      image: req.body?.image ?? null,
      icon: req.body?.icon ?? null,
      title: req.body?.title ?? name,
      subtitle: req.body?.subtitle ?? null,
      cta_label: req.body?.cta_label ?? null,
      cta_url: req.body?.cta_url ?? null,
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      product_id: req.body?.product_id ?? null,
      category_id: req.body?.category_id ?? null,
      background_color: req.body?.background_color ?? null,
      text_color: req.body?.text_color ?? null,
      metadata_json: normalizeJsonRecord(req.body?.metadata_json),
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.marketingCards, body, "card", context);
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/cards/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.card.update", () => {
    const db = readDb();
    const item = createOrUpdateMarketingEntity(db, db.marketingCards, req.body as Partial<DbMarketingCard>, "card", context, String(req.params.id));
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/showcases", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().productShowcases);
});

  app.post("/api/admin/marketing/showcases", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.showcase.create", () => {
    const db = readDb();
    const name = String(req.body?.name || "Nova vitrine");
    const body: Partial<DbProductShowcase> = {
      name,
      slug: normalizeMarketingSlug(req.body?.slug, name),
      description: req.body?.description ?? null,
      type: req.body?.type || "manual",
      status: normalizeLifecycleStatus(req.body?.status) as DbProductShowcase["status"],
      placement: req.body?.placement || "home",
      priority: Number(req.body?.priority ?? 10),
      starts_at: req.body?.starts_at ?? null,
      ends_at: req.body?.ends_at ?? null,
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      title: req.body?.title ?? name,
      subtitle: req.body?.subtitle ?? null,
      cta_label: req.body?.cta_label ?? null,
      cta_url: req.body?.cta_url ?? null,
      rule_type: req.body?.rule_type || "manual",
      rules_json: normalizeJsonRecord(req.body?.rules_json),
      product_ids_json: normalizeStringArray(req.body?.product_ids_json),
      category_ids_json: normalizeStringArray(req.body?.category_ids_json),
      max_items: Number(req.body?.max_items ?? 8),
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.productShowcases, body, "showcase", context);
    if (item.status === "active") {
      const readiness = getCampaignPublicationReadiness(db);
      const row = readiness.showcases.find((entry) => entry.id === item.id);
      if (row && row.blockers > 0) {
        return { status: 400, payload: buildError(`Vitrine bloqueada para ativacao: ${row.top_issues[0] || "mix sem produto elegivel para campanha."}`) };
      }
    }
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/showcases/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.showcase.update", () => {
    const db = readDb();
    const item = createOrUpdateMarketingEntity(db, db.productShowcases, req.body as Partial<DbProductShowcase>, "showcase", context, String(req.params.id));
    if (item.status === "active") {
      const readiness = getCampaignPublicationReadiness(db);
      const row = readiness.showcases.find((entry) => entry.id === item.id);
      if (row && row.blockers > 0) {
        return { status: 400, payload: buildError(`Vitrine bloqueada para ativacao: ${row.top_issues[0] || "mix sem produto elegivel para campanha."}`) };
      }
    }
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/landing-pages", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().campaignLandingPages);
});

app.post("/api/admin/marketing/landing-pages", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.landing_page.create", () => {
    const db = readDb();
    const title = String(req.body?.title || "Nova landing page");
    const body: Partial<DbCampaignLandingPage> = {
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      slug: normalizeMarketingSlug(req.body?.slug, title),
      title,
      subtitle: req.body?.subtitle ?? null,
      hero_desktop_image: req.body?.hero_desktop_image ?? null,
      hero_mobile_image: req.body?.hero_mobile_image ?? null,
      body_json: normalizeJsonRecord(req.body?.body_json),
      seo_title: req.body?.seo_title ?? title,
      seo_description: req.body?.seo_description ?? null,
      seo_keywords: normalizeStringArray(req.body?.seo_keywords),
      faq_json: Array.isArray(req.body?.faq_json) ? req.body.faq_json : [],
      showcase_ids_json: normalizeStringArray(req.body?.showcase_ids_json),
      banner_ids_json: normalizeStringArray(req.body?.banner_ids_json),
      status: normalizeLifecycleStatus(req.body?.status) as DbCampaignLandingPage["status"],
      starts_at: req.body?.starts_at ?? null,
      ends_at: req.body?.ends_at ?? null,
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.campaignLandingPages, body, "landing_page", context);
    if (item.status === "active") {
      const readiness = getCampaignPublicationReadiness(db);
      const row = readiness.landing_pages.find((entry) => entry.id === item.id);
      if (row && row.blockers > 0) {
        return { status: 400, payload: buildError(`Landing page bloqueada para ativacao: ${row.top_issues[0] || "estrutura minima da landing ainda nao esta pronta."}`) };
      }
    }
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/marketing/landing-pages/:id/duplicate", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.landing_page.duplicate", () => {
    const db = readDb();
    const source = db.campaignLandingPages.find((item) => item.id === String(req.params.id));
    if (!source) return { status: 404, payload: buildError("Landing page nao encontrada") };
    const title = String(req.body?.title || `${source.title} - copia`);
    const body: Partial<DbCampaignLandingPage> = {
      ...source,
      id: undefined,
      title,
      slug: normalizeMarketingSlug(req.body?.slug, title),
      status: "draft",
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.campaignLandingPages, body, "landing_page", context);
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/landing-pages/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.landing_page.update", () => {
    const db = readDb();
    const body: Partial<DbCampaignLandingPage> = {
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      slug: req.body?.slug ? String(req.body.slug) : undefined,
      title: req.body?.title ? String(req.body.title) : undefined,
      subtitle: req.body?.subtitle != null ? String(req.body.subtitle) : null,
      hero_desktop_image: req.body?.hero_desktop_image ?? null,
      hero_mobile_image: req.body?.hero_mobile_image ?? null,
      seo_title: req.body?.seo_title != null ? String(req.body.seo_title) : null,
      seo_description: req.body?.seo_description != null ? String(req.body.seo_description) : null,
      starts_at: req.body?.starts_at ?? null,
      ends_at: req.body?.ends_at ?? null,
      body_json: normalizeJsonRecord(req.body?.body_json),
      seo_keywords: normalizeStringArray(req.body?.seo_keywords),
      faq_json: Array.isArray(req.body?.faq_json) ? req.body.faq_json : [],
      showcase_ids_json: normalizeStringArray(req.body?.showcase_ids_json),
      banner_ids_json: normalizeStringArray(req.body?.banner_ids_json),
      status: normalizeLifecycleStatus(req.body?.status) as DbCampaignLandingPage["status"],
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.campaignLandingPages, body, "landing_page", context, String(req.params.id));
    if (item.status === "active") {
      const readiness = getCampaignPublicationReadiness(db);
      const row = readiness.landing_pages.find((entry) => entry.id === item.id);
      if (row && row.blockers > 0) {
        return { status: 400, payload: buildError(`Landing page bloqueada para ativacao: ${row.top_issues[0] || "estrutura minima da landing ainda nao esta pronta."}`) };
      }
    }
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/snippets", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().contentSnippets);
});

app.post("/api/admin/marketing/snippets", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.snippet.create", () => {
    const db = readDb();
    const name = String(req.body?.name || "Novo texto");
    const body: Partial<DbContentSnippet> = {
      key: String(req.body?.key || normalizeMarketingSlug(req.body?.key, name)),
      name,
      type: req.body?.type || "campaign_text",
      content: String(req.body?.content || ""),
      status: normalizeLifecycleStatus(req.body?.status) as DbContentSnippet["status"],
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      product_id: req.body?.product_id ?? null,
      category_id: req.body?.category_id ?? null,
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.contentSnippets, body, "snippet", context);
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/marketing/snippets/:id/duplicate", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.snippet.duplicate", () => {
    const db = readDb();
    const source = db.contentSnippets.find((item) => item.id === String(req.params.id));
    if (!source) return { status: 404, payload: buildError("Texto nao encontrado") };
    const name = String(req.body?.name || `${source.name} - copia`);
    const body: Partial<DbContentSnippet> = {
      ...source,
      id: undefined,
      key: String(req.body?.key || normalizeMarketingSlug(name, name)),
      name,
      status: "draft",
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.contentSnippets, body, "snippet", context);
    writeDb(db);
    return { status: 201, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/snippets/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.snippet.update", () => {
    const db = readDb();
    const body: Partial<DbContentSnippet> = {
      key: req.body?.key ? String(req.body.key) : undefined,
      name: req.body?.name ? String(req.body.name) : undefined,
      type: req.body?.type ?? undefined,
      content: req.body?.content !== undefined ? String(req.body.content) : undefined,
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      product_id: req.body?.product_id ?? null,
      category_id: req.body?.category_id ?? null,
      status: normalizeLifecycleStatus(req.body?.status) as DbContentSnippet["status"],
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingEntity(db, db.contentSnippets, body, "snippet", context, String(req.params.id));
    writeDb(db);
    return { status: 200, payload: item };
  });
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/reports", requireAdminModule("marketing", "view"), (_req, res) => {
  const db = readDb();
  res.json(getMarketingReports(db));
});

app.get("/api/admin/marketing/reports.csv", requireAdminModule("marketing", "view"), (_req, res) => {
  const db = readDb();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="marketing-reports-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`${getMarketingReportsCsv(db)}\n`);
});

app.get("/api/admin/marketing/assets", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().marketingAssets);
});

app.post("/api/admin/marketing/assets", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.asset.create", () => {
    const db = readDb();
    const body: Partial<DbMarketingAsset> = {
      name: String(req.body?.name || "Novo asset"),
      type: req.body?.type || "image",
      url: String(req.body?.url || ""),
      alt_text: req.body?.alt_text ?? null,
      usage: req.body?.usage || "other",
      status: normalizeLifecycleStatus(req.body?.status) as DbMarketingAsset["status"],
      campaign_id: req.body?.campaign_id ?? null,
      theme_id: req.body?.theme_id ?? null,
      metadata_json: normalizeJsonRecord(req.body?.metadata_json),
      created_by: context.actorId,
      updated_by: context.actorId,
    };
    const item = createOrUpdateMarketingAsset(db, body, context);
    writeDb(db);
    return { status: 201, payload: item };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/assets/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.asset.update", () => {
    const db = readDb();
    const item = createOrUpdateMarketingAsset(db, req.body as Partial<DbMarketingAsset>, context, String(req.params.id));
    writeDb(db);
    return { status: 200, payload: item };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/marketing/coupons", requireAdminModule("marketing", "view"), (_req, res) => {
  res.json(readDb().coupons);
});

app.post("/api/admin/marketing/coupons", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.coupon.create", () => {
    const db = readDb();
    const coupon = createOrUpdateMarketingCoupon(db, req.body as Partial<DbCoupon>, context);
    writeDb(db);
    return { status: 201, payload: coupon };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.put("/api/admin/marketing/coupons/:id", requireAdminModule("marketing", "limited"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.marketing.coupon.update", () => {
    const db = readDb();
    const coupon = createOrUpdateMarketingCoupon(db, req.body as Partial<DbCoupon>, context, String(req.params.id));
    writeDb(db);
    return { status: 200, payload: coupon };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/integrations/overview", requireAdminModule("integrations", "view"), async (_req, res) => {
  res.json(await getIntegrationOverview());
});

app.get("/api/admin/integrations", requireAdminModule("integrations", "view"), (_req, res) => {
  const db = readDb();
  res.json(listIntegrationProviders(db));
});

app.get("/api/admin/integrations/readiness", requireAdminModule("integrations", "view"), (_req, res) => {
  const db = readDb();
  res.json(getIntegrationReadiness(db));
});

app.get("/api/admin/integrations/:key", requireAdminModule("integrations", "view"), (req, res) => {
  const db = readDb();
  const detail = getIntegrationProviderDetail(db, String(req.params.key));
  if (!detail) {
    res.status(404).json(buildError("Integracao nao encontrada"));
    return;
  }
  res.json(detail);
});

app.put("/api/admin/integrations/:key", requireAdminModule("integrations", "full"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.integration.provider.update", () => {
    const db = readDb();
    const provider = db.integrationProviders.find((entry) => entry.key === String(req.params.key));
    if (!provider) return { status: 404, payload: buildError("Integracao nao encontrada") };
    if (req.body?.status === "production") {
      const updated = requestIntegrationProductionActivation(db, {
        providerKey: String(req.params.key),
        publicConfig: normalizeJsonRecord(req.body?.public_config_json ?? provider.public_config_json),
        reason: String(req.body?.production_activation_reason || req.body?.public_config_json?.production_activation_reason || ""),
        ...context,
      });
      writeDb(db);
      return { status: 202, payload: updated };
    }
    const previous = { ...provider };
    Object.assign(provider, {
      status: req.body?.status || provider.status,
      is_configured: typeof req.body?.is_configured === "boolean" ? req.body.is_configured : provider.is_configured,
      public_config_json: normalizeJsonRecord(req.body?.public_config_json ?? provider.public_config_json),
      updated_by: context.actorId,
      updated_at: new Date().toISOString(),
    } satisfies Partial<DbIntegrationProvider>);
    createAuditEvent(db, {
      eventType: "integration.provider_updated",
      correlationId: context.correlationId,
      actorId: context.actorId,
      actorName: context.actorName,
      sourceChannel: "integration",
      previousValue: previous,
      newValue: { ...provider, masked_secrets_json: provider.masked_secrets_json },
      payload: { entity: "integration_provider", entity_id: provider.id, key: provider.key },
    });
    writeDb(db);
    return { status: 200, payload: listIntegrationProviders(db).find((entry) => entry.key === provider.key) };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/integrations/:key/production-approval", requireAdminModule("integrations", "full"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.integration.production.approve", () => {
    const db = readDb();
    const provider = approveIntegrationProductionActivation(db, {
      providerKey: String(req.params.key),
      ...context,
    });
    writeDb(db);
    return { status: 200, payload: provider };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/integrations/:key/test", requireAdminModule("integrations", "view"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.integration.provider.test", () => {
    const db = readDb();
    const provider = testIntegrationProvider(db, String(req.params.key), context);
    writeDb(db);
    return { status: 200, payload: provider };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/integrations/:key/secrets", requireAdminModule("integrations", "full"), async (req, res) => {
  const context = getMarketingMutationContext(res);
  const result = await runSerializedMutation("admin.integration.secret.save", () => {
    const db = readDb();
    const secret = saveIntegrationSecret(db, {
      providerKey: String(req.params.key),
      secretKey: String(req.body?.secret_key || ""),
      value: String(req.body?.value || ""),
      environment: req.body?.environment || "sandbox",
      ...context,
    });
    writeDb(db);
    return { status: 201, payload: secret };
  }).catch((error: Error) => ({ status: 400, payload: buildError(error.message) }));
  res.status(result.status).json(result.payload);
});

app.get("/api/admin/integrations/:key/logs", requireAdminModule("integrations", "view"), (req, res) => {
  const db = readDb();
  const detail = getIntegrationProviderDetail(db, String(req.params.key));
  if (!detail) {
    res.status(404).json(buildError("Integracao nao encontrada"));
    return;
  }
  res.json(detail.logs);
});

app.get("/api/admin/go-live/readiness", requireAdminModule("integrations", "view"), (_req, res) => {
  res.json(getGoLiveReadinessReport());
});

app.get("/api/admin/phase1/readiness", requireAdminModule("integrations", "view"), async (_req, res) => {
  res.json(await getPhase1ReadinessReport());
});

app.get("/api/admin/phase2/readiness", requireAdminModule("integrations", "view"), (_req, res) => {
  res.json(getPhase2ReadinessReport());
});

app.get("/api/admin/release/readiness", requireAdminModule("integrations", "view"), async (_req, res) => {
  const db = readDb();
  res.json(await getReleaseReadinessReport(db));
});

app.get("/api/admin/homologation/pack", requireAdminModule("integrations", "view"), async (_req, res) => {
  const db = readDb();
  res.json(await buildHomologationPack(db));
});

app.get("/api/admin/homologation/evidence-status", requireAdminModule("integrations", "view"), (_req, res) => {
  res.json(getAdminHomologationEvidenceStatus());
});

app.get("/api/admin/governance/control-center", requireAdminModule("integrations", "view"), (_req, res) => {
  res.json(buildAdminControlCenter());
});

app.get("/api/admin/governance/control-center/export", requireAdminModule("integrations", "view"), (req, res) => {
  const report = buildAdminControlCenter();
  const format = String(req.query.format || "json").toLowerCase();
  if (format === "md" || format === "markdown") {
    res.type("text/markdown").send(renderAdminControlCenterMarkdown(report));
    return;
  }
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="admin-control-center-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`${renderAdminControlCenterCsv(report)}\n`);
    return;
  }
  res.json(report);
});

app.get("/api/admin/governance/programmatic-completion", requireAdminModule("integrations", "view"), (_req, res) => {
  res.json(getAdminProgrammaticCompletion());
});

app.get("/api/admin/governance/programmatic-completion/export", requireAdminModule("integrations", "view"), (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  if (format === "md" || format === "markdown") {
    res.type("text/markdown").send(renderAdminProgrammaticCompletionMarkdown());
    return;
  }
  res.json(getAdminProgrammaticCompletion());
});

app.get("/api/admin/security/readiness", requireAdminModule("integrations", "view"), (_req, res) => {
  res.json(getSecurityReadinessReport());
});

app.get("/api/admin/operations/readiness", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(getOperationReadinessReport(db));
});

app.get("/api/admin/freight/catalog-readiness", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(getFreightCatalogReadinessReport(db));
});

app.get("/api/admin/operations/remediation", requireAdminModule("orders", "view"), (_req, res) => {
  const db = readDb();
  res.json(
    applyOperationAutoRemediation(db, {
      dryRun: true,
      actorName: "admin-remediation-preview",
    }),
  );
});

app.post("/api/admin/operations/remediation", requireAdminModule("orders", "limited"), (req, res) => {
  void runSerializedMutation("admin.operations.remediation", () => {
    const db = readDb();
    const actor = res.locals.user as { id: string; email: string; user_metadata?: { full_name?: string } };
    const remediation = applyOperationAutoRemediation(db, {
      dryRun: false,
      actorId: actor?.id ?? null,
      actorName: actor?.user_metadata?.full_name || actor?.email || "admin",
    });

    if (remediation.changed) {
      writeDb(db);
      incrementBusinessMetric("operations.remediation_applied");
    }

    return {
      remediation,
      readiness: getOperationReadinessReport(db),
    };
  })
    .then((payload) => {
      res.json(payload);
    })
    .catch(() => {
      res.status(500).json(buildError("Falha ao aplicar remediacao operacional"));
    });
});

app.get("/api/admin/fiscal/remediation", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json({
    remediation: applyFiscalAutoRemediation(db, {
      dryRun: true,
      actorName: "admin-fiscal-remediation-preview",
      fallbackCorrelationId: res.locals.requestId ?? createId(),
    }),
    readiness: getAdminFiscalReadiness(db),
    workboard: getAdminFiscalWorkboard(db),
  });
});

app.post("/api/admin/fiscal/remediation", requireAdminModule("fiscal", "limited"), (_req, res) => {
  void runSerializedMutation("admin.fiscal.remediation", () => {
    const db = readDb();
    const actor = res.locals.user as { id: string; email: string; user_metadata?: { full_name?: string } };
    const remediation = applyFiscalAutoRemediation(db, {
      dryRun: false,
      actorId: actor?.id ?? null,
      actorName: actor?.user_metadata?.full_name || actor?.email || "admin",
      fallbackCorrelationId: res.locals.requestId ?? createId(),
    });

    if (remediation.changed) {
      writeDb(db);
      incrementBusinessMetric("fiscal.remediation_applied");
    }

    return {
      remediation,
      readiness: getAdminFiscalReadiness(db),
      workboard: getAdminFiscalWorkboard(db),
    };
  })
    .then((payload) => {
      res.json(payload);
    })
    .catch(() => {
      res.status(500).json(buildError("Falha ao aplicar remediacao fiscal"));
    });
});

app.get("/api/admin/fiscal/documents/remediation", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json({
    remediation: applyFiscalDocumentAutoRemediation(db, {
      dryRun: true,
      actorName: "admin-fiscal-document-remediation-preview",
      fallbackCorrelationId: res.locals.requestId ?? createId(),
    }),
    readiness: getAdminFiscalReadiness(db, { scope: "minimal-go-live" }),
    workboard: getAdminFiscalWorkboard(db, { scope: "minimal-go-live" }),
  });
});

app.post("/api/admin/fiscal/documents/remediation", requireAdminModule("fiscal", "limited"), (_req, res) => {
  void runSerializedMutation("admin.fiscal.documents.remediation", () => {
    const db = readDb();
    const actor = res.locals.user as { id: string; email: string; user_metadata?: { full_name?: string } };
    const remediation = applyFiscalDocumentAutoRemediation(db, {
      dryRun: false,
      actorId: actor?.id ?? null,
      actorName: actor?.user_metadata?.full_name || actor?.email || "admin",
      fallbackCorrelationId: res.locals.requestId ?? createId(),
    });

    if (remediation.changed) {
      writeDb(db);
      incrementBusinessMetric("fiscal.document_remediation_applied");
    }

    return {
      remediation,
      readiness: getAdminFiscalReadiness(db, { scope: "minimal-go-live" }),
      workboard: getAdminFiscalWorkboard(db, { scope: "minimal-go-live" }),
    };
  })
    .then((payload) => {
      res.json(payload);
    })
    .catch(() => {
      res.status(500).json(buildError("Falha ao aplicar remediacao fiscal de documentos"));
    });
});

app.get("/api/admin/customers", requireAdminModule("customers", "view"), (_req, res) => {
  const db = readDb();
  const customers = db.customerProfiles
    .map((profile) => {
      const orders = db.orders.filter((order) => order.user_id === profile.user_id || order.customer_email === profile.email);
      const quotes = db.quotes.filter((quote) => quote.customer_email === profile.email);
      const user = db.users.find((entry) => entry.id === profile.user_id) ?? null;
      return {
        user_id: profile.user_id,
        full_name: profile.fullName || user?.user_metadata?.full_name || profile.email,
        email: profile.email,
        phone: profile.phone,
        customer_type: profile.customerType,
        customer_origin: profile.customerOrigin,
        preferred_channel: profile.preferredChannel,
        preferred_store_name: profile.preferredStoreName ?? null,
        allow_promotions: profile.allowPromotions,
        orders_count: orders.length,
        quotes_count: quotes.length,
        total_spent: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total), 0),
        last_order_at: orders.length > 0 ? orders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at : null,
        updated_at: profile.updated_at,
      };
    })
    .sort((a, b) => (b.last_order_at || b.updated_at).localeCompare(a.last_order_at || a.updated_at));

  res.json(customers);
});

app.get("/api/admin/leads", requireAdminModule("customers", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminLeads(db));
});

app.post("/api/admin/leads", requireAdminModule("customers", "limited"), (req, res) => {
  void handleAdminCreateLead(req, res);
});

app.patch("/api/admin/leads/:id", requireAdminModule("customers", "limited"), (req, res) => {
  void handleAdminUpdateLead(req, res);
});

app.get("/api/admin/payments", requireAdminModule("finance", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminPayments(db));
});

app.post("/api/admin/orders/:id/payment", requireAnyAdminPermission(["payments.confirm", "payments.reject"]), async (req, res) => {
  await handleOrderPaymentMutation(req, res, String(req.params.id), req.body as { action?: "initiate" | "approve" | "fail"; paymentMethod?: PaymentMethod; paymentReference?: string | null; trackingToken?: string | null });
});

app.get("/api/admin/content", requireAdminModule("content", "view"), (_req, res) => {
  const db = readDb();
  res.json(db.siteContent);
});

app.put("/api/admin/content", requireAnyAdminPermission(["pages.edit", "banners.edit", "banners.manage"]), (req, res) => {
  void handleAdminUpdateContent(req, res);
});

app.get("/api/admin/settings/commercial", requireAdminModule("integrations", "view"), (_req, res) => {
  const db = readDb();
  res.json(db.commercialSettings);
});

app.put("/api/admin/settings/commercial", requireAdminPermission("settings.configure"), (req, res) => {
  void handleAdminUpdateCommercialSettings(req, res);
});

app.get("/api/admin/orders", requireAdminModule("orders", "view"), (req, res) => {
  const db = readDb();
  res.json(listAdminOrders(db));
});

app.get("/api/admin/orders/:id/operation-state", requireAdminModule("orders", "view"), (req, res) => {
  const db = readDb();
  const state = getOrderOperationState(db, String(req.params.id));
  if (!state) {
    res.status(404).json(buildError("Pedido nao encontrado"));
    return;
  }
  res.json(state);
});

app.get("/api/admin/reconciliation/summary", requireAdminModule("finance", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminReconciliationSummary(db));
});

app.get("/api/admin/reconciliation/daily-report", requireAdminModule("finance", "view"), (req, res) => {
  const db = readDb();
  const days = typeof req.query.days === "string" ? Number(req.query.days) : 1;
  res.json(getAdminReconciliationDailyReport(db, days));
});

app.get("/api/admin/reconciliation/orders/:id", requireAdminModule("finance", "view"), (req, res) => {
  const db = readDb();
  const reconciliation = getAdminOrderReconciliation(db, String(req.params.id));
  if (!reconciliation) {
    res.status(404).json({ error: "Pedido nao encontrado" });
    return;
  }
  res.json(reconciliation);
});

app.patch("/api/admin/orders/:id/status", requireAnyAdminPermission(["orders.update_status", "shipping.update_status", "orders.release_to_picking"]), (req, res) => {
  void handleAdminUpdateOrderStatus(req, res);
});

app.post("/api/admin/orders/:id/assign-owner", requireAnyAdminPermission(["orders.assign_owner", "orders.update_status"]), (req, res) => {
  void handleAdminAssignOrderOwner(req, res);
});

app.post("/api/admin/orders/:id/mark-stuck", requireAnyAdminPermission(["orders.mark_stuck", "orders.update_status", "orders.internal_note", "orders.financial_note", "orders.operational_note", "support.internal_note"]), (req, res) => {
  void handleAdminMarkOrderStuck(req, res);
});

app.post("/api/admin/orders/:id/resolve-stuck", requireAnyAdminPermission(["orders.resolve_stuck", "orders.update_status", "orders.financial_note", "orders.operational_note", "support.internal_note"]), (req, res) => {
  void handleAdminResolveOrderStuck(req, res);
});

app.post("/api/admin/orders/:id/advance-stage", requireAnyAdminPermission(["orders.advance_stage", "orders.update_status", "orders.release_to_picking", "shipping.update_status"]), (req, res) => {
  void handleAdminAdvanceOrderStage(req, res);
});

app.post("/api/admin/orders/:id/manual-action", requireAnyAdminPermission(["orders.edit", "orders.internal_note", "orders.operational_note", "orders.financial_note", "shipping.add_note", "support.internal_note"]), (req, res) => {
  void handleAdminCreateOrderManualAction(req, res);
});

app.patch("/api/admin/orders/:id/shipment", requireAdminPermission("shipping.update_status"), (req, res) => {
  void handleAdminUpdateOrderShipment(req, res);
});

app.get("/api/admin/products", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminProducts(db));
});

app.post("/api/admin/products", requireAdminPermission("catalog.create"), (req, res) => {
  void handleAdminCreateProduct(req, res);
});

app.patch("/api/admin/products/batch", requireAnyAdminPermission(["catalog.edit", "products.media_manage"]), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.products.batch_update", () => {
    const db = readDb();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => String(id)) : [];
    if (ids.length === 0) return { status: 400, payload: buildError("Informe ao menos um produto.") };
    const patch = (req.body?.patch ?? {}) as { category_id?: string | null; status_product?: DbProduct["status_product"]; is_active?: boolean; price?: number };
    const allowedStatus: DbProduct["status_product"][] = ["active", "inactive", "draft", "archived"];
    if (typeof patch.status_product !== "undefined" && !allowedStatus.includes(patch.status_product)) {
      return { status: 400, payload: buildError("Status invalido.") };
    }
    if (typeof patch.category_id !== "undefined" && patch.category_id !== null && !db.categories.some((category) => category.id === patch.category_id)) {
      return { status: 400, payload: buildError("Categoria nao encontrada.") };
    }
    const updated: string[] = [];
    const skipped: string[] = [];
    for (const id of ids) {
      const product = db.products.find((item) => item.id === id);
      if (!product) {
        skipped.push(id);
        continue;
      }
      const nextIsActive = typeof patch.is_active !== "undefined" ? Boolean(patch.is_active) : product.is_active;
      const nextStatus = typeof patch.status_product !== "undefined" ? patch.status_product : product.status_product;
      const willPublish = nextIsActive && nextStatus === "active";
      const hasRealImage = !isPlaceholderProductImage(product.image_url) || (Array.isArray(product.images) && product.images.some((item) => !isPlaceholderProductImage(item)));
      if (willPublish && !hasRealImage) {
        skipped.push(id);
        continue;
      }
      if (typeof patch.category_id !== "undefined") product.category_id = patch.category_id;
      if (typeof patch.status_product !== "undefined") product.status_product = patch.status_product;
      if (typeof patch.is_active !== "undefined") product.is_active = Boolean(patch.is_active);
      if (typeof patch.price !== "undefined" && Number.isFinite(Number(patch.price))) product.price = Number(patch.price);
      updated.push(id);
    }
    if (updated.length > 0) {
      createAuditEvent(db, {
        eventType: "catalog.product_batch_updated",
        correlationId,
        actorId,
        actorName,
        sourceChannel: "integration",
        payload: { product_ids: updated, patch },
      });
      writeDb(db);
    }
    return { status: 200, payload: { updated_count: updated.length, updated_ids: updated, skipped_ids: skipped } };
  });
  res.status(result.status).json(result.payload);
});

app.patch("/api/admin/products/:id", requireAnyAdminPermission(["catalog.edit", "products.media_manage", "products.seo_edit"]), (req, res) => {
  void handleAdminUpdateProduct(req, res);
});

app.get("/api/admin/categories", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminCategories(db));
});

app.post("/api/admin/categories", requireAnyAdminPermission(["categories.edit", "categories.manage"]), (req, res) => {
  void handleAdminCreateCategory(req, res);
});

app.patch("/api/admin/categories/:id", requireAnyAdminPermission(["categories.edit", "categories.manage"]), (req, res) => {
  void handleAdminUpdateCategory(req, res);
});

app.get("/api/admin/establishments", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json(db.establishments);
});

app.get("/api/admin/fiscal/overview", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAdminFiscalOverview(db));
});

app.get("/api/admin/fiscal/readiness", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  const scope = _req.query.scope === "minimal-go-live" ? "minimal-go-live" : "global";
  res.json(getAdminFiscalReadiness(db, { scope }));
});

app.get("/api/admin/fiscal/workboard", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  const scope = _req.query.scope === "minimal-go-live" ? "minimal-go-live" : "global";
  res.json(getAdminFiscalWorkboard(db, { scope }));
});

app.get("/api/admin/fiscal/ai-assistant/queue", requireAdminModule("fiscal", "view"), (req, res) => {
  const db = readDb();
  const scope = req.query.scope === "global" ? "global" : "minimal-go-live";
  res.json(getFiscalAiQueue(db, { scope }));
});

app.get("/api/admin/ai/usage", requireAdminModule("integrations", "view"), (_req, res) => {
  const db = readDb();
  res.json(getAiUsageOverview(db));
});

app.get("/api/admin/fiscal/ai-assistant/suggestions/:profileId", requireAdminModule("fiscal", "view"), (req, res) => {
  const db = readDb();
  const suggestions = db.fiscalAiSuggestions
    .filter((entry) => entry.fiscal_profile_id === String(req.params.profileId))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  res.json(suggestions);
});

app.post("/api/admin/fiscal/ai-assistant/suggestions/:profileId/generate", requireAdminPermission("fiscal.edit"), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const scope = req.query.scope === "global" || req.body?.scope === "global" ? "global" : "minimal-go-live";
  const result = await runSerializedMutation("admin.fiscal_ai.generate", async () => {
    const db = readDb();
    const generated = await generateFiscalAiSuggestion(db, {
      fiscalProfileId: String(req.params.profileId),
      scope,
      actorId,
      actorName,
      correlationId,
    });
    if (!generated.ok) return { status: 404, payload: buildError(generated.error) };
    writeDb(db);
    return { status: 201, payload: generated.suggestion };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/fiscal/ai-assistant/suggestions/:id/approve", requireAdminPermission("fiscal.edit"), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_ai.approve", () => {
    const db = readDb();
    const approved = approveFiscalAiSuggestion(db, {
      suggestionId: String(req.params.id),
      actorId,
      actorName,
      correlationId,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      fillTemplate: req.body?.manual_fill_template ?? req.body?.fillTemplate ?? undefined,
    });
    if (!approved.ok) return { status: 400, payload: buildError(approved.error) };
    writeDb(db);
    return { status: 200, payload: approved.suggestion };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/fiscal/ai-assistant/suggestions/:id/reject", requireAdminPermission("fiscal.edit"), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_ai.reject", () => {
    const db = readDb();
    const rejected = rejectFiscalAiSuggestion(db, {
      suggestionId: String(req.params.id),
      actorId,
      actorName,
      correlationId,
      reason: typeof req.body?.reason === "string" ? req.body.reason : "",
    });
    if (!rejected.ok) return { status: 400, payload: buildError(rejected.error) };
    writeDb(db);
    return { status: 200, payload: rejected.suggestion };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/fiscal/ai-assistant/export-close-pack", requireAdminPermission("fiscal.edit"), async (req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  const result = await runSerializedMutation("admin.fiscal_ai.export_close_pack", () => {
    const db = readDb();
    const scope = req.body?.scope === "global" ? "global" : "minimal-go-live";
    const pack = exportApprovedFiscalAiClosePack(db, { scope, actorId, actorName, correlationId });
    writeDb(db);
    return { status: 200, payload: pack };
  });
  res.status(result.status).json(result.payload);
});

app.post("/api/admin/fiscal/ncm-cache/refresh", requireAdminPermission("fiscal.edit"), async (_req, res) => {
  const { actorId, actorName, correlationId } = getAdminMutationActor(res);
  try {
    const result = await runSerializedMutation("admin.fiscal_ncm_cache.refresh", async () => {
      const db = readDb();
      const refreshed = await refreshFiscalNcmCache(db, { actorId, actorName, correlationId });
      writeDb(db);
      return { status: 200, payload: refreshed };
    });
    res.status(result.status).json(result.payload);
  } catch (error) {
    res.status(502).json(buildError(error instanceof Error ? error.message : "Falha ao atualizar cache NCM."));
  }
});

app.get("/api/admin/fiscal/enterprise-plan", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json(buildFiscalEnterprisePlan(db));
});

app.get("/api/admin/fiscal/profiles", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminFiscalProfiles(db));
});

app.post("/api/admin/fiscal/profiles/actions/sync-from-products", requireAdminPermission("fiscal.edit"), (_req, res) => {
  void handleAdminSyncFiscalProfilesFromProductsBatch(_req, res);
});

app.post("/api/admin/fiscal/profiles/actions/mark-ready-eligible", requireAdminPermission("fiscal.edit"), (_req, res) => {
  void handleAdminMarkFiscalProfilesReadyBatch(_req, res);
});

app.post("/api/admin/fiscal/profiles/:id/apply-template", requireAdminPermission("fiscal.edit"), (req, res) => {
  void handleAdminApplyFiscalProfileTemplate(req, res);
});

app.patch("/api/admin/fiscal/profiles/:id", requireAdminPermission("fiscal.edit"), (req, res) => {
  void handleAdminUpdateFiscalProfile(req, res);
});

app.get("/api/admin/catalog-staging", requireAdminModule("catalog", "view"), (req, res) => {
  const db = readDb();
  const status = typeof req.query.status === "string" ? req.query.status : null;
  res.json(listAdminCatalogStaging(db, status));
});

app.get("/api/admin/catalog-staging/summary", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(getCatalogStagingSummary(db));
});

app.get("/api/admin/catalog-staging/workboard", requireAdminModule("catalog", "view"), (_req, res) => {
  const db = readDb();
  res.json(getCatalogStagingWorkboard(db));
});

app.get("/api/admin/catalog-staging/launch-batch", requireAdminModule("catalog", "view"), (req, res) => {
  const db = readDb();
  const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 60);
  res.json(getCatalogLaunchBatch(db, limit));
});

app.post("/api/admin/catalog-staging/actions/refresh", requireAnyAdminPermission(["catalog.edit", "catalog.submit_for_approval"]), (_req, res) => {
  void handleAdminRefreshCatalogStaging(_req, res);
});

app.post("/api/admin/catalog-staging/actions/publish-ready", requireAdminPermission("catalog.approve"), (_req, res) => {
  void handleAdminPublishReadyCatalogStaging(_req, res);
});

app.post("/api/admin/catalog-staging/actions/apply-suggestions", requireAnyAdminPermission(["catalog.edit", "catalog.submit_for_approval"]), (_req, res) => {
  void handleAdminApplyCatalogStagingSuggestionsBatch(_req, res);
});

app.post("/api/admin/catalog-staging/actions/align-go-live-gate", requireAdminPermission("catalog.approve"), (req, res) => {
  void handleAdminAlignCatalogGoLiveGate(req, res);
});

app.post("/api/admin/catalog-staging/actions/materialize-launch-batch", requireAdminPermission("catalog.approve"), (req, res) => {
  void handleAdminMaterializeCatalogLaunchBatch(req, res);
});

app.patch("/api/admin/catalog-staging/:id", requireAnyAdminPermission(["catalog.edit", "catalog.submit_for_approval"]), (req, res) => {
  void handleAdminUpdateCatalogStagingItem(req, res);
});

app.post("/api/admin/catalog-staging/:id/apply-suggestions", requireAnyAdminPermission(["catalog.edit", "catalog.submit_for_approval"]), (req, res) => {
  void handleAdminApplyCatalogStagingSuggestions(req, res);
});

app.post("/api/admin/catalog-staging/:id/publish", requireAdminPermission("catalog.approve"), (req, res) => {
  void handleAdminPublishCatalogStagingItem(req, res);
});

app.get("/api/admin/inventory/lots", requireAdminModule("delivery", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminInventoryLots(db));
});

app.get("/api/admin/inventory/movements", requireAdminModule("delivery", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminInventoryMovements(db));
});

app.post("/api/admin/inventory/transfers", requireAdminPermission("stock.validate_availability"), (req, res) => {
  void handleAdminCreateInventoryTransfer(req, res);
});

app.get("/api/admin/fiscal/documents", requireAdminModule("fiscal", "view"), (_req, res) => {
  const db = readDb();
  res.json(listAdminFiscalDocuments(db));
});

app.post("/api/admin/fiscal/documents/actions/authorize-ready", requireAdminPermission("fiscal.edit"), (_req, res) => {
  void handleAdminAuthorizeReadyFiscalDocumentsBatch(_req, res);
});

app.post("/api/admin/fiscal/documents/actions/go-live-gate", requireAdminPermission("fiscal.edit"), (_req, res) => {
  void handleAdminUpdateFiscalDocumentsGoLiveGateBatch(_req, res);
});

app.patch("/api/admin/fiscal/documents/:id/status", requireAdminPermission("fiscal.edit"), (req, res) => {
  void handleAdminUpdateFiscalDocumentStatus(req, res);
});

app.post("/api/audit", requireAuth, (req, res) => {
  void handleCreateAuditEvent(req, res);
});

app.get("/api/audit/orders/:id", requireAuth, (req, res) => {
  const db = readDb();
  res.json(listOrderAuditLogs(db, String(req.params.id)));
});

if (hasDist) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const bodyParserType = (err as { type?: string } | null)?.type;
  if (bodyParserType === "entity.too.large") {
    res.status(413).json(buildError("Corpo da requisicao excede o limite permitido."));
    return;
  }
  if (bodyParserType === "entity.parse.failed" || err instanceof SyntaxError) {
    res.status(400).json(buildError("JSON invalido na requisicao."));
    return;
  }
  logError({
    event: "http.unhandled_error",
    module: "http",
    requestId: res.locals.requestId ?? null,
    error: err,
  });
  res.status(500).json(buildError("Erro interno. Tente novamente em instantes."));
});

export { app };

let shutdownPromise: Promise<void> | null = null;
let registeredShutdownHandlers = false;

export async function startServer(portOverride = port) {
  assertProductionConfiguration();
  await initializeDb();
  if (isProductionLike()) {
    const activeAdmins = readDb().users.filter((user) => user.role === "admin" && user.is_active);
    if (activeAdmins.length === 0) {
      throw new Error("Producao sem usuario administrador ativo. Execute npm run admin:bootstrap.");
    }
    if (activeAdmins.some((user) => verifyPassword("admin123", user))) {
      throw new Error("Credencial administrativa padrao detectada. Execute npm run admin:bootstrap com ADMIN_PASSWORD forte.");
    }
  }
  await initializeObjectStorage();
  return await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const server = app.listen(portOverride, "0.0.0.0", () => {
      const address = server.address();
      const resolvedPort = typeof address === "object" && address ? address.port : portOverride;
      console.log(`API ready on http://0.0.0.0:${resolvedPort}`);
      resolve(server);
    });
    server.once("error", (error) => {
      reject(error);
    });
  });
}

export async function stopServer(server?: Server | null) {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      }

      await Promise.allSettled([closeQueueResources(), closeRedisClient(), closePostgresPool(), closeObjectStorage()]);
      closeDbResources();
    })().finally(() => {
      shutdownPromise = null;
    });
  }

  await shutdownPromise;
}

function registerShutdownHandlers(server: Server) {
  if (registeredShutdownHandlers) return;
  registeredShutdownHandlers = true;

  const shutdown = async (signal: string) => {
    try {
      logInfo({
        event: "server.shutdown_requested",
        module: "server",
        data: { signal },
      });
      await stopServer(server);
      process.exitCode = 0;
    } catch (error) {
      logError({
        event: "server.shutdown_failed",
        module: "server",
        error,
        data: { signal },
      });
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

const currentModulePath = fileURLToPath(import.meta.url);
const directRunPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (directRunPath === currentModulePath) {
  void startServer()
    .then((server) => {
      registerShutdownHandlers(server);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
