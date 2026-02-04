import { prisma } from "../db.js";

export type LlmRateLimitResult =
  | { allowed: true; limit: number; used: number; remaining: number }
  | { allowed: false; limit: number; used: number; remaining: 0; resetAt: string };

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export async function consumeDailyLlmQuota(options: {
  studentId: string;
  resumeId?: string | null;
  endpoint: string;
  limit: number;
  model?: string | null;
}): Promise<LlmRateLimitResult> {
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const dayEnd = endOfUtcDay(now);

  return prisma.$transaction(async (tx) => {
    const used = await tx.llmRequestLog.count({
      where: {
        studentId: options.studentId,
        endpoint: options.endpoint,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (used >= options.limit) {
      const resetAt = new Date(dayEnd.getTime() + 1).toISOString();
      return {
        allowed: false,
        limit: options.limit,
        used,
        remaining: 0,
        resetAt,
      };
    }

    await tx.llmRequestLog.create({
      data: {
        studentId: options.studentId,
        resumeId: options.resumeId ?? null,
        endpoint: options.endpoint,
        model: options.model ?? null,
      },
    });

    const remaining = Math.max(0, options.limit - (used + 1));
    return { allowed: true, limit: options.limit, used: used + 1, remaining };
  });
}
