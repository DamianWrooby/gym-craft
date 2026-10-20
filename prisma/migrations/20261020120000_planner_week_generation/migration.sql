-- DESTRUCTIVE (ADR 0017): every legacy gym plan of every user is deleted and cannot be
-- recovered. Review by hand before deploy. The legacy table is "Plan" (Prisma model GymPlan).
DROP TABLE "Plan";

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('STRENGTH', 'RUNNING', 'OTHER');
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'DONE', 'SKIPPED', 'SUPERSEDED');
CREATE TYPE "SessionOrigin" AS ENUM ('AI', 'ATHLETE');
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "AiRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiRequest_userId_status_idx" ON "AiRequest"("userId", "status");
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlannedSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planWeekId" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED',
    "origin" "SessionOrigin" NOT NULL,
    "plannedLoad" DOUBLE PRECISION NOT NULL,
    "loadMethod" "LoadMethod" NOT NULL,
    "activityId" TEXT,
    "supersedesId" TEXT,
    "anchor" JSONB,
    "body" JSONB NOT NULL,
    "bodyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlannedSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlannedSession_planWeekId_scheduledDate_idx" ON "PlannedSession"("planWeekId", "scheduledDate");
CREATE INDEX "PlannedSession_userId_scheduledDate_idx" ON "PlannedSession"("userId", "scheduledDate");
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_planWeekId_fkey" FOREIGN KEY ("planWeekId") REFERENCES "PlanWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PlanWeek" ADD COLUMN "aiRequestId" TEXT;
CREATE UNIQUE INDEX "PlanWeek_aiRequestId_key" ON "PlanWeek"("aiRequestId");
ALTER TABLE "PlanWeek" ADD CONSTRAINT "PlanWeek_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "AiRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
