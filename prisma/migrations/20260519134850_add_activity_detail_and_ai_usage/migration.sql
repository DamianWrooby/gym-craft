-- CreateTable
CREATE TABLE "ActivityDetail" (
    "activityId" TEXT NOT NULL,
    "splits" JSONB NOT NULL,
    "samples" JSONB NOT NULL,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityDetail_pkey" PRIMARY KEY ("activityId")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_userId_kind_idx" ON "AiUsage"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_userId_kind_day_key" ON "AiUsage"("userId", "kind", "day");

-- AddForeignKey
ALTER TABLE "ActivityDetail" ADD CONSTRAINT "ActivityDetail_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
