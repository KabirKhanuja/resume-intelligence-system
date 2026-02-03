-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT,
    "batch" TEXT,
    "department" TEXT,
    "schema" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "embedding" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
