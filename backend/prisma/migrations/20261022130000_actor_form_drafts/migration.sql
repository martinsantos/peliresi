CREATE TABLE "actor_form_drafts" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "scope" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "data" JSONB NOT NULL,
  "requestId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "actor_form_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "actor_form_drafts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "actor_form_drafts_ownerId_scope_key" ON "actor_form_drafts"("ownerId", "scope");
CREATE INDEX "actor_form_drafts_expiresAt_idx" ON "actor_form_drafts"("expiresAt");
CREATE TABLE "actor_form_draft_files" (
  "id" TEXT NOT NULL, "draftId" TEXT NOT NULL, "kind" TEXT NOT NULL, "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL, "path" TEXT NOT NULL, "sha256" TEXT NOT NULL, "size" INTEGER NOT NULL, "year" INTEGER,
  CONSTRAINT "actor_form_draft_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "actor_form_draft_files_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "actor_form_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "actor_form_draft_files_draftId_kind_key" ON "actor_form_draft_files"("draftId", "kind");
