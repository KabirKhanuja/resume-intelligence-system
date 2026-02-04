-- CreateTable
CREATE TABLE "LlmRequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "resumeId" TEXT,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LlmRequestLog_studentId_createdAt_idx" ON "LlmRequestLog"("studentId", "createdAt");
