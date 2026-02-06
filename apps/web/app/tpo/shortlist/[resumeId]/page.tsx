import CandidateProfileClient from "./profile-client"

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ resumeId: string }>
}) {
  const { resumeId } = await params
  return <CandidateProfileClient resumeId={resumeId} />
}
