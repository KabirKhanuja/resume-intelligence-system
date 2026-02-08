import { StudentHeader } from "@/components/student-header"

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <StudentHeader />
            <main className="flex-1 container mx-auto px-4 md:px-8 py-8 md:py-12">
                {children}
            </main>
        </div>
    )
}
