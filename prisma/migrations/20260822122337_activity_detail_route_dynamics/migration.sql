-- AlterTable
ALTER TABLE "ActivityDetail" ADD COLUMN     "dynamics" JSONB,
ADD COLUMN     "route" JSONB,
ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1;
