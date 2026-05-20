-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garminActivityId" BIGINT NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityName" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "movingDurationSec" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "calories" INTEGER,
    "averageHr" INTEGER,
    "maxHr" INTEGER,
    "hrZone1Sec" INTEGER,
    "hrZone2Sec" INTEGER,
    "hrZone3Sec" INTEGER,
    "hrZone4Sec" INTEGER,
    "hrZone5Sec" INTEGER,
    "moderateMinutes" INTEGER,
    "vigorousMinutes" INTEGER,
    "averageSpeed" DOUBLE PRECISION,
    "maxSpeed" DOUBLE PRECISION,
    "averageCadence" DOUBLE PRECISION,
    "maxCadence" DOUBLE PRECISION,
    "avgStrideLength" DOUBLE PRECISION,
    "elevationGainM" DOUBLE PRECISION,
    "elevationLossM" DOUBLE PRECISION,
    "trimpLoad" DOUBLE PRECISION,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminSyncState" (
    "userId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "oldestActivityAt" TIMESTAMP(3),
    "backfillComplete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarminSyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Activity_userId_startTime_idx" ON "Activity"("userId", "startTime" DESC);

-- CreateIndex
CREATE INDEX "Activity_userId_activityType_startTime_idx" ON "Activity"("userId", "activityType", "startTime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_garminActivityId_key" ON "Activity"("userId", "garminActivityId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarminSyncState" ADD CONSTRAINT "GarminSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
