import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { processBettingData } from "@/server/betting/processor"

export async function POST(request: NextRequest) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    
    // Validate file type
    const fileType = file.name.split('.').pop()?.toLowerCase()
    if (!['xls', 'xlsx', 'csv'].includes(fileType || '')) {
      return NextResponse.json({ 
        error: "Invalid file type. Please upload an Excel (.xls, .xlsx) or CSV file." 
      }, { status: 400 })
    }
    
    // Process the file
    const fileBuffer = await file.arrayBuffer()
    const result = await processBettingData(Buffer.from(fileBuffer), userId)
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error || "Failed to process file" 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      message: "File processed successfully",
      stats: {
        singleBets: result.singleBetsCount,
        parlays: result.parlaysCount,
        parlayLegs: result.parlayLegsCount,
        teamStats: result.teamStatsCount,
        playerStats: result.playerStatsCount,
        propStats: result.propStatsCount
      }
    })
  } catch (error) {
    console.error("Error processing file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 500 }
    )
  }
}
