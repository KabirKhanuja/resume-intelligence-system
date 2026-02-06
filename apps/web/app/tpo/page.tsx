import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users, Briefcase, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type DriveRow = {
    id: string
    company: string
    role: string
    topN: number
    applicants: number
    shortlisted: number
    status: string
    createdAt: string
}

type TpoStats = {
    candidates: number
    companies: number
    drives: number
}

function getApiBase() {
    return (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "")
}

async function loadDrives(): Promise<DriveRow[]> {
    try {
        const res = await fetch(`${getApiBase()}/api/v1/tpo/drives?limit=10`, { cache: "no-store" })
        if (!res.ok) return []
        return (await res.json()) as DriveRow[]
    } catch {
        return []
    }
}

async function loadStats(): Promise<TpoStats> {
    try {
        const res = await fetch(`${getApiBase()}/api/v1/tpo/stats`, { cache: "no-store" })
        if (!res.ok) return { candidates: 0, companies: 0, drives: 0 }
        return (await res.json()) as TpoStats
    } catch {
        return { candidates: 0, companies: 0, drives: 0 }
    }
}

export default async function TPODashboard() {
    const [drives, stats] = await Promise.all([loadDrives(), loadStats()])

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Placement Dashboard</h1>
                    <p className="text-muted-foreground">Manage ongoing recruitment drives and shortlisting.</p>
                </div>
                <Link href="/tpo/shortlist">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" /> New Drive
                    </Button>
                </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.candidates}</div>
                        <p className="text-xs text-muted-foreground mb-1">Resumes in database</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Companies</CardTitle>
                        <Briefcase className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.companies}</div>
                        <p className="text-xs text-muted-foreground mb-1">Companies shortlisted</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Shortlisting Efficiency</CardTitle>
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.drives}</div>
                        <p className="text-xs text-muted-foreground mb-1">Total drives created</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Recent Drives</h2>
                <div className="grid gap-4">
                    {drives.map((drive) => (
                        <Card key={drive.id} className="flex flex-col md:flex-row items-center justify-between p-6 hover:bg-muted/30 transition-colors">
                            <div className="space-y-1 md:w-1/3">
                                <h3 className="font-semibold text-lg">{drive.company}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Briefcase className="h-3 w-3" /> {drive.role}
                                </div>
                            </div>

                            <div className="flex items-center gap-8 md:w-1/3 justify-center my-4 md:my-0">
                                <div className="text-center">
                                    <div className="text-lg font-bold">{drive.applicants}</div>
                                    <div className="text-xs text-muted-foreground">Applied</div>
                                </div>
                                <div className="h-8 w-px bg-border" />
                                <div className="text-center">
                                    <div className="text-lg font-bold">{drive.shortlisted}</div>
                                    <div className="text-xs text-muted-foreground">Shortlisted</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 md:w-1/3 justify-end">
                                <Badge variant={drive.status === "done" ? "success" : "outline"}>
                                    {drive.status}
                                </Badge>
                                <Link href={`/tpo/drives/${encodeURIComponent(drive.id)}`}>
                                    <Button variant="outline" size="sm">View Details</Button>
                                </Link>
                                <Link href={`/tpo/drives/${encodeURIComponent(drive.id)}/edit`}>
                                    <Button variant="ghost" size="sm">Edit</Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                    {drives.length === 0 && (
                        <Card className="p-6">
                            <div className="text-sm text-muted-foreground">No drives yet. Create one from “New Drive”.</div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
