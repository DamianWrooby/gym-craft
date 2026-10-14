-- CreateEnum
CREATE TYPE "LoadMethod" AS ENUM ('EDWARDS', 'BANISTER', 'DURATION', 'LABEL_TABLE', 'ATHLETE_ESTIMATE');

-- CreateEnum
CREATE TYPE "ZoneSource" AS ENUM ('ATHLETE_ZONES', 'GARMIN_ZONES');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "loadMethod" "LoadMethod",
ADD COLUMN "zoneSource" "ZoneSource";

-- The type filters below are frozen copies of trimpModality / isRunningTypeKey
-- (src/lib/utils/activity-type.ts) as of this migration; they do not follow later edits.

-- One-time job (story 92): strength load at the flat rate, duration x 2 TRIMP/min.
UPDATE "Activity"
SET "trimpLoad" = "durationSec" / 60.0 * 2, "loadMethod" = 'DURATION'
WHERE "activityType" LIKE 'strength%';

-- Existing rows with Garmin time in zone were scored by Edwards on Garmin's zones.
UPDATE "Activity"
SET "loadMethod" = 'EDWARDS', "zoneSource" = 'GARMIN_ZONES'
WHERE "loadMethod" IS NULL AND "hrZone1Sec" IS NOT NULL;

-- One-time job (story 93): flag runs of the last 42 days so the next sync re-bins them
-- against the athlete's zones (the retry path picks up every GARMIN_ZONES run in the window).
UPDATE "Activity"
SET "zoneSource" = 'GARMIN_ZONES'
WHERE "zoneSource" IS NULL
  AND "startTime" >= NOW() - INTERVAL '42 days'
  AND ("activityType" LIKE '%running%' OR "activityType" IN ('virtual_run', 'ultra_run', 'obstacle_run'));
