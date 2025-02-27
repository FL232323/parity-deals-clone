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
    
    // Step 2: Convert to raw strings for our processing
    // First try to get as CSV with newlines to preserve structure
    let rawData: RawBettingData = []
    
    try {
      // Try first to get CSV format with newlines
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const csvData = XLSX.utils.sheet_to_csv(firstSheet, { 
        blankrows: false,
        FS: '\t',
        RS: '|||' // Special row separator we'll split on later
      })
      
      // Split the CSV and clean up empty rows
      rawData = csvData.split('|||')
        .filter(line => line.trim() !== '')
        .map(line => line.trim())
      
      console.log(`CSV method: Extracted ${rawData.length} raw data items`)
    } catch (e) {
      console.error("Error with CSV extraction, falling back to JSON:", e)
      
      // Fall back to JSON method
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 })
      
      // Convert to array of strings
      jsonData.forEach(row => {
        if (Array.isArray(row)) {
          row.forEach(cell => {
            if (cell !== undefined && cell !== null) {
              rawData.push(String(cell))
            }
          })
        } else if (row !== undefined && row !== null) {
          rawData.push(String(row))
        }
      })
      
      console.log(`JSON method: Extracted ${rawData.length} raw data items`)
    }
    
    // If we still have no data, try direct cell extraction
    if (rawData.length === 0) {
      console.log("No data extracted, trying direct cell extraction")
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1000')
      
      for (let row = range.s.r; row <= range.e.r; ++row) {
        for (let col = range.s.c; col <= range.e.c; ++col) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          const cell = sheet[cellAddress]
          
          if (cell && cell.v !== undefined && cell.v !== null) {
            rawData.push(String(cell.v))
          }
        }
      }
      
      console.log(`Direct cell extraction: Got ${rawData.length} raw data items`)
    }
    
    if (rawData.length === 0) {
      throw new Error("Failed to extract any data from the file")
    }
    
    // Clean up XML-like structure if present
    rawData = preprocessExcelData(rawData)
    console.log(`After preprocessing: ${rawData.length} data items`)
    
    // Find where the real data starts by looking for date patterns
    let dataStartIndex = 0
    for (let i = 0; i < Math.min(100, rawData.length); i++) {
      if (isDate(rawData[i])) {
        dataStartIndex = i
        break
      }
    }
    
    // Assume headers are the 13 elements before the first date if possible
    const effectiveStartIndex = Math.max(0, dataStartIndex - 13)
    const headers = rawData.slice(effectiveStartIndex, dataStartIndex)
    
    console.log("Headers:", headers)
    console.log("First data row:", rawData[dataStartIndex])
    console.log("Data start index:", dataStartIndex)

    // Process the data
    const {
      singleBets,
      parlayHeaders,
      parlayLegs,
      teamStats,
      playerStats,
      propStats
    } = extractBettingData(rawData.slice(dataStartIndex), userId)

    console.log(`Extracted: ${singleBets.length} single bets, ${parlayHeaders.length} parlays`)

    // Sanitize data before database insert
    const sanitizedSingleBets = singleBets.map(sanitizeBet)
    const sanitizedParlayHeaders = parlayHeaders.map(sanitizeBet)
    const sanitizedParlayLegs = parlayLegs.map(sanitizeParlayLeg)

    // Store in database without using transactions (Neon HTTP driver doesn't support them)
    // Store single bets
    if (sanitizedSingleBets.length > 0) {
      await db.insert(SingleBetsTable).values(sanitizedSingleBets)
    }

    // Store parlay headers and legs
    for (const parlayHeader of sanitizedParlayHeaders) {
      const [inserted] = await db.insert(ParlayHeadersTable)
        .values(parlayHeader)
        .returning({ id: ParlayHeadersTable.id })

      // Find corresponding legs
      const legs = sanitizedParlayLegs.filter(leg => leg.parlayId === parlayHeader.betSlipId)
      
      if (legs.length > 0 && inserted) {
        // Update parlayId to use the database ID instead of betSlipId
        const legsWithCorrectId = legs.map(leg => ({
          ...leg,
          parlayId: inserted.id
        }))
        
        await db.insert(ParlayLegsTable).values(legsWithCorrectId)
      }
    }

    // Store aggregated stats
    if (teamStats.length > 0) {
      await db.insert(TeamStatsTable).values(teamStats)
    }
    
    if (playerStats.length > 0) {
      await db.insert(PlayerStatsTable).values(playerStats)
    }
    
    if (propStats.length > 0) {
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