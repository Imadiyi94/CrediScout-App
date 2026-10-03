-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "mitigationsText" TEXT,
ADD COLUMN     "proposedAmountKobo" BIGINT,
ADD COLUMN     "riskSummary" JSONB;

-- AlterTable
ALTER TABLE "RecommendationOverride" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';
