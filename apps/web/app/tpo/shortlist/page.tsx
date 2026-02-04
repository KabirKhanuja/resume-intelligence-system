"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Briefcase, FileText, Search, Users, ChevronRight, CheckCircle2, User, ArrowLeft } from "lucide-react"

export default function ShortlistPage() {
    const [step, setStep] = useState<"input" | "processing" | "results">("input")

    // Input State
    const [company, setCompany] = useState("")
    const [role, setRole] = useState("")
    const [jd, setJd] = useState("")

    // Mock Processing Animation
    const handleShortlist = () => {
        if (!company || !role || !jd) return
        setStep("processing")
        setTimeout(() => setStep("results"), 2000)
    }

    // Mock Results
    const results = [
        { id: 1, name: "Student A", score: 95, match: "High", skills: ["React", "Node.js", "System Design"], experience: "2 Internships" },
        { id: 2, name: "Student B", score: 88, match: "High", skills: ["Next.js", "TypeScript", "SQL"], experience: "1 Internship" },
        { id: 3, name: "Student C", score: 82, match: "Medium", skills: ["JavaScript", "HTML/CSS"], experience: "Projects only" },
        { id: 4, name: "Student D", score: 76, match: "Medium", skills: ["Python", "Flask"], experience: "1 Internship" },
        { id: 5, name: "Student E", score: 65, match: "Low", skills: ["Java", "OOP"], experience: "None" },
    ]

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
                        <Badge variant="outline" className="h-8 px-3">Top 5 Matches</Badge>
                        <Button>Save Shortlist</Button>
                    </div>
                </div>

                <div className="grid gap-4">
                    {results.map((candidate, i) => (
                        <Card key={candidate.id} className="flex flex-col md:flex-row items-center p-4 gap-4 bg-white border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 md:w-1/4">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-bold text-sm text-secondary-foreground">
                                    #{i + 1}
                                </span>
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">{candidate.name}</p>
                                    <p className="text-xs text-muted-foreground">ID: 2024-{100 + candidate.id}</p>
                                </div>
                            </div>

                            <div className="md:w-1/4 space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <span>Match Score</span>
                                    <span className={candidate.score > 80 ? "text-emerald-600" : "text-amber-600"}>{candidate.score}%</span>
                                </div>
                                <Progress value={candidate.score} className={candidate.score > 80 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"} />
                            </div>

                            <div className="md:w-1/3 flex flex-wrap gap-2">
                                {candidate.skills.map(skill => (
                                    <Badge key={skill} variant="secondary" className="text-xs font-normal">
                                        {skill}
                                    </Badge>
                                ))}
                                <Badge variant="outline" className="text-xs font-normal">{candidate.experience}</Badge>
                            </div>

                            <div className="ml-auto">
                                <Button variant="ghost" size="sm">
                                    View Profile <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
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
                        className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>
    )
}
