import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users, Briefcase, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function TPODashboard() {
    // Mock data for companies/drives
    const activeDrives = [
        { id: 1, company: "TechCorp Inc.", role: "SDE I", applicants: 145, shortlisted: 20, status: "Active", date: "2024-03-10" },
        { id: 2, company: "FinServe Global", role: "Data Analyst", applicants: 89, shortlisted: 12, status: "Processing", date: "2024-03-12" },
        { id: 3, company: "MediaFlow", role: "Product Designer", applicants: 56, shortlisted: 0, status: "Open", date: "2024-03-15" },
    ]

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
                        <div className="text-2xl font-bold">1,204</div>
                        <p className="text-xs text-muted-foreground mb-1">+12% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Companies</CardTitle>
                        <Briefcase className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">18</div>
                        <p className="text-xs text-muted-foreground mb-1">+2 new this week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Shortlisting Efficiency</CardTitle>
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">92%</div>
                        <p className="text-xs text-muted-foreground mb-1">Match relevance score</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Recent Drives</h2>
                <div className="grid gap-4">
                    {activeDrives.map((drive) => (
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
                                <Badge variant={drive.status === 'Active' ? 'success' : drive.status === 'Processing' ? 'warning' : 'outline'}>
                                    {drive.status}
                                </Badge>
                                <Button variant="outline" size="sm">View Details</Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
