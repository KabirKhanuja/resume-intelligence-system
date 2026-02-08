"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import { ArrowLeft, FileDown, FileText, GraduationCap, Briefcase, Wrench } from "lucide-react"

type ResumeSchemaLike = {
  meta?: {
    name?: string
    email?: string
    phone?: string
    department?: string
    batch?: string
    resumeId?: string
    studentId?: string
  }
  skills?: Array<{ name?: string; confidence?: number }>
  projects?: Array<{
    title?: string
    domain?: string
    description?: string
    technologies?: string[]
    confidence?: number
  }>
  experience?: Array<{
    company?: string
    role?: string
    startDate?: string
    endDate?: string
    location?: string
    bullets?: string[]
    technologies?: string[]
    confidence?: number
  }>
  education?: Array<{
    institution?: string
    degree?: string
    field?: string
    startYear?: string
    endYear?: string
    grade?: string
    confidence?: number
  }>
}

type TpoResumeDetails = {
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

function asSchema(value: unknown): ResumeSchemaLike | null {
  if (!value || typeof value !== "object") return null
  return value as ResumeSchemaLike
}

export default function CandidateProfileClient({ resumeId }: { resumeId: string }) {
  const router = useRouter()
  const [data, setData] = useState<TpoResumeDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/tpo/resumes/${encodeURIComponent(resumeId)}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
          cache: "no-store",
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          const message = json && typeof json === "object" && "error" in json ? String((json as any).error) : `Failed to load resume (${res.status})`
          throw new Error(message)
        }
        if (!cancelled) setData(json as TpoResumeDetails)
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load resume"
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [resumeId])

  const schema = useMemo(() => asSchema(data?.schema), [data])

  const headerName = schema?.meta?.name || data?.studentId || data?.id || "Candidate"
  const headerSubtitle = [schema?.meta?.department || data?.department, schema?.meta?.batch || data?.batch]
    .filter(Boolean)
    .join(" • ")

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
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
          <Link href="/tpo/shortlist">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Candidate Profile</h1>
            <p className="text-muted-foreground">{resumeId}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Could not load details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-red-600">{error ?? "Not found"}</p>
            <div>
              <Link href="/tpo/shortlist">
                <Button variant="outline">Back to shortlist</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const skills = (schema?.skills ?? []).map((s) => (s?.name ?? "").trim()).filter(Boolean)
  const projects = schema?.projects ?? []
  const experience = schema?.experience ?? []
  const education = schema?.education ?? []

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <Link href="/tpo/shortlist">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{headerName}</h1>
          <p className="text-muted-foreground truncate">{headerSubtitle || data.id}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">Score: {data.score}</Badge>
          {data.file?.url ? (
            <a href={data.file.url} target="_blank" rel="noreferrer">
              <Button className="gap-2">
                <FileDown className="h-4 w-4" /> Open resume
              </Button>
            </a>
          ) : (
            <Button variant="outline" className="gap-2" disabled>
              <FileText className="h-4 w-4" /> Resume unavailable
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Embedding: {data.embeddingStatus}</Badge>
              {schema?.meta?.email ? <Badge variant="outline">{schema.meta.email}</Badge> : null}
              {schema?.meta?.phone ? <Badge variant="outline">{schema.meta.phone}</Badge> : null}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Base score</div>
              <Progress value={Math.min(100, Math.max(0, data.score))} />
              <div className="text-xs text-muted-foreground">(Progress is just a visual cue)</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.file ? (
              <>
                <div className="text-sm font-medium truncate">{data.file.name ?? "resume"}</div>
                <div className="text-xs text-muted-foreground">
                  {(data.file.mime ?? "unknown")} {typeof data.file.size === "number" ? `• ${Math.round(data.file.size / 1024)} KB` : ""}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No uploaded file stored for this resume.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            {skills.length ? (
              <div className="flex flex-wrap gap-2">
                {skills.slice(0, 50).map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills extracted for this resume.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length ? (
              projects.slice(0, 6).map((p, idx) => (
                <div key={idx} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{p.title || "Untitled project"}</div>
                    {p.domain ? <Badge variant="outline">{p.domain}</Badge> : null}
                  </div>
                  {p.technologies?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.technologies.slice(0, 10).map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {p.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No projects extracted for this resume.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {experience.length ? (
              experience.slice(0, 6).map((e, idx) => (
                <div key={idx} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.role || "Role"}{e.company ? ` • ${e.company}` : ""}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                        {e.location ? ` • ${e.location}` : ""}
                      </div>
                    </div>
                  </div>
                  {e.bullets?.length ? (
                    <ul className="mt-2 list-disc pl-5 space-y-1">
                      {e.bullets.slice(0, 6).map((b, bi) => (
                        <li key={bi} className="text-sm text-muted-foreground">{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No experience extracted for this resume.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {education.length ? (
              education.slice(0, 6).map((ed, idx) => (
                <div key={idx} className="rounded-md border p-3">
                  <div className="font-medium truncate">{ed.institution || "Institution"}</div>
                  <div className="text-sm text-muted-foreground">
                    {[ed.degree, ed.field].filter(Boolean).join(" • ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[ed.startYear, ed.endYear].filter(Boolean).join(" – ")}
                    {ed.grade ? ` • ${ed.grade}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No education extracted for this resume.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
