-- CreateTable
CREATE TABLE "data_changes" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "locationId" TEXT,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_changes_timestamp_idx" ON "data_changes"("timestamp");

-- CreateIndex
CREATE INDEX "data_changes_entityType_timestamp_idx" ON "data_changes"("entityType", "timestamp");

-- CreateIndex
CREATE INDEX "data_changes_locationId_timestamp_idx" ON "data_changes"("locationId", "timestamp");
