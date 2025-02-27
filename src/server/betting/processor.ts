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
    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { cellDates: true })
    
    // Extract raw data from the first worksheet
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 })
    
    // Convert to array of strings to match the python processor format
    const rawData: RawBettingData = []
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

    // Process the data
    const {
      singleBets,
      parlayHeaders,
      parlayLegs,
      teamStats,
      playerStats,
      propStats
    } = extractBettingData(rawData, userId)

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
    const date = new Date(dateStr)
    return isValidDate(date) ? date : null
  } catch (e) {
    return null
  }
}

/**
 * Extract betting data from raw string array
 * @param data Raw betting data as string array
 * @param userId User ID
 * @returns Extracted betting data objects
 */
function extractBettingData(data: RawBettingData, userId: string) {
  // Headers are the first 13 elements
  const headers = data.slice(0, 13)
  
  const singleBets: SingleBet[] = []
  const parlayHeaders: ParlayHeader[] = []
  const parlayLegs: ParlayLeg[] = []
  const teamStatsMap = new Map<string, TeamStat>()
  const playerStatsMap = new Map<string, PlayerStat>()
  const propStatsMap = new Map<string, PropStat>()
  
  let currentPosition = 13
  
  /**
   * Check if a value matches the date format: D MMM YYYY @ H:MMam/pm
   */
  function isDate(value: string): boolean {
    const datePattern = /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+@\s+\d{1,2}:\d{2}(?:am|pm)/
    return datePattern.test(value)
  }
  
  /**
   * Check if a value is a 19-digit bet ID
   */
  function isBetId(value: string): boolean {
    return /^\d{19}$/.test(value.trim())
  }
  
  /**
   * Extract teams from match string
   */
  function extractTeams(matchStr?: string): string[] {
    if (!matchStr) return []
    
    const trimmed = matchStr.trim()
    if (trimmed.includes(' vs ')) {
      return trimmed.split(' vs ').map(team => team.trim())
    }
    return []
  }
  
  /**
   * Extract player name and prop type from market string
   */
  function extractPlayerAndProp(marketStr?: string): [string | null, string | null] {
    if (!marketStr) return [null, null]
    
    if (marketStr.includes(' - ')) {
      const parts = marketStr.split(' - ', 2)
      const player = parts[0].trim()
      const propType = parts.length > 1 ? parts[1].trim() : null
      return [player, propType]
    }
    return [null, null]
  }

  // Parse through the data in the same pattern as the Python processor
  while (currentPosition < data.length) {
    const currValue = data[currentPosition]
    
    if (isDate(currValue)) {
      // This could be the start of a bet
      const betInfo = data.slice(currentPosition, currentPosition + 13)
      currentPosition += 13
      
      if (currentPosition >= data.length) break
      
      if (betInfo.some(item => item.includes("MULTIPLE"))) {
        // This is a parlay
        let betId: string | undefined
        
        if (currentPosition < data.length && isBetId(data[currentPosition])) {
          betId = data[currentPosition]
          currentPosition += 1
        } else {
          betId = betInfo[betInfo.length - 1]
        }
        
        const parlayHeader: ParlayHeader = {
          userId,
          datePlaced: isDate(betInfo[0]) ? parseDate(betInfo[0]) : null,
          status: betInfo[1],
          league: betInfo[2],
          match: betInfo[3],
          betType: betInfo[4],
          market: betInfo[5],
          selection: betInfo[6],
          price: betInfo[7] ? parseFloat(betInfo[7]) : undefined,
          wager: betInfo[8] ? parseFloat(betInfo[8]) : undefined,
          winnings: betInfo[9] ? parseFloat(betInfo[9]) : undefined,
          payout: betInfo[10] ? parseFloat(betInfo[10]) : undefined,
          potentialPayout: betInfo[11] ? parseFloat(betInfo[11]) : undefined,
          result: betInfo[12],
          betSlipId: betId
        }
        
        parlayHeaders.push(parlayHeader)
        
        // Count the number of legs by checking for commas in the match field
        const numLegs = parlayHeader.match ? 
          (parlayHeader.match.match(/,/g) || []).length + 1 : 0
        
        // Process parlay legs
        let legNum = 1
        while (legNum <= numLegs && currentPosition + 7 <= data.length) {
          const legData = data.slice(currentPosition, currentPosition + 7)
          
          if (isDate(legData[0])) {
            break
          }
          
          const parlayLeg: ParlayLeg = {
            parlayId: betId || "",
            legNumber: legNum,
            status: legData[0],
            league: legData[1],
            match: legData[2],
            market: legData[3],
            selection: legData[4],
            price: legData[5] ? parseFloat(legData[5]) : undefined,
            gameDate: isDate(legData[6]) ? parseDate(legData[6]) : null
          }
          
          parlayLegs.push(parlayLeg)
          
          // Process team stats from this leg
          const teams = extractTeams(parlayLeg.match)
          teams.forEach(team => {
            if (!teamStatsMap.has(team)) {
              teamStatsMap.set(team, {
                userId,
                team,
                league: parlayLeg.league,
                totalBets: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                pending: 0
              })
            }
            
            const stat = teamStatsMap.get(team)!
            stat.totalBets++
            
            if (parlayLeg.status === 'Won' || parlayLeg.status === 'Win') {
              stat.wins++
            } else if (parlayLeg.status === 'Lost' || parlayLeg.status === 'Lose') {
              stat.losses++
            } else if (parlayLeg.status === 'Push') {
              stat.pushes++
            } else {
              stat.pending++
            }
          })
          
          // Process player and prop stats
          const [player, propType] = extractPlayerAndProp(parlayLeg.market)
          if (player) {
            if (!playerStatsMap.has(player)) {
              playerStatsMap.set(player, {
                userId,
                player,
                propTypes: propType ? [propType] : [],
                totalBets: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                pending: 0
              })
            }
            
            const stat = playerStatsMap.get(player)!
            stat.totalBets++
            
            if (propType && !stat.propTypes?.includes(propType)) {
              stat.propTypes = [...(stat.propTypes || []), propType]
            }
            
            if (parlayLeg.status === 'Won' || parlayLeg.status === 'Win') {
              stat.wins++
            } else if (parlayLeg.status === 'Lost' || parlayLeg.status === 'Lose') {
              stat.losses++
            } else if (parlayLeg.status === 'Push') {
              stat.pushes++
            } else {
              stat.pending++
            }
          }
          
          if (propType) {
            if (!propStatsMap.has(propType)) {
              propStatsMap.set(propType, {
                userId,
                propType,
                totalBets: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                pending: 0
              })
            }
            
            const stat = propStatsMap.get(propType)!
            stat.totalBets++
            
            if (parlayLeg.status === 'Won' || parlayLeg.status === 'Win') {
              stat.wins++
            } else if (parlayLeg.status === 'Lost' || parlayLeg.status === 'Lose') {
              stat.losses++
            } else if (parlayLeg.status === 'Push') {
              stat.pushes++
            } else {
              stat.pending++
            }
          }
          
          currentPosition += 7
          legNum++
        }
      } else {
        // This is a single bet
        const singleBet: SingleBet = {
          userId,
          datePlaced: isDate(betInfo[0]) ? parseDate(betInfo[0]) : null,
          status: betInfo[1],
          league: betInfo[2],
          match: betInfo[3],
          betType: betInfo[4],
          market: betInfo[5],
          selection: betInfo[6],
          price: betInfo[7] ? parseFloat(betInfo[7]) : undefined,
          wager: betInfo[8] ? parseFloat(betInfo[8]) : undefined,
          winnings: betInfo[9] ? parseFloat(betInfo[9]) : undefined,
          payout: betInfo[10] ? parseFloat(betInfo[10]) : undefined,
          result: betInfo[12],
          betSlipId: betInfo[betInfo.length - 1]
        }
        
        singleBets.push(singleBet)
        
        // Process team stats from this single bet
        const teams = extractTeams(singleBet.match)
        teams.forEach(team => {
          if (!teamStatsMap.has(team)) {
            teamStatsMap.set(team, {
              userId,
              team,
              league: singleBet.league,
              totalBets: 0,
              wins: 0,
              losses: 0,
              pushes: 0,
              pending: 0
            })
          }
          
          const stat = teamStatsMap.get(team)!
          stat.totalBets++
          
          if (singleBet.result === 'Won' || singleBet.result === 'Win') {
            stat.wins++
          } else if (singleBet.result === 'Lost' || singleBet.result === 'Lose') {
            stat.losses++
          } else if (singleBet.result === 'Push') {
            stat.pushes++
          } else {
            stat.pending++
          }
        })
        
        // Process player and prop stats
        const [player, propType] = extractPlayerAndProp(singleBet.market)
        if (player) {
          if (!playerStatsMap.has(player)) {
            playerStatsMap.set(player, {
              userId,
              player,
              propTypes: propType ? [propType] : [],
              totalBets: 0,
              wins: 0,
              losses: 0,
              pushes: 0,
              pending: 0
            })
          }
          
          const stat = playerStatsMap.get(player)!
          stat.totalBets++
          
          if (propType && !stat.propTypes?.includes(propType)) {
            stat.propTypes = [...(stat.propTypes || []), propType]
          }
          
          if (singleBet.result === 'Won' || singleBet.result === 'Win') {
            stat.wins++
          } else if (singleBet.result === 'Lost' || singleBet.result === 'Lose') {
            stat.losses++
          } else if (singleBet.result === 'Push') {
            stat.pushes++
          } else {
            stat.pending++
          }
        }
        
        if (propType) {
          if (!propStatsMap.has(propType)) {
            propStatsMap.set(propType, {
              userId,
              propType,
              totalBets: 0,
              wins: 0,
              losses: 0,
              pushes: 0,
              pending: 0
            })
          }
          
          const stat = propStatsMap.get(propType)!
          stat.totalBets++
          
          if (singleBet.result === 'Won' || singleBet.result === 'Win') {
            stat.wins++
          } else if (singleBet.result === 'Lost' || singleBet.result === 'Lose') {
            stat.losses++
          } else if (singleBet.result === 'Push') {
            stat.pushes++
          } else {
            stat.pending++
          }
        }
      }
    } else {
      currentPosition++
    }
  }
  
  return {
    singleBets,
    parlayHeaders,
    parlayLegs,
    teamStats: Array.from(teamStatsMap.values()),
    playerStats: Array.from(playerStatsMap.values()),
    propStats: Array.from(propStatsMap.values())
  }
}
