import { prisma } from "../db.js";

export const EMBEDDING_JOB_TYPE = "resume_embedding" as const;

export async function enqueueResumeEmbeddingJob(resumeId: string): Promise<void> {
  const dedupeKey = `${EMBEDDING_JOB_TYPE}:${resumeId}`;

  await prisma.job.upsert({
    where: { dedupeKey },
    create: {
      type: EMBEDDING_JOB_TYPE,
      dedupeKey,
      payload: { resumeId },
      status: "queued",
      priority: 0,
      attempts: 0,
      maxAttempts: 5,
      runAt: new Date(),
    },
    update: {
      // if it already exists or failed earlier, re-queue it
      status: "queued",
      runAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}
