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
import { parseXMLBettingData } from './xml-parser'

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
 * Detect file type from buffer
 * @param fileBuffer The file buffer to analyze
 * @returns The detected file type
 */
function detectFileType(fileBuffer: Buffer): 'xml' | 'excel' | 'csv' | 'unknown' {
  // Check for XML signature at the beginning of the file
  const signature = fileBuffer.toString('utf8', 0, 256);
  
  if (signature.includes('<?xml') || 
      signature.includes('<ss:Workbook') || 
      signature.includes('<x:xmpmeta')) {
    return 'xml';
  }
  
  // Check Excel magic number (first 8 bytes of .xls and .xlsx files)
  const excelSignatures = [
    // .xls (BIFF) format
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
    // .xlsx (OpenXML) format starts with PK (zip file)
    Buffer.from([0x50, 0x4B, 0x03, 0x04])
  ];
  
  for (const excelSig of excelSignatures) {
    if (fileBuffer.slice(0, excelSig.length).equals(excelSig)) {
      return 'excel';
    }
  }
  
  // Check for CSV (simple heuristic - count commas in first few lines)
  const firstLines = fileBuffer.toString('utf8', 0, 1000).split('\n').slice(0, 5);
  
  if (firstLines.length > 1) {
    const commasPerLine = firstLines.map(line => 
      (line.match(/,/g) || []).length
    );
    
    // If most lines have multiple commas and roughly the same number, it's likely CSV
    const avgCommas = commasPerLine.reduce((sum, count) => sum + count, 0) / commasPerLine.length;
    if (avgCommas > 3) {
      return 'csv';
    }
  }
  
  return 'unknown';
}

/**
 * Process a betting data file and store the extracted information
 * @param fileBuffer The uploaded file as a buffer
 * @param userId The user's ID
 * @returns Summary of processed data
 */
export async function processBettingData(fileBuffer: Buffer, userId: string) {
  try {
    // Detect file format
    const fileType = detectFileType(fileBuffer);
    console.log(`Detected file type: ${fileType}`);
    
    let extractedData: {
      singleBets: any[];
      parlayHeaders: any[];
      parlayLegs: any[];
      teamStats: any[];
      playerStats: any[];
      propStats: any[];
    };
    
    // Process based on file type
    if (fileType === 'xml') {
      console.log("Using XML parser for betting data");
      // For XML files, use the dedicated XML parser
      extractedData = parseXMLBettingData(fileBuffer.toString('utf8'), userId);
    } else {
      // For Excel or other formats, use the XLSX library with fallbacks
      console.log(`Using XLSX parser with fallbacks for ${fileType} format`);
      
      // Step 1: Parse the Excel file with full options to handle different formats
      const workbook = XLSX.read(fileBuffer, {
        cellDates: true,
        cellStyles: true,
        cellNF: true,
        type: 'buffer',
        WTF: true // Parse everything possible
      });

      console.log("Workbook parsed successfully, sheets:", workbook.SheetNames);
      
      // Check if we have sheets
      if (workbook.SheetNames.length === 0) {
        throw new Error("No sheets found in the workbook");
      }
      
      // Step 2: Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Step 3: Extract data as rows (preserving row structure)
      let rawRows: RawBettingRow = [];
      
      // Try multiple parsing approaches in order of reliability
      try {
        console.log("Attempting to parse sheet as rows");
        
        // Attempt 1: Using sheet_to_json with header:1 option to get rows
        const dataRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
        
        if (dataRows && dataRows.length > 0) {
          // Filter out completely empty rows
          rawRows = dataRows.filter(row => row.some(cell => cell !== ""));
          console.log(`Parsed ${rawRows.length} rows from sheet with sheet_to_json`);
        } 
        else {
          // Attempt 2: Using sheet_to_csv to get raw text and then parse
          console.log("sheet_to_json yielded no rows, trying sheet_to_csv");
          const csv = XLSX.utils.sheet_to_csv(sheet);
          const lines = csv.split('\n');
          
          rawRows = lines
            .map(line => line.split(','))
            .filter(row => row.some(cell => cell && cell.trim() !== ""));
          
          console.log(`Parsed ${rawRows.length} rows from sheet with sheet_to_csv`);
        }
        
        // If still no rows, try direct cell access
        if (!rawRows || rawRows.length === 0) {
          console.log("Still no rows, trying direct cell access");
          rawRows = extractRowsFromCells(sheet);
          console.log(`Parsed ${rawRows.length} rows from direct cell access`);
        }
      } 
      catch (e) {
        console.error("Error parsing sheet:", e);
        // Fall back to direct cell access
        rawRows = extractRowsFromCells(sheet);
        console.log(`Fell back to direct cell access, got ${rawRows.length} rows`);
      }
      
      // If we still don't have any rows, try parsing XML content as a last resort
      if (!rawRows || rawRows.length === 0) {
        console.log("No rows found, trying XML parsing as last resort");
        rawRows = extractRowsFromXML(fileBuffer.toString());
        console.log(`XML parsing got ${rawRows.length} rows`);
      }
      
      // Final check: do we have any data?
      if (!rawRows || rawRows.length === 0) {
        throw new Error("Failed to extract any data from the file");
      }
      
      // Log a sample of the rows for debugging
      console.log("Sample rows:", rawRows.slice(0, 3));
      
      // Process the data using the extraction logic
      extractedData = extractBettingData(rawRows, userId);
    }

    console.log(`Extracted: ${extractedData.singleBets.length} single bets, ${extractedData.parlayHeaders.length} parlays with ${extractedData.parlayLegs.length} legs`);

    // Store in database without using transactions (Neon HTTP driver doesn't support them)
    // Store single bets
    if (extractedData.singleBets.length > 0) {
      console.log("Storing single bets:", extractedData.singleBets.length);
      await db.insert(SingleBetsTable).values(extractedData.singleBets);
    }

    // Store parlay headers and legs
    if (extractedData.parlayHeaders.length > 0) {
      console.log("Storing parlay headers:", extractedData.parlayHeaders.length);
      
      for (const parlayHeader of extractedData.parlayHeaders) {
        const [inserted] = await db.insert(ParlayHeadersTable)
          .values(parlayHeader)
          .returning({ id: ParlayHeadersTable.id });

        // Find corresponding legs
        const legs = extractedData.parlayLegs.filter(leg => leg.parlayId === parlayHeader.betSlipId);
        
        if (legs.length > 0 && inserted) {
          console.log(`Storing ${legs.length} legs for parlay ${inserted.id}`);
          
          // Update parlayId to use the database ID instead of betSlipId
          const legsWithCorrectId = legs.map(leg => ({
            ...leg,
            parlayId: inserted.id
          }));
          
          await db.insert(ParlayLegsTable).values(legsWithCorrectId);
        }
      }
    }

    // Store aggregated stats
    if (extractedData.teamStats.length > 0) {
      console.log("Storing team stats:", extractedData.teamStats.length);
      await db.insert(TeamStatsTable).values(extractedData.teamStats);
    }
    
    if (extractedData.playerStats.length > 0) {
      console.log("Storing player stats:", extractedData.playerStats.length);
      await db.insert(PlayerStatsTable).values(extractedData.playerStats);
    }
    
    if (extractedData.propStats.length > 0) {
      console.log("Storing prop stats:", extractedData.propStats.length);
      await db.insert(PropStatsTable).values(extractedData.propStats);
    }

    return {
      success: true,
      singleBetsCount: extractedData.singleBets.length,
      parlaysCount: extractedData.parlayHeaders.length,
      parlayLegsCount: extractedData.parlayLegs.length,
      teamStatsCount: extractedData.teamStats.length,
      playerStatsCount: extractedData.playerStats.length,
      propStatsCount: extractedData.propStats.length
    };
  } catch (error) {
    console.error("Error processing betting data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Extract rows from cells using raw cell references
 * This function is used as a fallback when other parsing methods fail
 */
function extractRowsFromCells(sheet: XLSX.WorkSheet): string[][] {
  // Get all cell references
  const cellRefs = Object.keys(sheet).filter(key => !key.startsWith('!'));
  
  // Group cells by row
  const rowMap = new Map<number, Map<number, string>>();
  
  for (const cellRef of cellRefs) {
    // Parse cell reference (e.g., "A1" -> row 1, col 0)
    const match = cellRef.match(/([A-Z]+)(\d+)/);
    if (!match) continue;
    
    const colStr = match[1];
    const rowNum = parseInt(match[2]);
    
    // Convert column letter to number (A=0, B=1, etc.)
    let colNum = 0;
    for (let i = 0; i < colStr.length; i++) {
      colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
    }
    colNum--; // Adjust to 0-indexed
    
    // Get cell value
    const cell = sheet[cellRef];
    if (cell) {
      let value = "";
      
      // Handle different cell types
      if (cell.t === 'd' && cell.v instanceof Date) {
        // Date value
        value = cell.v.toISOString();
      } else if (cell.v !== undefined && cell.v !== null) {
        // Regular value
        value = String(cell.v);
      }
      
      // Create row map if it doesn't exist
      if (!rowMap.has(rowNum)) {
        rowMap.set(rowNum, new Map<number, string>());
      }
      
      // Add cell to row
      rowMap.get(rowNum)!.set(colNum, value);
    }
  }
  
  // Convert to array of rows
  const rows: string[][] = [];
  
  // Sort rows by row number
  const sortedRowNums = Array.from(rowMap.keys()).sort((a, b) => a - b);
  
  for (const rowNum of sortedRowNums) {
    const rowMap2 = rowMap.get(rowNum)!;
    const rowArray: string[] = [];
    
    // Sort cells by column number
    const sortedColNums = Array.from(rowMap2.keys()).sort((a, b) => a - b);
    
    // Fill in any gaps in columns
    let maxCol = sortedColNums.length > 0 ? sortedColNums[sortedColNums.length - 1] : 0;
    for (let col = 0; col <= maxCol; col++) {
      rowArray.push(rowMap2.get(col) || "");
    }
    
    rows.push(rowArray);
  }
  
  return rows;
}

/**
 * Extract rows from XML structure using regex
 * This is used as a last-resort approach for files with XML structure
 */
function extractRowsFromXML(content: string): string[][] {
  const rows: string[][] = [];
  
  // Extract rows using regex for <ss:Row> tags
  const rowRegex = /<ss:Row[^>]*>(.*?)<\/ss:Row>/gs;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(content)) !== null) {
    const rowContent = rowMatch[1];
    const currentRow: string[] = [];
    
    // Extract cells from each row using regex for <ss:Data> tags
    const cellRegex = /<ss:Data[^>]*>(.*?)<\/ss:Data>/gs;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      // Add cell value to current row
      currentRow.push(cellMatch[1]?.trim() || "");
    }
    
    // Only add non-empty rows
    if (currentRow.length > 0 && currentRow.some(cell => cell !== "")) {
      rows.push(currentRow);
    }
  }
  
  // If XML parsing didn't work, try simple line-based parsing
  if (rows.length === 0) {
    // Look for data with common delimiters
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip empty lines
      if (line.trim() === '') continue;
      
      // Try different delimiters
      let cells: string[] = [];
      if (line.includes(',')) {
        cells = line.split(',');
      } else if (line.includes('\t')) {
        cells = line.split('\t');
      } else if (line.includes('|')) {
        cells = line.split('|');
      } else {
        // Just use the entire line as a single cell
        cells = [line];
      }
      
      // If we have cells with content, add as a row
      if (cells.length > 0 && cells.some(cell => cell.trim() !== '')) {
        rows.push(cells.map(cell => cell.trim()));
      }
    }
  }
  
  return rows;
}

/**
 * Check if a date is valid
 */
function isValidDate(date: any): boolean {
  if (!date) return false;
  if (!(date instanceof Date)) return false;
  return !isNaN(date.getTime());
}
