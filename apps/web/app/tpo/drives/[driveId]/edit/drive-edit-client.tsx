"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { ArrowLeft, Search } from "lucide-react"

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
}

type RerunResponse = {
  driveId: string
  results: Array<{ resumeId: string; matchScore: number; baseScore: number }>
}

export default function DriveEditClient({ driveId }: { driveId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [jdText, setJdText] = useState("")
  const [topN, setTopN] = useState(10)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/tpo/drives/${encodeURIComponent(driveId)}`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          const message = json && typeof json === "object" && "error" in json ? String((json as any).error) : `Failed to load drive (${res.status})`
          throw new Error(message)
        }
        const d = json as DriveDetails
        if (!cancelled) {
          setCompany(d.company ?? "")
          setRole(d.role ?? "")
          setJdText(d.jdText ?? "")
          setTopN(typeof d.topN === "number" ? d.topN : 10)
        }
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

  const rerun = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/tpo/drives/${encodeURIComponent(driveId)}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, jdText, topN }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message = json && typeof json === "object" && "error" in json ? String((json as any).error) : `Rerun failed (${res.status})`
        throw new Error(message)
      }
      const out = json as RerunResponse
      router.push(`/tpo/drives/${encodeURIComponent(out.driveId)}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Rerun failed"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <Link href={`/tpo/drives/${encodeURIComponent(driveId)}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Drive</h1>
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Link href={`/tpo/drives/${encodeURIComponent(driveId)}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Drive</h1>
          <p className="text-muted-foreground">Update JD/role and rerun the analysis.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <CardDescription>These are saved from the original drive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Role</label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Number of candidates</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value) || 10)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Description (JD)</CardTitle>
          <CardDescription>Edit the JD and run the shortlist again.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="flex min-h-50 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-3">
        <Link href={`/tpo/drives/${encodeURIComponent(driveId)}`}>
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button size="lg" onClick={rerun} disabled={saving || !company || !role || !jdText} className="gap-2">
          <Search className="h-4 w-4" /> {saving ? "Re-running…" : "Rerun analysis"}
        </Button>
      </div>
    </div>
  )
}
