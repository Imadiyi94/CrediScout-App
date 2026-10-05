-- CreateTable
CREATE TABLE "CreditReport" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "bvn" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "firstCentralScore" INTEGER,
    "crcScore" INTEGER,
    "averageScore" DECIMAL(6,2),
    "fullResponseJson" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditReport_assessmentId_checkedAt_idx" ON "CreditReport"("assessmentId", "checkedAt");

-- AddForeignKey
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
