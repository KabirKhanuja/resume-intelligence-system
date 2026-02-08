import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { FileText, CheckCircle2, Search, BarChart } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScanningResumeProps {
    onComplete?: () => void
}

export function ScanningResume({ onComplete }: ScanningResumeProps) {
    const [step, setStep] = useState<"parsing" | "analyzing" | "comparing" | "complete">("parsing")

    useEffect(() => {
        const timers = [
            setTimeout(() => setStep("analyzing"), 1500),
            setTimeout(() => setStep("comparing"), 3000),
            setTimeout(() => {
                setStep("complete")
                onComplete?.()
            }, 4500),
        ]
        return () => timers.forEach(clearTimeout)
    }, [onComplete])

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-8">
            {/* Document Representation */}
            <div className="relative w-48 h-64 bg-white dark:bg-zinc-900 border rounded-lg shadow-xl overflow-hidden">
                {/* Document Content Skeleton */}
                <div className="p-4 space-y-3 opacity-30">
                    <div className="h-4 w-1/3 bg-foreground/20 rounded" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />
                    <div className="h-2 w-2/3 bg-foreground/10 rounded" />

                    <div className="h-3 w-1/4 bg-foreground/20 rounded mt-6" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />

                    <div className="h-3 w-1/4 bg-foreground/20 rounded mt-6" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />
                    <div className="h-2 w-full bg-foreground/10 rounded" />
                </div>

                {/* Scanning Beam */}
                <motion.div
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-70 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    animate={{ top: ["0%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="absolute inset-0 bg-blue-500/5"
                    animate={{ opacity: [0, 0.2, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </div>

            {/* Progress Indicators */}
            <div className="w-full space-y-6">
                <div className="space-y-4">
                    <StepItem
                        active={step === "parsing" || step === "analyzing" || step === "comparing" || step === "complete"}
                        completed={step !== "parsing"}
                        icon={FileText}
                        label="Parsing Document Structure"
                    />
                    <StepItem
                        active={step === "analyzing" || step === "comparing" || step === "complete"}
                        completed={step !== "parsing" && step !== "analyzing"}
                        icon={Search}
                        label="Analyzing Skills & Experience"
                    />
                    <StepItem
                        active={step === "comparing" || step === "complete"}
                        completed={step === "complete"}
                        icon={BarChart}
                        label="Benchmarking against Peers"
                    />
                </div>
            </div>
        </div>
    )
}

function StepItem({ active, completed, icon: Icon, label }: { active: boolean; completed: boolean; icon: any; label: string }) {
    return (
        <div className={cn("flex items-center gap-4 transition-opacity duration-500", active ? "opacity-100" : "opacity-30")}>
            <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-500",
                completed ? "bg-primary border-primary text-primary-foreground" : active ? "border-primary text-primary animate-pulse" : "border-muted-foreground text-muted-foreground"
            )}>
                {completed ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
            </div>
            <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        </div>
    )
}
