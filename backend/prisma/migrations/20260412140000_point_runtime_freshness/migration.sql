-- AlterTable
ALTER TABLE "Point" ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "commState" TEXT DEFAULT 'UNKNOWN';
