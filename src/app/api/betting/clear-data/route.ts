import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { clearBettingData } from "@/server/betting/clearData"

/**
 * API endpoint to clear all betting data for the authenticated user
 */
export async function POST(req: NextRequest) {
  // Verify authentication
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Call the clearBettingData function with the authenticated user's ID
    const result = await clearBettingData(userId)
    
    if (result.success) {
      return NextResponse.json({ 
        success: true,
        message: result.message
      })
    } else {
      return NextResponse.json({ 
        success: false,
        error: result.error || "Failed to clear data" 
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in clear-data API route:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error" 
      },
      { status: 500 }
    )
  }
}