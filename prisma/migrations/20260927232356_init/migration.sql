-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ANALYST', 'ADMIN');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('NEW', 'RETURNING');

-- CreateEnum
CREATE TYPE "Product" AS ENUM ('SBL', 'SME', 'AGRO', 'CLEAN_ENERGY', 'HOUSING_EDU', 'ASSET');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'RECOMMENDED', 'DECIDED');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('RB', 'FLAT');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVE', 'REDUCED', 'DECLINE', 'REFER');

-- CreateEnum
CREATE TYPE "RepaymentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'BULLET');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ANALYST',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Borrower" (
    "id" TEXT NOT NULL,
    "type" "BorrowerType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "businessProfile" JSONB,
    "clientStatus" "ClientStatus" NOT NULL DEFAULT 'NEW',
    "clientStatusVerified" BOOLEAN NOT NULL DEFAULT false,
    "clientStatusVerifiedAt" TIMESTAMP(3),
    "clientStatusVerifiedBy" TEXT,
    "clientStatusEvidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Borrower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "requestedAmountKobo" BIGINT NOT NULL,
    "proposedTenorMonths" INTEGER NOT NULL,
    "loanPurpose" TEXT NOT NULL,
    "repaymentSource" TEXT NOT NULL,
    "repaymentFrequency" "RepaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "existingExposureKobo" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSnapshot" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "revenueKobo" BIGINT NOT NULL,
    "opexKobo" BIGINT NOT NULL,
    "netIncomeKobo" BIGINT NOT NULL,
    "cashFlowKobo" BIGINT NOT NULL,
    "existingDebtServiceKobo" BIGINT NOT NULL DEFAULT 0,
    "proposedDebtServiceKobo" BIGINT NOT NULL DEFAULT 0,
    "dti" DECIMAL(10,4),
    "dscr" DECIMAL(10,4),
    "loanToIncome" DECIMAL(10,4),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditProfile" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "repaymentHistoryGrade" TEXT,
    "delinquencyFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalExposureKobo" BIGINT NOT NULL DEFAULT 0,
    "utilizationPct" DECIMAL(5,2),
    "multipleBorrowingFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guarantorObligationsKobo" BIGINT NOT NULL DEFAULT 0,
    "redFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "qualitativeScore" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collateral" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ownership" TEXT,
    "estimatedValueKobo" BIGINT NOT NULL,
    "verifiedValueKobo" BIGINT,
    "marketability" TEXT,
    "encumbrancesKobo" BIGINT NOT NULL DEFAULT 0,
    "documentationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "ltv" DECIMAL(6,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAssessment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "payload" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateTable" (
    "id" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "clientStatus" "ClientStatus",
    "minAmountKobo" BIGINT NOT NULL,
    "maxAmountKobo" BIGINT,
    "ratePctMonthly" DECIMAL(6,3) NOT NULL,
    "rateType" "RateType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "RateTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyThreshold" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "product" "Product",
    "value" DECIMAL(10,4) NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "requestedAmountKobo" BIGINT NOT NULL,
    "recommendedAmountKobo" BIGINT NOT NULL,
    "recommendedTenorMonths" INTEGER NOT NULL,
    "ratePctMonthly" DECIMAL(6,3) NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rateBasis" TEXT NOT NULL,
    "installmentKobo" BIGINT,
    "totalInterestKobo" BIGINT,
    "effectiveAnnualRatePct" DECIMAL(7,4),
    "reasons" TEXT,
    "risks" JSONB,
    "mitigations" JSONB,
    "conditions" TEXT,
    "analystNotes" TEXT,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationOverride" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "approvedByAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "extractedJson" JSONB,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "stage" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "Assessment_analystId_status_idx" ON "Assessment"("analystId", "status");

-- CreateIndex
CREATE INDEX "Assessment_borrowerId_idx" ON "Assessment"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSnapshot_assessmentId_key" ON "FinancialSnapshot"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditProfile_assessmentId_key" ON "CreditProfile"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_assessmentId_key" ON "BusinessProfile"("assessmentId");

-- CreateIndex
CREATE INDEX "Collateral_assessmentId_idx" ON "Collateral"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssessment_assessmentId_key" ON "ProductAssessment"("assessmentId");

-- CreateIndex
CREATE INDEX "RateTable_product_active_idx" ON "RateTable"("product", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RateTable_product_clientStatus_minAmountKobo_key" ON "RateTable"("product", "clientStatus", "minAmountKobo");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyThreshold_key_product_key" ON "PolicyThreshold"("key", "product");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_assessmentId_key" ON "Recommendation"("assessmentId");

-- CreateIndex
CREATE INDEX "RecommendationOverride_recommendationId_idx" ON "RecommendationOverride"("recommendationId");

-- CreateIndex
CREATE INDEX "Document_assessmentId_idx" ON "Document"("assessmentId");

-- CreateIndex
CREATE INDEX "Alert_assessmentId_idx" ON "Alert"("assessmentId");

-- CreateIndex
CREATE INDEX "AuditEvent_assessmentId_createdAt_idx" ON "AuditEvent"("assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSnapshot" ADD CONSTRAINT "FinancialSnapshot_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditProfile" ADD CONSTRAINT "CreditProfile_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collateral" ADD CONSTRAINT "Collateral_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssessment" ADD CONSTRAINT "ProductAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOverride" ADD CONSTRAINT "RecommendationOverride_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
