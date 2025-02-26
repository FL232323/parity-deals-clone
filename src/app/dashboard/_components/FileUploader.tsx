"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { UploadIcon, CheckCircle2Icon, AlertCircleIcon, BarChart2Icon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"

export function FileUploader() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadStats, setUploadStats] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()
  const router = useRouter()
  
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    setUploadSuccess(false)
    setUploadError(null)
    setProgress(0)
    
    // Start progress animation
    const progressInterval = setInterval(() => {
      setProgress(prevProgress => {
        // Simulate progress up to 90% (the rest happens after successful response)
        if (prevProgress >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prevProgress + 10
      })
    }, 500)
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const response = await fetch("/api/betting/upload", {
        method: "POST",
        body: formData,
      })
      
      clearInterval(progressInterval)
      setProgress(100)
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Upload failed")
      }
      
      setUploadSuccess(true)
      setUploadStats(data.stats)
      
      toast({
        title: "Upload Successful",
        description: `Processed ${data.stats.singleBets + data.stats.parlays} bets successfully.`,
      })
    } catch (error) {
      clearInterval(progressInterval)
      setProgress(100)
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setUploadError(errorMessage)
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }
  
  const handleViewAnalytics = () => {
    router.push('/dashboard/analytics')
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Betting Data</CardTitle>
        <CardDescription>
          Upload your sports betting data from Hard Rock Bet, FanDuel, DraftKings, or other sportsbooks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!uploadSuccess && !uploadError ? (
          <>
            <div 
              className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg border-muted-foreground/25 cursor-pointer"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <UploadIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                Drag and drop your file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supported formats: .xls, .xlsx, .csv
              </p>
              <input
                type="file"
                accept=".xls,.xlsx,.csv"
                className="hidden"
                id="file-upload"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <Button
                disabled={isUploading}
                className="mt-4"
              >
                {isUploading ? "Processing..." : "Select File"}
              </Button>
            </div>
            
            {isUploading && (
              <div className="mt-6">
                <p className="text-sm mb-2">Processing your betting data...</p>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </>
        ) : uploadSuccess ? (
          <div className="flex flex-col items-center p-6 text-center">
            <CheckCircle2Icon className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Upload Successful!</h3>
            <p className="mb-6">Your betting data has been processed and is ready for analysis.</p>
            
            <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-6">
              <Stat label="Single Bets" value={uploadStats?.singleBets || 0} />
              <Stat label="Parlays" value={uploadStats?.parlays || 0} />
              <Stat label="Total Legs" value={uploadStats?.parlayLegs || 0} />
            </div>
            
            <div className="flex gap-4">
              <Button onClick={handleViewAnalytics}>
                <BarChart2Icon className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
              <Button variant="outline" onClick={() => {
                setUploadSuccess(false)
                setUploadStats(null)
              }}>
                Upload Another File
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center p-6 text-center">
            <AlertCircleIcon className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Upload Failed</h3>
            <p className="mb-6 text-red-500">{uploadError}</p>
            <Button onClick={() => {
              setUploadError(null)
            }}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
