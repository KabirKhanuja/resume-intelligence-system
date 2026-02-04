-- CreateIndex
CREATE INDEX "Resume_batch_department_idx" ON "Resume"("batch", "department");

-- CreateIndex
CREATE INDEX "Resume_score_idx" ON "Resume"("score");
