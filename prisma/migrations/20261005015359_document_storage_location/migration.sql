-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "storageMode" TEXT NOT NULL DEFAULT 'local';
