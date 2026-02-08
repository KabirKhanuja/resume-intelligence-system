import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UploadCloud, FileText, BarChart3, ArrowRight } from "lucide-react"

export default function StudentDashboard() {
    return (
        <div className="flex flex-col items-center justify-center space-y-8 py-10 md:py-20 text-center">
            <div className="space-y-4 max-w-2xl">
                <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl tracking-tight">
                    How do you compare to your peers?
                </h1>
                <p className="text-muted-foreground text-lg md:text-xl max-w-[600px] mx-auto">
                    Upload your resume to get an instant scoring analysis, comparative ranking, and AI-driven feedback.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 w-full max-w-5xl text-left mt-8">
                <Card className="group border-blue-100 hover:border-blue-300 transition-all hover:-translate-y-1 hover:shadow-md">
                    <CardHeader className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <UploadCloud className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle>Upload</CardTitle>
                            <CardDescription>Upload your PDF or DOC resume in seconds.</CardDescription>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="group border-blue-100 hover:border-blue-300 transition-all hover:-translate-y-1 hover:shadow-md">
                    <CardHeader className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle>Analyze</CardTitle>
                            <CardDescription>Our AI scans and scores your resume against industry standards.</CardDescription>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="group border-blue-100 hover:border-blue-300 transition-all hover:-translate-y-1 hover:shadow-md">
                    <CardHeader className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle>Improve</CardTitle>
                            <CardDescription>Receive actionable feedback to improve your ranking.</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            <div className="mt-12">
                <Link href="/student/upload">
                    <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-blue-200 hover:shadow-blue-300 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        Upload Resume Now <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </Link>
            </div>
        </div>
    )
}
