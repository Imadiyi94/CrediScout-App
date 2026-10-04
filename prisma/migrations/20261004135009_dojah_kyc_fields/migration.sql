-- AlterTable
ALTER TABLE "Borrower" ADD COLUMN     "bvnName" TEXT,
ADD COLUMN     "bvnNumber" TEXT,
ADD COLUMN     "bvnVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "faceMatch" BOOLEAN,
ADD COLUMN     "faceScore" DECIMAL(5,2),
ADD COLUMN     "kycVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "ninName" TEXT,
ADD COLUMN     "ninNumber" TEXT,
ADD COLUMN     "ninVerified" BOOLEAN NOT NULL DEFAULT false;
