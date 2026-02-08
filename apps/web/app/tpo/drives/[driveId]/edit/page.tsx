import DriveEditClient from "./drive-edit-client"

export default async function DriveEditPage({
  params,
}: {
  params: Promise<{ driveId: string }>
}) {
  const { driveId } = await params
  return <DriveEditClient driveId={driveId} />
}
