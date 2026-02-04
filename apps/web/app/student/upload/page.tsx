"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UploadCloud } from "lucide-react"
import { ScanningResume } from "@/components/scanning-resume"

export default function UploadPage() {
    const router = useRouter()
    const [isUploading, setIsUploading] = useState(false)
    const [file, setFile] = useState<File | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = () => {
        if (!file) return
        setIsUploading(true)
    }

    const handleScanComplete = () => {
        // Navigate to results after scan animation
        // Small delay to let the "complete" state register visually
        setTimeout(() => {
            router.push("/student/results")
        }, 800)
    }

    if (isUploading) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center animate-in fade-in duration-700">
                <ScanningResume onComplete={handleScanComplete} />
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Upload Your Resume</h1>
                <p className="text-slate-500">Supports PDF and DOCX formats up to 10MB.</p>
            </div>

            <Card className="w-full max-w-lg border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-colors">
                <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                    <div className="p-4 rounded-full bg-secondary/50 mb-2">
                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <span className="font-semibold text-primary hover:underline">Click to upload</span>
                            <span className="text-muted-foreground"> or drag and drop</span>
                            <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileChange}
                            />
                        </label>
                        <p className="text-xs text-muted-foreground">PDF, DOCX (Max 10MB)</p>
                    </div>

                    {file && (
                        <div className="flex items-center gap-2 text-sm text-foreground bg-secondary px-3 py-1 rounded-full mt-4">
                            <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="w-full max-w-lg">
                <Button
                    size="lg"
                    className="w-full"
                    disabled={!file}
                    onClick={handleUpload}
                >
                    Begin Analysis
                </Button>
            </div>
        </div>
    )
}
