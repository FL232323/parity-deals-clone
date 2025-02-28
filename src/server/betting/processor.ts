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
import { extractBettingData } from './extract-data'

type RawBettingRow = string[][]

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
    
    // Step 2: Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Track if we're using XML parsing or regular sheet parsing
    let usingXmlParsing = false
    
    // Step 3: Try to extract data as rows (preserving row structure)
    let rawRows: RawBettingRow = []
    
    // First attempt: use sheet_to_json to get rows with header mapping
    try {
      console.log("Attempting to parse sheet normally")
      // Convert sheet to array of arrays (each row as an array of values)
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][]
      
      // Filter out empty rows and process data
      rawRows = data.filter(row => row.some(cell => cell !== ""))
      console.log(`Parsed ${rawRows.length} rows from sheet`)
      
      // If we have less than 2 rows (header + at least 1 data row), try XML parsing
      if (rawRows.length < 2) {
        usingXmlParsing = true
      }
    } catch (e) {
      console.error("Error parsing sheet normally:", e)
      usingXmlParsing = true
    }
    
    // Fallback to XML parsing if normal parsing failed
    if (usingXmlParsing) {
      console.log("Falling back to XML parsing")
      
      try {
        // Get the raw XML content
        let rawXml = ''
        try {
          // Convert the sheet to CSV with line breaks to maintain row structure
          rawXml = XLSX.utils.sheet_to_csv(sheet, { FS: '|||', RS: '\n' })
        } catch (e) {
          console.error("Error getting sheet as CSV:", e)
          // Try again with direct access to the file data
          rawXml = fileBuffer.toString('utf-8')
        }
        
        // Extract rows using XML structure pattern matching
        const rows: string[][] = []
        let currentRow: string[] = []
        
        // Extract rows by finding <ss:Row> tags
        const rowRegex = /<ss:Row[^>]*>(.*?)<\/ss:Row>/gs
        let rowMatch
        
        while ((rowMatch = rowRegex.exec(rawXml)) !== null) {
          const rowContent = rowMatch[1]
          currentRow = []
          
          // Extract cells from each row
          const cellRegex = /<ss:Cell[^>]*>.*?<ss:Data[^>]*>(.*?)<\/ss:Data>.*?<\/ss:Cell>/gs
          let cellMatch
          
          while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            // Add cell value to current row
            if (cellMatch[1]) {
              currentRow.push(cellMatch[1].trim())
            } else {
              currentRow.push("")
            }
          }
          
          // If we found any cells, add the row
          if (currentRow.length > 0) {
            rows.push([...currentRow])
          }
        }
        
        // If we didn't find any rows with the XML structure, try simple line parsing
        if (rows.length === 0) {
          console.log("XML structure not found, trying line-based parsing")
          
          // Split into lines
          const lines = rawXml.split('\n')
          
          // Process each line
          for (const line of lines) {
            // Skip empty lines
            if (line.trim() === '') continue
            
            // Split row into cells using the delimiter
            const cells = line.split('|||')
            
            // If we have cells, add as a row
            if (cells.length > 0 && cells.some(cell => cell.trim() !== '')) {
              rows.push(cells.map(cell => cell.trim()))
            }
          }
        }
        
        // Use the rows parsed from XML
        rawRows = rows
        console.log(`Parsed ${rawRows.length} rows from XML structure`)
      } catch (e) {
        console.error("Error with XML parsing fallback:", e)
      }
    }
    
    // If we still don't have rows, try cell by cell extraction as a last resort
    if (rawRows.length === 0) {
      console.log("Trying cell-by-cell extraction")
      
      // Get all cell references
      const cellRefs = Object.keys(sheet).filter(key => !key.startsWith('!'))
      
      // Group cells by row
      const rowMap = new Map<number, Map<number, string>>()
      
      for (const cellRef of cellRefs) {
        // Parse cell reference (e.g., "A1" -> row 1, col 0)
        const colMatch = cellRef.match(/[A-Z]+/)
        const rowMatch = cellRef.match(/\d+/)
        
        if (colMatch && rowMatch) {
          // Convert column letter to number (A=0, B=1, etc.)
          const colStr = colMatch[0]
          let colNum = 0
          for (let i = 0; i < colStr.length; i++) {
            colNum = colNum * 26 + (colStr.charCodeAt(i) - 64)
          }
          colNum-- // Adjust to 0-indexed
          
          // Get row number (1-indexed in Excel)
          const rowNum = parseInt(rowMatch[0])
          
          // Get cell value
          const cell = sheet[cellRef]
          if (cell && cell.v !== undefined && cell.v !== null) {
            // Create row map if it doesn't exist
            if (!rowMap.has(rowNum)) {
              rowMap.set(rowNum, new Map<number, string>())
            }
            
            // Add cell to row
            rowMap.get(rowNum)!.set(colNum, String(cell.v))
          }
        }
      }
      
      // Convert to array of rows
      const rows: string[][] = []
      
      // Sort rows by row number
      const sortedRowNums = Array.from(rowMap.keys()).sort((a, b) => a - b)
      
      for (const rowNum of sortedRowNums) {
        const rowMap2 = rowMap.get(rowNum)!
        const rowArray: string[] = []
        
        // Sort cells by column number
        const sortedColNums = Array.from(rowMap2.keys()).sort((a, b) => a - b)
        
        // Fill in any gaps in columns
        let maxCol = sortedColNums[sortedColNums.length - 1] || 0
        for (let col = 0; col <= maxCol; col++) {
          rowArray.push(rowMap2.get(col) || "")
        }
        
        rows.push(rowArray)
      }
      
      rawRows = rows
      console.log(`Extracted ${rawRows.length} rows cell by cell`)
    }
    
    // Final check: do we have any data?
    if (rawRows.length === 0) {
      throw new Error("Failed to extract any data from the file")
    }
    
    // Process the rows
    console.log("Sample rows:", rawRows.slice(0, 3))
    
    // Check for headers in the first row
    let startRowIndex = 0
    let hasHeaders = false
    
    // If first row contains keywords like "Date Placed", "Status", "League", etc.
    // then consider it as a header row
    if (rawRows.length > 0) {
      const firstRow = rawRows[0].map(cell => (cell || "").toString().toLowerCase())
      if (
        firstRow.some(cell => 
          cell.includes("date") || 
          cell.includes("status") || 
          cell.includes("league") || 
          cell.includes("match")
        )
      ) {
        hasHeaders = true
        startRowIndex = 1
        console.log("Header row detected, starting from row 1")
      }
    }
    
    // Filter to data rows only
    const dataRows = rawRows.slice(startRowIndex)
    
    // Process the data using the improved extraction with rows instead of flat array
    const {
      singleBets,
      parlayHeaders,
      parlayLegs,
      teamStats,
      playerStats,
      propStats
    } = extractBettingData(dataRows, userId)

    console.log(`Extracted: ${singleBets.length} single bets, ${parlayHeaders.length} parlays with ${parlayLegs.length} legs`)

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