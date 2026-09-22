CREATE TABLE "runtime_records" (
    "collection" VARCHAR(80) NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_records_pkey" PRIMARY KEY ("collection", "id")
);

CREATE TABLE "runtime_meta" (
    "key" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_meta_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "stored_objects" (
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "provider" VARCHAR(24) NOT NULL,
    "public_url" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "etag" TEXT,
    "original_name" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "runtime_records_collection_idx" ON "runtime_records"("collection");
CREATE INDEX "stored_objects_provider_bucket_idx" ON "stored_objects"("provider", "bucket");
CREATE INDEX "stored_objects_created_at_idx" ON "stored_objects"("created_at");

-- Import the previous JSONB-per-table runtime layout when this migration is
-- deployed over an installation that already used PostgreSQL.
DO $$
DECLARE
    collection_name TEXT;
BEGIN
    FOREACH collection_name IN ARRAY ARRAY[
        'users', 'brands', 'categories', 'products', 'orders', 'orderOperations',
        'orderItems', 'auditLogs', 'coupons', 'stores', 'sellers', 'payments',
        'quotes', 'quoteItems', 'quoteRequests', 'quoteRequestItems',
        'quoteRequestStatusHistory', 'quoteRequestNotes', 'customerProfiles',
        'leads', 'deliveryZones', 'freightCarriers', 'authOtps', 'establishments',
        'fiscalProfiles', 'inventoryLots', 'inventoryMovements', 'stockLocations',
        'stockAddresses', 'pickingTasks', 'pickingTaskItems', 'fiscalDocuments',
        'catalogStaging', 'freightQuoteCache', 'freightQuoteHistory',
        'freightErrorLogs', 'fiscalAiSuggestions', 'fiscalNcmCache', 'aiSettings',
        'aiUsageLogs', 'ecommerceThemes', 'marketingCampaigns', 'marketingBanners',
        'marketingCards', 'productShowcases', 'campaignLandingPages',
        'contentSnippets', 'marketingAssets', 'integrationProviders',
        'integrationSecrets', 'marketingEvents', 'adminManagementTaskOverrides',
        'adminManagementTaskEvents'
    ]
    LOOP
        IF to_regclass(format('%I', collection_name)) IS NOT NULL THEN
            EXECUTE format(
                'INSERT INTO runtime_records (collection, id, payload) SELECT %L, id, payload FROM %I ON CONFLICT (collection, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP',
                collection_name,
                collection_name
            );
        END IF;
    END LOOP;

    IF to_regclass('meta_state') IS NOT NULL THEN
        INSERT INTO runtime_meta (key, payload)
        SELECT key, payload FROM meta_state
        ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP;
    END IF;
END $$;
