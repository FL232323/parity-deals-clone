import { auth } from "@clerk/nextjs/server"
import { FileUploader } from "../_components/FileUploader"
import { ClearDataButton } from "../_components/ClearDataButton"

export default async function UploadPage() {
  const { userId, redirectToSignIn } = auth()
  if (userId == null) return redirectToSignIn()

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold">Upload Betting Data</h1>
        <ClearDataButton />
      </div>
      
      <p className="mb-6 text-muted-foreground">
        Upload your betting data export from your sportsbook to analyze your performance.
        We currently support Excel (.xls, .xlsx) and CSV files.
      </p>
      
      <div className="space-y-6">
        <FileUploader />
        
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Data Management</h2>
          <p className="text-sm text-muted-foreground mb-4">
            As you make more bets, you can re-upload your data to keep your analytics up to date.
            If you encounter any issues with your data, you can use the Clear Data button to reset
            and start fresh with a new upload.
          </p>
          <div className="flex items-center text-sm text-muted-foreground gap-1">
            <span className="font-semibold">Note:</span>
            <span>Clearing your data is permanent and cannot be undone.</span>
          </div>
        </div>
      </div>
    </>
  )
}