import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { GraduationCap, Briefcase, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <div className="space-y-4">
          <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium border-blue-200 bg-blue-50 text-blue-700 rounded-full animate-in fade-in slide-in-from-bottom-3">
            ✨ AI-Powered Placement Analysis
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl text-foreground">
            Resume Intelligence <span className="text-primary">System</span>
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl font-light leading-relaxed">
            Upload your resume, compare with peers, and get <span className="font-medium text-foreground">AI-driven insights</span> to land your dream job.
          </p>
        </div>

        <div className="grid w-full gap-8 md:grid-cols-2 lg:max-w-3xl text-left mt-4">
          <Card className="group relative overflow-hidden bg-white border border-slate-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-300">
            <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/30 transition-colors duration-300" />
            <CardHeader className="relative">
              <div className="h-12 w-12 rounded-2xl bg-blue-100/50 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <GraduationCap className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <CardTitle className="text-2xl">For Students</CardTitle>
              <CardDescription className="text-base">
                Instant resume scoring, peer ranking, and detailed feedback to improve your profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pt-2">
              <Link href="/student" className="w-full">
                <Button className="w-full text-base font-medium h-12 shadow-blue-200 shadow-lg" size="lg">
                  Verify Resume Impact <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-white border border-slate-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300">
            <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/30 transition-colors duration-300" />
            <CardHeader className="relative">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100/50 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                <Briefcase className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <CardTitle className="text-2xl">For Placement Cell</CardTitle>
              <CardDescription className="text-base">
                Semantic search for candidates and automated shortlisting based on JD matching.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pt-2">
              <Link href="/tpo" className="w-full">
                <Button variant="outline" className="w-full text-base font-medium h-12 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200" size="lg">
                  Access TPO Portal
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
