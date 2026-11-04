-- Operational admission metadata only. No user, actor or historical rows change.
CREATE TABLE "rate_limit_counters" (
  "key" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "resetAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_limit_counters_resetAt_idx" ON "rate_limit_counters"("resetAt");
