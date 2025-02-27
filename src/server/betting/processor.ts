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

/**
 * Pre-process Excel data to remove XML-like structure
 */
function preprocessExcelData(rawData: string[]): string[] {
  // Look for XML patterns and clean them up
  return rawData.map(item => {
    // Remove common XML tags
    return item
      .replace(/<ss:Row>|<ss:Cell>|<\/ss:Cell>|<ss:Data ss:Type="[^"]*">|<\/ss:Data>|<\/ss:Row>/g, '')
      .replace(/<?xml[^>]*>|<ss:Workbook[^>]*>|<ss:Worksheet[^>]*>|<ss:Table>|<\/ss:Table>|<\/ss:Worksheet>|<\/ss:Workbook>/g, '')
      .trim();
  }).filter(item => item !== ''); // Remove empty items
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

/**
 * Parse a date string and return a valid Date or null
 */
function parseDate(dateStr: string): Date | null {
  try {
    // First try standard date parsing
    let date = new Date(dateStr)
    
    // If that fails, try to manually parse the Hard Rock format
    if (isNaN(date.getTime())) {
      // Handle D MMM YYYY @ H:MMam/pm format
      const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+@\s+(\d{1,2}):(\d{2})([ap]m)/i)
      if (match) {
        const [_, day, month, year, hour, minute, ampm] = match
        
        // Convert month to number
        const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 
                        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 }
        
        const monthNum = months[month as keyof typeof months] || 0
        
        // Convert 12-hour to 24-hour
        let hours = parseInt(hour)
        if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12
        if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0
        
        date = new Date(parseInt(year), monthNum, parseInt(day), hours, parseInt(minute))
      }
    }
    
    return isValidDate(date) ? date : null
  } catch (e) {
    console.error("Date parsing error:", e, "for string:", dateStr)
    return null
  }
}

/**
 * Check if a value matches the date format: D MMM YYYY @ H:MMam/pm
 */
function isDate(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  
  // Common date formats from Hard Rock
  const datePatterns = [
    /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+@\s+\d{1,2}:\d{2}(?:am|pm)/i,  // 12 Jan 2023 @ 4:30pm
    /\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(?:am|pm)?/i,      // 01/12/23 4:30 PM
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/                                // 2023-01-12T16:30
  ]
  
  return datePatterns.some(pattern => pattern.test(value))
}

/**
 * Check if a value is a 19-digit bet ID
 */
function isBetId(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  return /^\d{19}$/.test(value.trim())
}