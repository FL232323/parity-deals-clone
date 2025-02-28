/**
 * Extract betting data from raw string array
 * @param data Raw betting data as string array
 * @param userId User ID
 * @returns Extracted betting data objects
 */
export function extractBettingData(data: string[], userId: string) {
  const singleBets: any[] = []
  const parlayHeaders: any[] = []
  const parlayLegs: any[] = []
  const teamStatsMap = new Map<string, any>()
  const playerStatsMap = new Map<string, any>()
  const propStatsMap = new Map<string, any>()
  
  let currentPosition = 0
  
  // Log the first 10 items of data for debugging
  console.log("First 10 items of preprocessed data:", data.slice(0, 10))
  
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
  
  /**
   * Count number of legs based on commas in match field
   */
  function countLegs(matchStr?: string): number {
    if (!matchStr) return 0
    
    // Count commas and add 1 (assuming format is "Team A vs Team B, Team C vs Team D, ...")
    const commaCount = (matchStr.match(/,/g) || []).length
    
    // If we have no commas but have a match, there's at least 1 leg
    if (commaCount === 0 && matchStr.trim() !== '') {
      return 1
    }
    
    // In the observed format, each match has a comma after it (including the last one sometimes)
    // This pattern suggests each comma represents one match/leg
    return commaCount
  }

  // Enhanced parsing logic for Hard Rock Bet export format
  while (currentPosition < data.length) {
    // Skip empty values
    if (!data[currentPosition] || data[currentPosition].trim() === '') {
      currentPosition++
      continue
    }
    
    // Detect if this is a new bet by checking for date pattern
    // Only parlay headers and single bets start with a date
    const currValue = data[currentPosition]
    
    if (isDate(currValue)) {
      // Log the potential bet start for debugging
      console.log(`Found potential bet start at position ${currentPosition}: ${currValue}`)
      
      // Make sure we have at least 12 more items for a complete bet (13 total columns)
      if (currentPosition + 12 >= data.length) {
        console.log("Not enough data remaining for a complete bet, skipping")
        currentPosition++
        continue
      }
      
      // Collect the next 13 values as a bet (exactly matching the column count)
      const betFields = []
      for (let i = 0; i < 13 && currentPosition + i < data.length; i++) {
        betFields.push(data[currentPosition + i])
      }
      
      // Move position past this bet
      currentPosition += 13
      
      // Check if this is a parlay by looking for MULTIPLE in the bet type
      const isBetMultiple = betFields[4] === "MULTIPLE"
      
      if (isBetMultiple) {
        console.log("Parsing a parlay bet")
        
        // Create the parlay header
        const betId = betFields[12]
        const parlayHeader = {
          userId,
          datePlaced: parseDate(betFields[0]),
          status: betFields[1],
          league: betFields[2],
          match: betFields[3],
          betType: betFields[4],
          market: betFields[5],
          price: betFields[6] ? parseFloat(betFields[6]) : undefined,
          wager: betFields[7] ? parseFloat(betFields[7]) : undefined,
          winnings: betFields[8] ? parseFloat(betFields[8]) : undefined,
          payout: betFields[9] ? parseFloat(betFields[9]) : undefined,
          potentialPayout: betFields[10] ? parseFloat(betFields[10]) : undefined,
          result: betFields[11],
          betSlipId: betId
        }
        
        console.log("Created parlay header:", { 
          id: betId, 
          match: parlayHeader.match,
          wager: parlayHeader.wager,
          potentialPayout: parlayHeader.potentialPayout
        })
        
        parlayHeaders.push(parlayHeader)
        
        // Count the number of legs based on commas in the match field
        const numLegs = countLegs(parlayHeader.match)
        console.log(`Parlay has ${numLegs} legs based on match field`)
        
        // Process all legs for this parlay
        let legsProcessed = 0
        
        while (legsProcessed < numLegs && currentPosition + 6 < data.length) {
          // Skip empty values
          if (!data[currentPosition] || data[currentPosition].trim() === '') {
            currentPosition++
            continue
          }
          
          // If we hit another date that's not a game date (has @ symbol), we're likely at the next bet
          if (isDate(data[currentPosition]) && data[currentPosition].includes('@')) {
            console.log("Hit next bet date while processing legs, breaking")
            break
          }
          
          // The structure of a leg should be:
          // Status, League, Match, Market, Selection, Price, GameDate
          const legFields = []
          for (let i = 0; i < 7 && currentPosition + i < data.length; i++) {
            legFields.push(data[currentPosition + i])
          }
          
          // Move position past this leg
          currentPosition += 7
          
          // Make sure we have enough data for a valid leg
          if (legFields.length < 7 || !legFields[0] || legFields[0].trim() === '') {
            console.log("Invalid leg data, skipping:", legFields)
            continue
          }
          
          const legNumber = legsProcessed + 1
          console.log(`Processing leg ${legNumber}:`, legFields.slice(0, 3))
          
          const parlayLeg = {
            parlayId: betId,
            legNumber: legNumber,
            status: legFields[0],
            league: legFields[1],
            match: legFields[2],
            market: legFields[3],
            selection: legFields[4],
            price: legFields[5] ? parseFloat(legFields[5]) : undefined,
            gameDate: legFields[6] ? parseDate(legFields[6]) : null
          }
          
          parlayLegs.push(parlayLeg)
          
          // Process team stats from this leg
          const teams = extractTeams(parlayLeg.match)
          teams.forEach(team => {
            if (!team || team.trim() === '') return
            
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
            
            const status = parlayLeg.status.toLowerCase()
            if (status.includes('win')) {
              stat.wins++
            } else if (status.includes('lose') || status.includes('lost')) {
              stat.losses++
            } else if (status.includes('push')) {
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
            
            const status = parlayLeg.status.toLowerCase()
            if (status.includes('win')) {
              stat.wins++
            } else if (status.includes('lose') || status.includes('lost')) {
              stat.losses++
            } else if (status.includes('push')) {
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
            
            const status = parlayLeg.status.toLowerCase()
            if (status.includes('win')) {
              stat.wins++
            } else if (status.includes('lose') || status.includes('lost')) {
              stat.losses++
            } else if (status.includes('push')) {
              stat.pushes++
            } else {
              stat.pending++
            }
          }
          
          legsProcessed++
        }
      } else {
        console.log("Parsing a single bet")
        
        // This is a single bet
        const betId = betFields[12]
        
        const singleBet = {
          userId,
          datePlaced: parseDate(betFields[0]),
          status: betFields[1],
          league: betFields[2],
          match: betFields[3],
          betType: betFields[4],
          market: betFields[5],
          price: betFields[6] ? parseFloat(betFields[6]) : undefined,
          wager: betFields[7] ? parseFloat(betFields[7]) : undefined,
          winnings: betFields[8] ? parseFloat(betFields[8]) : undefined,
          payout: betFields[9] ? parseFloat(betFields[9]) : undefined,
          result: betFields[11],
          betSlipId: betId
        }
        
        console.log("Created single bet:", { 
          id: betId, 
          match: singleBet.match,
          wager: singleBet.wager,
          winnings: singleBet.winnings
        })
        
        singleBets.push(singleBet)
        
        // Process team stats from this single bet
        const teams = extractTeams(singleBet.match)
        teams.forEach(team => {
          if (!team || team.trim() === '') return
          
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
          
          const result = singleBet.result.toLowerCase()
          if (result.includes('won') || result.includes('win')) {
            stat.wins++
          } else if (result.includes('lost') || result.includes('lose')) {
            stat.losses++
          } else if (result.includes('push')) {
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
          
          const result = singleBet.result.toLowerCase()
          if (result.includes('won') || result.includes('win')) {
            stat.wins++
          } else if (result.includes('lost') || result.includes('lose')) {
            stat.losses++
          } else if (result.includes('push')) {
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
          
          const result = singleBet.result.toLowerCase()
          if (result.includes('won') || result.includes('win')) {
            stat.wins++
          } else if (result.includes('lost') || result.includes('lose')) {
            stat.losses++
          } else if (result.includes('push')) {
            stat.pushes++
          } else {
            stat.pending++
          }
        }
      }
    } else {
      // Not a date, move to the next value
      currentPosition++
    }
  }
  
  console.log(`Extracted ${singleBets.length} single bets and ${parlayHeaders.length} parlays with ${parlayLegs.length} legs`)
  
  return {
    singleBets,
    parlayHeaders,
    parlayLegs,
    teamStats: Array.from(teamStatsMap.values()),
    playerStats: Array.from(playerStatsMap.values()),
    propStats: Array.from(propStatsMap.values())
  }
}

/**
 * Check if a value matches a date format
 */
function isDate(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  
  // Common date formats from Hard Rock
  const datePatterns = [
    /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+@\s+\d{1,2}:\d{2}(?:am|pm)/i,  // 9 Feb 2025 @ 4:08pm
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

/**
 * Parse a date string and return a Date or null
 */
function parseDate(dateStr: string): Date | null {
  try {
    if (!dateStr || typeof dateStr !== 'string') {
      return null
    }
    
    // First try standard date parsing
    let date = new Date(dateStr)
    
    // If that fails, try to manually parse the Hard Rock format
    if (isNaN(date.getTime())) {
      // Handle D MMM YYYY @ H:MMam/pm format (e.g., "9 Feb 2025 @ 4:08pm")
      const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+@\s+(\d{1,2}):(\d{2})([ap]m)/i)
      
      if (match) {
        const [_, day, month, year, hour, minute, ampm] = match
        
        // Convert month to number
        const months = { 
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 
        }
        
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
 * Check if a date is valid
 */
function isValidDate(date: any): boolean {
  if (!date) return false
  if (!(date instanceof Date)) return false
  return !isNaN(date.getTime())
}