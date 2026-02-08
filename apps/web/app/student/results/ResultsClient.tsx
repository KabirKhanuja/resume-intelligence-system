"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, ChevronRight, Download, Sparkles, TrendingUp } from "lucide-react"
import { postJson } from "@/lib/api"

type ResumeScore = {
  totalScore: number
  breakdown: {
    skills: number
    projects: number
    experience: number
    structure: number
  }
}

type CohortComparisonResult = {
  rank: number
  total: number
  percentile: number
  comparisons: {
    skills: {
      student: number
      average: number
      missingCommon: string[]
    }
    projects: {
      student: number
      average: number
    }
    experience: {
      student: number
      average: number
    }
  }
}

type MissingResponse = {
  adviceBullets: string[]
}

type LlmFeedbackResponse = {
  adviceBullets: string[]
  llm?: {
    limit: number
    used: number
    remaining: number
    model: string
  }
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function pickInsightBullet(
  bullets: string[],
  focus: "skills" | "projects" | "experience" | "structure" | null,
): string | null {
  if (!bullets.length) return null
  if (!focus) return bullets[0] ?? null

  const patterns: Record<Exclude<typeof focus, null>, RegExp> = {
    skills: /\bskills?\b/i,
    projects: /\bprojects?\b|\bdomain\b/i,
    experience: /\bexperience\b|\bintern\b|\bwork\b/i,
    structure: /\bsection\b|\bformat\b|\blayout\b|\bstructure\b/i,
  }

  const p = patterns[focus]
  return bullets.find((b) => p.test(b)) ?? bullets[0] ?? null
}

export default function ResultsClient({ resumeId }: { resumeId: string | null }) {
  const [score, setScore] = useState<ResumeScore | null>(null)
  const [comparison, setComparison] = useState<CohortComparisonResult | null>(null)
  const [missing, setMissing] = useState<MissingResponse | null>(null)
  const [llmFeedback, setLlmFeedback] = useState<LlmFeedbackResponse | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!resumeId) return
    let cancelled = false

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const [s, c, m] = await Promise.all([
          postJson<ResumeScore>("/api/v1/student/score", { resumeId }),
          postJson<CohortComparisonResult>("/api/v1/student/compare", { resumeId }),
          postJson<MissingResponse>("/api/v1/student/missing", { resumeId, topN: 10, mode: "score" }),
        ])

        if (cancelled) return
        setScore(s)
        setComparison(c)
        setMissing(m)
        setLlmFeedback(null)
        setLlmError(null)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : "Failed to load results"
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resumeId])

  const sections = useMemo(() => {
    if (!score) return [] as Array<{ name: string; score: number; max: number }>
    return [
      { name: "Skills", score: score.breakdown.skills, max: 30 },
      { name: "Projects", score: score.breakdown.projects, max: 35 },
      { name: "Experience", score: score.breakdown.experience, max: 25 },
      { name: "Structure", score: score.breakdown.structure, max: 10 },
    ]
  }, [score])

  const llmAdviceBullets = llmFeedback?.adviceBullets?.filter(Boolean) ?? []

  const insightText = useMemo(() => {
    const focus = (() => {
      if (!score) return null
      const parts = [
        { key: "skills" as const, ratio: score.breakdown.skills / 30 },
        { key: "projects" as const, ratio: score.breakdown.projects / 35 },
        { key: "experience" as const, ratio: score.breakdown.experience / 25 },
        { key: "structure" as const, ratio: score.breakdown.structure / 10 },
      ]
      parts.sort((a, b) => a.ratio - b.ratio)
      return parts[0]?.key ?? null
    })()

    if (llmAdviceBullets.length > 0) return pickInsightBullet(llmAdviceBullets, focus)

    const deterministicBullets = missing?.adviceBullets?.filter(Boolean) ?? []
    if (deterministicBullets.length > 0) {
      return pickInsightBullet(deterministicBullets, focus)
    }

    const missingCommon = comparison?.comparisons?.skills?.missingCommon ?? []
    if (missingCommon.length > 0) {
      return `Consider adding these cohort-common skills if you have them: ${missingCommon
        .slice(0, 6)
        .join(", ")}.`
    }

    return null
  }, [comparison, llmAdviceBullets, missing, score])

  const betterThanPct =
    typeof comparison?.percentile === "number" ? clampPct(comparison.percentile) : null

  const standingPct = betterThanPct === null ? null : clampPct(100 - betterThanPct)

  // comparison.percentile is "better than X%" (higher is better).
  // If you're better than >=50%, you're above median -> show Top (100 - betterThan)%.
  // Otherwise show Bottom (100 - betterThan)%.
  const standingLabel =
    standingPct === null
      ? null
      : betterThanPct !== null && betterThanPct >= 50
        ? `Top ${standingPct}%`
        : `Bottom ${standingPct}%`

  async function generateAiFeedback() {
    if (!resumeId) return
    setLlmLoading(true)
    setLlmError(null)
    try {
      const resp = await postJson<LlmFeedbackResponse>("/api/v1/student/feedback", {
        resumeId,
        topN: 10,
        mode: "score",
      })
      setLlmFeedback(resp)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to generate AI feedback"
      setLlmError(message)
    } finally {
      setLlmLoading(false)
    }
  }

  if (!resumeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Analysis Results</h1>
        <p className="text-muted-foreground">Missing resumeId. Upload a resume first.</p>
        <Button asChild>
          <a href="/student/upload">Go to Upload</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
          <p className="text-muted-foreground">Detailed breakdown of your resume performance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Failed to load results</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-2 bg-white border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-slate-700">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-primary">
                {score?.totalScore ?? (loading ? "…" : "—")}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              {standingLabel && (
                <Badge
                  variant="success"
                  className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-0"
                >
                  {standingLabel}
                </Badge>
              )}
              <span>
                Better than {betterThanPct ?? (loading ? "…" : "—")}% of peers
              </span>
            </div>

            <Progress value={score?.totalScore ?? 0} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card className="col-span-2 border-l-4 border-l-purple-500 bg-white border-y border-r border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-slate-900">AI Evaluator Insight</CardTitle>
            </div>
            <CardDescription>Key takeaway from the analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {insightText ? `"${insightText}"` : loading ? "Loading insight…" : "No insight available."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4 p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Section Performance</CardTitle>
            <CardDescription>How different parts of your resume contribute to the score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map((section) => (
              <div key={section.name} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{section.name}</span>
                  <span>
                    {section.score}/{section.max}
                  </span>
                </div>
                <Progress
                  value={section.max > 0 ? clampPct((section.score / section.max) * 100) : 0}
                  className="h-2"
                />
              </div>
            ))}
            {!loading && sections.length === 0 && (
              <p className="text-sm text-muted-foreground">No breakdown available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 h-full">
          <CardHeader>
            <CardTitle>Actionable Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={llmFeedback ? "outline" : "default"}
                className="w-full"
                onClick={generateAiFeedback}
                disabled={llmLoading || loading}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {llmLoading ? "Generating AI feedback…" : llmFeedback ? "Regenerate AI feedback" : "Generate AI feedback"}
              </Button>
            </div>

            {llmError && <p className="text-xs text-red-600">{llmError}</p>}

            {(llmAdviceBullets.length > 0 ? llmAdviceBullets : missing?.adviceBullets ?? [])
              .slice(0, 6)
              .map((bullet, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={cn("mt-0.5", "text-amber-500")}>
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Suggestion</p>
                  <p className="text-xs text-muted-foreground leading-snug">{bullet}</p>
                </div>
              </div>
            ))}

            {comparison?.comparisons?.skills?.missingCommon?.length ? (
              <div className="flex gap-3 items-start p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={cn("mt-0.5", "text-emerald-500")}>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Common skills to consider</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {comparison.comparisons.skills.missingCommon.slice(0, 10).join(", ")}
                  </p>
                </div>
              </div>
            ) : null}

            {!loading && llmAdviceBullets.length === 0 && !missing?.adviceBullets?.length && (
              <p className="text-sm text-muted-foreground">No feedback available.</p>
            )}

            <Button size="sm" variant="ghost" className="w-full mt-2 text-primary" disabled>
              View Full Report <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
