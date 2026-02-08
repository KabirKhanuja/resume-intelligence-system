import Link from "next/link"
import { Button } from "@/components/ui/button"

export function StudentHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between mx-auto px-4 md:px-8">
                <Link href="/student" className="flex items-center gap-2 font-semibold">
                    <span className="text-lg tracking-tight text-primary">Resume<span className="text-foreground">Intelligence</span></span>
                </Link>
                <nav className="flex items-center gap-4">
                    <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        Log out
                    </Link>
                </nav>
            </div>
        </header>
    )
}
