import { db } from "@/drizzle/db"
import { 
  SingleBetsTable, 
  ParlayHeadersTable, 
  ParlayLegsTable,
  TeamStatsTable,
  PlayerStatsTable, 
  PropStatsTable 
} from "@/drizzle/schema"
import * as XLSX from 'xlsx'
// Import the extractBettingData function from extract-data.ts
import { extractBettingData } from './extract-data'

type RawBettingData = string[]

interface SingleBet {
  userId: string
  datePlaced?: Date | null
  status?: string
  league?: string
  match?: string
  betType?: string
  market?: string
  selection?: string
  price?: number
  wager?: number
  winnings?: number
  payout?: number
  result?: string
  betSlipId?: string
}

interface ParlayHeader extends SingleBet {
  potentialPayout?: number
}

interface ParlayLeg {
  parlayId: string
  legNumber: number
  status?: string
  league?: string
  match?: string
  market?: string
  selection?: string
  price?: number
  gameDate?: Date | null
}

interface TeamStat {
  userId: string
  team: string
  league?: string
  totalBets: number
  wins: number
  losses: number
  pushes: number
  pending: number
}

interface PlayerStat {
  userId: string
  player: string
  propTypes?: string[]
  totalBets: number
  wins: number
  losses: number
  pushes: number
  pending: number
}

interface PropStat {
  userId: string
  propType: string
  totalBets: number
  wins: number
  losses: number
  pushes: number
  pending: number
}

/**
 * Process a betting data file and store the extracted information
 * @param fileBuffer The uploaded file as a buffer
 * @param userId The user's ID
 * @returns Summary of processed data
 */
export async function processBettingData(fileBuffer: Buffer, userId: string) {
  try {
    // Step 1: Parse the Excel file with full options to handle different formats
    const workbook = XLSX.read(fileBuffer, {
      cellDates: true,
      cellStyles: true,
      cellNF: true,
      type: 'buffer',
      WTF: true // Parse everything possible
    })

    console.log("Workbook parsed successfully, sheets:", workbook.SheetNames)
    
    // Check if we have sheets
    if (workbook.SheetNames.length === 0) {
      throw new Error("No sheets found in the workbook")
    }
    
    // Step 2: Convert raw content to a string to handle the XML-like format
    let rawXml = ''
    try {
      // Get the sheet content as raw XML-like string to preserve structure
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rawXml = XLSX.utils.sheet_to_csv(sheet, { FS: '\n', RS: '\n' })
    } catch (e) {
      console.error("Error getting sheet as CSV:", e)
      // Try again with direct access to the file data
      rawXml = fileBuffer.toString('utf-8')
    }
    
    // Step 3: Extract the cell values from the XML format
    let rawData: RawBettingData = []
    
    // The pattern of XML structure shows data is in <ss:Data ss:Type="String">VALUE</ss:Data> tags
    const dataRegex = /<ss:Data[^>]*>(.*?)<\/ss:Data>/g
    let match
    
    while ((match = dataRegex.exec(rawXml)) !== null) {
      // match[1] contains the content between the tags
      if (match[1]) {
        rawData.push(match[1].trim())
      }
    }
    
    console.log(`Extracted ${rawData.length} cells from XML structure`)
    
    // If the regex didn't work, try the preprocessing method as a fallback
    if (rawData.length === 0) {
      console.log("Falling back to preprocessing method")
      
      // Convert to lines first
      const lines = rawXml.split('\n')
      
      // Clean up XML-like structure
      rawData = lines.map(line => line.trim())
        .filter(line => line !== '')
        .map(line => {
          // Extract content from XML tags
          const match = line.match(/<ss:Data[^>]*>(.*?)<\/ss:Data>/)
          return match ? match[1].trim() : line.trim()
        })
        .filter(item => item !== '')
      
      console.log(`Preprocessed ${rawData.length} items`)
    }
    
    // If we still have no data, try to extract as direct cell values
    if (rawData.length === 0) {
      console.log("No data extracted, trying direct cell extraction")
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      
      // Get all cell references
      const cellRefs = Object.keys(sheet).filter(key => !key.startsWith('!'))
      
      // Extract cell values
      for (const cellRef of cellRefs) {
        const cell = sheet[cellRef]
        if (cell && cell.v !== undefined && cell.v !== null) {
          rawData.push(String(cell.v))
        }
      }
      
      console.log(`Direct cell extraction: Got ${rawData.length} raw data items`)
    }
    
    if (rawData.length === 0) {
      throw new Error("Failed to extract any data from the file")
    }
    
    // Skip the header row (first 13 items)
    // The headers are Date Placed, Status, League, Match, etc.
    const headerItems = 13
    
    if (rawData.length > headerItems) {
      console.log("Headers:", rawData.slice(0, headerItems))
      
      // Skip past the header row
      rawData = rawData.slice(headerItems)
      
      console.log(`After skipping headers: ${rawData.length} data items`)
      console.log("First data items:", rawData.slice(0, Math.min(20, rawData.length)))
    }
    
    // Process the data using the improved extractBettingData function
    const {
      singleBets,
      parlayHeaders,
      parlayLegs,
      teamStats,
      playerStats,
      propStats
    } = extractBettingData(rawData, userId)

    console.log(`Extracted: ${singleBets.length} single bets, ${parlayHeaders.length} parlays`)

    // Sanitize data before database insert
    const sanitizedSingleBets = singleBets.map(sanitizeBet)
    const sanitizedParlayHeaders = parlayHeaders.map(sanitizeBet)
    const sanitizedParlayLegs = parlayLegs.map(sanitizeParlayLeg)

    // Store in database without using transactions (Neon HTTP driver doesn't support them)
    // Store single bets
    if (sanitizedSingleBets.length > 0) {
      console.log("Storing single bets:", sanitizedSingleBets.length)
      await db.insert(SingleBetsTable).values(sanitizedSingleBets)
    }

    // Store parlay headers and legs
    if (sanitizedParlayHeaders.length > 0) {
      console.log("Storing parlay headers:", sanitizedParlayHeaders.length)
      
      for (const parlayHeader of sanitizedParlayHeaders) {
        const [inserted] = await db.insert(ParlayHeadersTable)
          .values(parlayHeader)
          .returning({ id: ParlayHeadersTable.id })

        // Find corresponding legs
        const legs = sanitizedParlayLegs.filter(leg => leg.parlayId === parlayHeader.betSlipId)
        
        if (legs.length > 0 && inserted) {
          console.log(`Storing ${legs.length} legs for parlay ${inserted.id}`)
          
          // Update parlayId to use the database ID instead of betSlipId
          const legsWithCorrectId = legs.map(leg => ({
            ...leg,
            parlayId: inserted.id
          }))
          
          await db.insert(ParlayLegsTable).values(legsWithCorrectId)
        }
      }
    }

    // Store aggregated stats
    if (teamStats.length > 0) {
      console.log("Storing team stats:", teamStats.length)
      await db.insert(TeamStatsTable).values(teamStats)
    }
    
    if (playerStats.length > 0) {
      console.log("Storing player stats:", playerStats.length)
      await db.insert(PlayerStatsTable).values(playerStats)
    }
    
    if (propStats.length > 0) {
      console.log("Storing prop stats:", propStats.length)
      await db.insert(PropStatsTable).values(propStats)
    }

    return {
      success: true,
      singleBetsCount: sanitizedSingleBets.length,
      parlaysCount: sanitizedParlayHeaders.length,
      parlayLegsCount: sanitizedParlayLegs.length,
      teamStatsCount: teamStats.length,
      playerStatsCount: playerStats.length,
      propStatsCount: propStats.length
    }
  } catch (error) {
    console.error("Error processing betting data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Sanitize a bet object to ensure valid date values
 */
function sanitizeBet(bet: SingleBet | ParlayHeader): SingleBet | ParlayHeader {
  return {
    ...bet,
    datePlaced: isValidDate(bet.datePlaced) ? bet.datePlaced : null
  }
}

/**
 * Sanitize a parlay leg object to ensure valid date values
 */
function sanitizeParlayLeg(leg: ParlayLeg): ParlayLeg {
  return {
    ...leg,
    gameDate: isValidDate(leg.gameDate) ? leg.gameDate : null
  }
}

/**
 * Check if a date is valid
 */
function isValidDate(date: any): boolean {
  if (!date) return false
  if (!(date instanceof Date)) return false
  return !isNaN(date.getTime())
}