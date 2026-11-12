-- Lease column for resumable, single-worker ingestion steps.
ALTER TABLE "Document" ADD COLUMN "leaseUntil" TIMESTAMP(3);
