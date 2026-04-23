-- CreateTable
CREATE TABLE "push_subscripciones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscripciones_endpoint_key" ON "push_subscripciones"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscripciones_usuarioId_idx" ON "push_subscripciones"("usuarioId");

-- AddForeignKey
ALTER TABLE "push_subscripciones" ADD CONSTRAINT "push_subscripciones_usuarioId_fkey" 
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
