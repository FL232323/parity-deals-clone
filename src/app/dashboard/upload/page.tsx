import { auth } from "@clerk/nextjs/server"
import { FileUploader } from "../_components/FileUploader"

export default async function UploadPage() {
  const { userId, redirectToSignIn } = auth()
  if (userId == null) return redirectToSignIn()

  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold">Upload Betting Data</h1>
      <p className="mb-6 text-muted-foreground">
        Upload your betting data export from your sportsbook to analyze your performance.
        We currently support Excel (.xls, .xlsx) and CSV files.
      </p>
      <FileUploader />
    </>
  )
}
