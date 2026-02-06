import DriveDetailsClient from "./drive-details-client"

export default async function DriveDetailsPage({
  params,
}: {
  params: Promise<{ driveId: string }>
}) {
  const { driveId } = await params
  return <DriveDetailsClient driveId={driveId} />
}
