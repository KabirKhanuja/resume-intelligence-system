-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT,
    "batch" TEXT,
    "department" TEXT,
    "schema" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "embedding" JSONB,
    "embeddingModel" TEXT,
    "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
    "embeddingError" TEXT,
    "embeddingUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Resume" ("batch", "createdAt", "department", "embedding", "id", "schema", "score", "studentId") SELECT "batch", "createdAt", "department", "embedding", "id", "schema", "score", "studentId" FROM "Resume";
DROP TABLE "Resume";
ALTER TABLE "new_Resume" RENAME TO "Resume";
CREATE INDEX "Resume_embeddingStatus_idx" ON "Resume"("embeddingStatus");
CREATE INDEX "Resume_batch_department_idx" ON "Resume"("batch", "department");
CREATE INDEX "Resume_score_idx" ON "Resume"("score");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
