"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Briefcase, FileText, Search, Users, ChevronRight, CheckCircle2, User, ArrowLeft } from "lucide-react"
import { postJson } from "@/lib/api"

type ShortlistResult = {
    resumeId: string
    matchScore: number
    baseScore: number
}

export default function ShortlistPage() {
    const [step, setStep] = useState<"input" | "processing" | "results">("input")

    // Input State
    const [company, setCompany] = useState("")
    const [role, setRole] = useState("")
    const [jd, setJd] = useState("")
    const [topN, setTopN] = useState(10)
    const [results, setResults] = useState<ShortlistResult[]>([])
    const [error, setError] = useState<string | null>(null)

    const handleShortlist = async () => {
        if (!company || !role || !jd) return
        setError(null)
        setStep("processing")
        try {
            const res = await postJson<ShortlistResult[]>("/api/v1/tpo/shortlist", {
                jdText: jd,
                topN,
            })
            setResults(res)
            setStep("results")
        } catch (e) {
            const message = e instanceof Error ? e.message : "Shortlisting failed"
            setError(message)
            setStep("input")
        }
    }

    if (step === "processing") {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 animate-in fade-in">
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-4 border-muted opacity-20" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <Search className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Analyzing Candidate Pool</h2>
                    <p className="text-muted-foreground">Matching profiles against JD requirements...</p>
                </div>
            </div>
        )
    }

    if (step === "results") {
        return (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setStep("input")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Shortlist Results</h1>
                        <p className="text-muted-foreground">{company} - {role}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <Badge variant="outline" className="h-8 px-3">Top {results.length} Matches</Badge>
                        <Button disabled>Save Shortlist</Button>
                    </div>
                </div>

                <div className="grid gap-4">
                    {results.map((candidate, i) => (
                        <Card key={candidate.resumeId} className="flex flex-col md:flex-row items-center p-4 gap-4 bg-white border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 md:w-1/4">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-bold text-sm text-secondary-foreground">
                                    #{i + 1}
                                </span>
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">Resume</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-55">{candidate.resumeId}</p>
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
                            </div>

                            <div className="ml-auto">
                                <Button variant="ghost" size="sm">
                                    View Profile <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                    {results.length === 0 && (
                        <p className="text-sm text-muted-foreground">No resumes available to shortlist (embeddings may still be processing).</p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Create New Shortlist</h1>
                <p className="text-muted-foreground">Define criteria and job details to find the best candidates.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Job Details</CardTitle>
                    <CardDescription>Enter the company and role information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Company Name</label>
                            <Input
                                placeholder="e.g. Acme Corp"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Job Role</label>
                            <Input
                                placeholder="e.g. Software Engineer"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            />
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
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Job Description (JD)</CardTitle>
                            <CardDescription>Paste the full job description text to extract keywords.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2">
                            <FileText className="h-4 w-4" /> Upload File
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <textarea
                        className="flex min-h-50 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Paste JD content here..."
                        value={jd}
                        onChange={(e) => setJd(e.target.value)}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="ghost">Cancel</Button>
                <Button size="lg" onClick={handleShortlist} disabled={!company || !role || !jd}>
                    Run Shortlist Algorithm
                </Button>
            </div>

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}
