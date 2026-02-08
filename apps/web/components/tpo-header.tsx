import Link from "next/link"
import { Button } from "@/components/ui/button"

export function TPOHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between mx-auto px-4 md:px-8">
                <Link href="/tpo" className="flex items-center gap-2 font-semibold">
                    <span className="text-lg tracking-tight text-primary">Resume<span className="text-foreground">Intelligence</span> <span className="text-muted-foreground font-normal ml-2 text-sm bg-secondary px-2 py-0.5 rounded-full">Placement Cell</span></span>
                </Link>
                <nav className="flex items-center gap-6 text-sm font-medium">
                    <Link href="/tpo" className="transition-colors hover:text-primary">Dashboard</Link>
                    <Link href="/tpo/shortlist" className="transition-colors hover:text-primary">New Shortlist</Link>
                    <Link href="/" className="text-muted-foreground transition-colors hover:text-primary">Log out</Link>
                </nav>
            </div>
        </header>
    )
}
