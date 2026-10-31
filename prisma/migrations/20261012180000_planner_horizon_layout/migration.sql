-- CreateEnum
CREATE TYPE "PlanState" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PhaseSource" AS ENUM ('SCHOOL', 'LEAD_IN');

-- CreateEnum
CREATE TYPE "VolumeUnit" AS ENUM ('MINUTES', 'METRES');

-- CreateEnum
CREATE TYPE "WeekGeneration" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "HorizonPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "state" "PlanState" NOT NULL DEFAULT 'ACTIVE',
    "availability" JSONB NOT NULL,
    "longRunDay" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorizonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPhase" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "intent" TEXT NOT NULL,
    "source" "PhaseSource" NOT NULL,
    "school" TEXT NOT NULL,
    "volumeUnit" "VolumeUnit" NOT NULL,

    CONSTRAINT "PlanPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "inHorizonDays" INTEGER NOT NULL,
    "recoveryBudget" DOUBLE PRECISION,
    "chronicLoad" DOUBLE PRECISION,
    "budgetStruckAt" TIMESTAMP(3),
    "outlookFactor" DOUBLE PRECISION,
    "generation" "WeekGeneration" NOT NULL DEFAULT 'PENDING',
    "isCutback" BOOLEAN NOT NULL DEFAULT false,
    "isTaper" BOOLEAN NOT NULL DEFAULT false,
    "timeTrialDistanceM" INTEGER,
    "volumeTarget" INTEGER NOT NULL,
    "volumeUnit" "VolumeUnit" NOT NULL,
    "strengthSessionTarget" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "revisedAt" TIMESTAMP(3),

    CONSTRAINT "PlanWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "timeSec" INTEGER NOT NULL,
    "label" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorizonPlan_userId_state_idx" ON "HorizonPlan"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPhase_planId_ordinal_key" ON "PlanPhase"("planId", "ordinal");

-- CreateIndex
CREATE INDEX "PlanWeek_userId_startDate_idx" ON "PlanWeek"("userId", "startDate");

-- CreateIndex
CREATE INDEX "PlanWeek_phaseId_idx" ON "PlanWeek"("phaseId");

-- CreateIndex
CREATE INDEX "RaceResult_userId_idx" ON "RaceResult"("userId");

-- AddForeignKey
ALTER TABLE "HorizonPlan" ADD CONSTRAINT "HorizonPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonPlan" ADD CONSTRAINT "HorizonPlan_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "RunningGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPhase" ADD CONSTRAINT "PlanPhase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HorizonPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWeek" ADD CONSTRAINT "PlanWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWeek" ADD CONSTRAINT "PlanWeek_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "PlanPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One active plan per user (ADR 0008). Prisma cannot express a partial index.
CREATE UNIQUE INDEX "HorizonPlan_one_active_per_user" ON "HorizonPlan"("userId") WHERE "state" = 'ACTIVE';
