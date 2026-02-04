"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle2, ChevronRight, Download, Sparkles, TrendingUp } from "lucide-react"

export default function ResultsPage() {
    // Dummy data simulating analysis result
    const analysis = {
        overallScore: 78,
        percentile: 82,
        sections: [
            { name: "Skills Relevance", score: 85, color: "bg-emerald-500" },
            { name: "Experience Impact", score: 72, color: "bg-blue-500" },
            { name: "Project Depth", score: 65, color: "bg-amber-500" },
            { name: "Formatting & Structure", score: 90, color: "bg-purple-500" },
        ],
        feedback: [
            {
                type: "improvement",
                title: "Quantify your achievements",
                description: "Your experience section lists responsibilities but lacks metric-driven results. Use numbers to show impact (e.g., 'Reduced load time by 40%')."
            },
            {
                type: "improvement",
                title: "Expand on 'Project Alpha'",
                description: "This project looks significant but needs more technical detail regarding the system architecture and your specific role."
            },
            {
                type: "strength",
                title: "Strong Technical Skills",
                description: "Your skills section is well-categorized and covers relevant modern technologies for your target role."
            }
        ]
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
                    <p className="text-muted-foreground">Detailed breakdown of your resume performance.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Export Report
                    </Button>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="col-span-2 bg-white border border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium text-slate-700">Overall Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-primary">{analysis.overallScore}</span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="success" className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-0">
                                Top 20%
                            </Badge>
                            <span>Better than {analysis.percentile}% of peers</span>
                        </div>
                        <Progress value={analysis.overallScore} className="mt-4 h-2" />
                    </CardContent>
                </Card>

                {/* AI Insight Highlight */}
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
                            "Your profile shows strong backend competence, but lacks clear leadership evidence in project descriptions. Adding specific metrics to your internship experience could boost your score by ~15 points."
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-7">
                {/* Section Breakdown */}
                <Card className="col-span-4 p-0 overflow-hidden">
                    <CardHeader>
                        <CardTitle>Section Performance</CardTitle>
                        <CardDescription>How different parts of your resume contribute to the score.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {analysis.sections.map((section) => (
                            <div key={section.name} className="space-y-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span>{section.name}</span>
                                    <span>{section.score}/100</span>
                                </div>
                                <Progress value={section.score} className="h-2" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Detailed Feedback */}
                <Card className="col-span-3 h-full">
                    <CardHeader>
                        <CardTitle>Actionable Feedback</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {analysis.feedback.map((item, i) => (
                            <div key={i} className="flex gap-3 items-start p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className={cn("mt-0.5", item.type === 'strength' ? "text-emerald-500" : "text-amber-500")}>
                                    {item.type === 'strength' ? <CheckCircle2 className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{item.title}</p>
                                    <p className="text-xs text-muted-foreground leading-snug">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <Button size="sm" variant="ghost" className="w-full mt-2 text-primary">
                            View Full Report <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
