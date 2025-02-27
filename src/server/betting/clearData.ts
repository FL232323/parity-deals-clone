import { db } from "@/drizzle/db"
import { 
  SingleBetsTable, 
  ParlayHeadersTable, 
  ParlayLegsTable,
  TeamStatsTable,
  PlayerStatsTable, 
  PropStatsTable 
} from "@/drizzle/schema"
import { eq, sql } from "drizzle-orm"

/**
 * Clear all betting data for a specific user
 * @param userId The Clerk user ID
 * @returns Success status and message
 */
export async function clearBettingData(userId: string) {
  try {
    console.log(`Clearing betting data for user: ${userId}`)
    
    // First, delete all parlay legs (due to foreign key constraints)
    // This is a bit complex as we need to find legs associated with the user's parlays
    await db.delete(ParlayLegsTable)
      .where(
        eq(
          ParlayLegsTable.parlayId,
          sql`ANY(SELECT id FROM parlay_headers WHERE user_id = ${userId})`
        )
      )
    
    // Then delete the remaining tables for this user
    await db.delete(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
    
    await db.delete(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
    
    await db.delete(TeamStatsTable)
      .where(eq(TeamStatsTable.userId, userId))
    
    await db.delete(PlayerStatsTable)
      .where(eq(PlayerStatsTable.userId, userId))
    
    await db.delete(PropStatsTable)
      .where(eq(PropStatsTable.userId, userId))
    
    console.log(`Successfully cleared betting data for user: ${userId}`)
    
    return { 
      success: true, 
      message: "All your betting data has been cleared successfully" 
    }
  } catch (error) {
    console.error("Error clearing betting data:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error clearing betting data" 
    }
  }
}