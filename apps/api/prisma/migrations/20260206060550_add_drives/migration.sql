-- CreateTable
CREATE TABLE "Drive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "jdText" TEXT NOT NULL,
    "topN" INTEGER NOT NULL,
    "applicants" INTEGER NOT NULL,
    "shortlisted" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Drive_createdAt_idx" ON "Drive"("createdAt");

-- CreateIndex
CREATE INDEX "Drive_company_idx" ON "Drive"("company");
