import ResultsClient from "./ResultsClient"

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = params.resumeId
  const resumeId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined

  return <ResultsClient resumeId={resumeId ?? null} />
}
