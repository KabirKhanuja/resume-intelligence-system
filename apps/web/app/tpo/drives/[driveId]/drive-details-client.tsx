"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

import { ArrowLeft, ChevronRight, FileDown, User } from "lucide-react"

type ShortlistResult = {
  resumeId: string
  matchScore: number
  baseScore: number
}

type ResumeSchemaLike = {
  meta?: {
    name?: string
    department?: string
    batch?: string
    email?: string
    phone?: string
  }
  skills?: Array<{ name?: string; confidence?: number }>
  projects?: Array<{ title?: string; domain?: string; technologies?: string[]; description?: string }>
  experience?: Array<{ company?: string; role?: string; bullets?: string[] }>
}

type DriveCandidate = {
  rank: number
  resumeId: string
  matchScore: number
  baseScore: number
  resume: {
    id: string
    studentId: string | null
    batch: string | null
    department: string | null
    score: number
    embeddingStatus: string
    createdAt: string
    schema: unknown
    file: null | {
      url: string
      name: string | null
      mime: string | null
      size: number | null
    }
  }
}

type DriveDetails = {
  id: string
  company: string
  role: string
  jdText: string
  topN: number
  applicants: number
  shortlisted: number
  status: string
  createdAt: string
  results: unknown
}

function asResults(value: unknown): ShortlistResult[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null
      const r = row as any
      if (typeof r.resumeId !== "string") return null
      return {
        resumeId: r.resumeId,
        matchScore: typeof r.matchScore === "number" ? r.matchScore : Number(r.matchScore ?? 0),
        baseScore: typeof r.baseScore === "number" ? r.baseScore : Number(r.baseScore ?? 0),
      }
    })
    .filter((v): v is ShortlistResult => Boolean(v))
}

function asSchema(value: unknown): ResumeSchemaLike | null {
  if (!value || typeof value !== "object") return null
  return value as ResumeSchemaLike
}

export default function DriveDetailsClient({ driveId }: { driveId: string }) {
  const [data, setData] = useState<DriveDetails | null>(null)
  const [candidates, setCandidates] = useState<DriveCandidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/tpo/drives/${encodeURIComponent(driveId)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          const message = json && typeof json === "object" && "error" in json ? String((json as any).error) : `Failed to load drive (${res.status})`
          throw new Error(message)
        }
        if (!cancelled) setData(json as DriveDetails)

        const res2 = await fetch(`/api/v1/tpo/drives/${encodeURIComponent(driveId)}/candidates`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        const json2 = await res2.json().catch(() => null)
        if (!res2.ok) {
          const message = json2 && typeof json2 === "object" && "error" in json2 ? String((json2 as any).error) : `Failed to load candidates (${res2.status})`
          throw new Error(message)
        }
        if (!cancelled) setCandidates((Array.isArray(json2) ? json2 : []) as DriveCandidate[])
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load drive"
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [driveId])

  const results = useMemo(() => asResults(data?.results), [data])

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <Link href="/tpo">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="h-6 w-56 bg-muted rounded" />
            <div className="h-4 w-40 bg-muted rounded mt-2" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded mt-3" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <Link href="/tpo">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Drive Details</h1>
            <p className="text-muted-foreground">{driveId}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Could not load drive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-red-600">{error ?? "Not found"}</p>
            <Link href="/tpo">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <Link href="/tpo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{data.company}</h1>
          <p className="text-muted-foreground truncate">{data.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={data.status === "done" ? "success" : "outline"}>{data.status}</Badge>
          <Link href={`/tpo/drives/${encodeURIComponent(data.id)}/edit`}>
            <Button variant="outline" size="sm">Edit & rerun</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Applicants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.applicants}</div>
            <p className="text-xs text-muted-foreground">Resumes with embeddings ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shortlisted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.shortlisted}</div>
            <p className="text-xs text-muted-foreground">Top {data.topN}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>JD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground line-clamp-3">{data.jdText}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Shortlisted Candidates</h2>
        <div className="grid gap-4">
          {candidates.map((candidate) => {
            const schema = asSchema(candidate.resume.schema)
            const name = schema?.meta?.name || candidate.resume.studentId || candidate.resume.id
            const dept = schema?.meta?.department || candidate.resume.department
            const batch = schema?.meta?.batch || candidate.resume.batch
            const subtitle = [dept, batch].filter(Boolean).join(" • ")

            const skills = (schema?.skills ?? [])
              .map((s) => (s?.name ?? "").trim())
              .filter(Boolean)
              .slice(0, 10)

            const projects = (schema?.projects ?? []).slice(0, 3)
            const exp = (schema?.experience ?? []).slice(0, 2)

            return (
            <Card key={candidate.resumeId} className="p-4 bg-white border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-4 md:w-1/4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-bold text-sm text-secondary-foreground">#{candidate.rank}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-55">{subtitle || candidate.resumeId}</p>
                </div>
              </div>

              <div className="md:w-1/4 space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Match Score</span>
                  <span className={candidate.matchScore >= 0.75 ? "text-emerald-600" : "text-amber-600"}>{Math.round(candidate.matchScore * 100)}%</span>
                </div>
                <Progress value={Math.round(candidate.matchScore * 100)} className={candidate.matchScore >= 0.75 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"} />
              </div>

              <div className="md:w-1/3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs font-normal">Base score: {candidate.baseScore}</Badge>
                <Badge variant="outline" className="text-xs font-normal">Similarity: {candidate.matchScore.toFixed(4)}</Badge>
                {skills.length ? (
                  <Badge variant="outline" className="text-xs font-normal">Skills: {skills.slice(0, 3).join(", ")}{skills.length > 3 ? "…" : ""}</Badge>
                ) : null}
              </div>

              <div className="ml-auto">
                <Link href={`/tpo/shortlist/${encodeURIComponent(candidate.resumeId)}`}>
                  <Button variant="ghost" size="sm">
                    View Profile <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                {candidate.resume.file?.url ? (
                  <a className="ml-2" href={candidate.resume.file.url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileDown className="h-4 w-4" /> View resume
                    </Button>
                  </a>
                ) : null}
              </div>
              </div>

              {(skills.length || projects.length || exp.length) ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Skills</div>
                    {skills.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skills.slice(0, 8).map((s) => (
                          <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">No skills extracted</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Projects</div>
                    {projects.length ? (
                      <ul className="mt-2 space-y-1">
                        {projects.map((p, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">{p.title || "Untitled"}</span>
                            {p.domain ? <span className="text-muted-foreground"> — {p.domain}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">No projects extracted</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Experience</div>
                    {exp.length ? (
                      <ul className="mt-2 space-y-1">
                        {exp.map((e, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">{e.role || "Role"}</span>
                            {e.company ? <span className="text-muted-foreground"> • {e.company}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">No experience extracted</div>
                    )}
                  </div>
                </div>
              ) : null}
            </Card>
            )
          })}

          {candidates.length === 0 && results.length === 0 && (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">No results saved for this drive.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
