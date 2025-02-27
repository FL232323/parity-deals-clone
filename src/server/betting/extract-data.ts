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
    return (matchStr.match(/,/g) || []).length + 1
  }

  // Parse through the data to find bets
  while (currentPosition < data.length) {
    const currValue = data[currentPosition]
    
    // Skip empty values
    if (!currValue || currValue.trim() === '') {
      currentPosition++
      continue
    }
    
    if (isDate(currValue)) {
      console.log("Found potential bet start at position", currentPosition, "value:", currValue)
      
      // Make sure we have enough data for a complete bet entry (minimum 12 fields)
      if (currentPosition + 12 >= data.length) {
        currentPosition++
        continue
      }
      
      // This could be the start of a bet - grab the next 13 fields
      const betInfo = []
      let i = 0
      let skip = false
      
      // Collect bet information, possibly skipping empty values
      while (betInfo.length < 13 && currentPosition + i < data.length) {
        const val = data[currentPosition + i]
        
        // Skip repeated date fields that might appear
        if (betInfo.length > 0 && isDate(val) && isDate(betInfo[0])) {
          skip = true
          break
        }
        
        betInfo.push(val)
        i++
      }
      
      // If we need to skip, continue to next value
      if (skip) {
        currentPosition++
        continue
      }
      
      currentPosition += i
      
      // Check if this is a parlay by looking for "MULTIPLE" in the bet type field (usually 4th field)
      const betTypeIdx = Math.min(4, betInfo.length - 1)
      const isBetMultiple = betInfo.some(item => 
        item && typeof item === 'string' && item.includes("MULTIPLE")
      )
      
      if (isBetMultiple) {
        console.log("Parsing a parlay bet")
        
        // This is a parlay
        let betId: string | undefined
        
        // Try to find the bet ID - it's either the next value after the bet info
        // or potentially the last value in bet info if it's a 19-digit number
        if (currentPosition < data.length && isBetId(data[currentPosition])) {
          betId = data[currentPosition]
          currentPosition++
        } else {
          // Look for a bet ID in the bet info
          for (let j = betInfo.length - 1; j >= 0; j--) {
            if (isBetId(betInfo[j])) {
              betId = betInfo[j]
              break
            }
          }
          
          // If we still don't have a bet ID, generate one
          if (!betId) {
            betId = `${Date.now()}${Math.floor(Math.random() * 1000)}`.padEnd(19, '0')
            console.log("Generated a bet ID:", betId)
          }
        }
        
        console.log("Parlay bet ID:", betId)
        
        // Create the parlay header
        const parlayHeader = {
          userId,
          datePlaced: parseDate(betInfo[0]),
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
        
        // Count the number of legs based on commas in the match field
        const numLegs = countLegs(parlayHeader.match)
        console.log(`Parlay has ${numLegs} legs based on match field:`, parlayHeader.match)
        
        // Process parlay legs
        let legNum = 1
        let legsProcessed = 0
        
        while (legNum <= numLegs && currentPosition + 6 < data.length && legsProcessed < numLegs) {
          // Skip empty values
          if (!data[currentPosition] || data[currentPosition].trim() === '') {
            currentPosition++
            continue
          }
          
          // If we hit another date, we're likely at the next bet, so break
          if (isDate(data[currentPosition])) {
            console.log("Hit next date while processing legs, breaking")
            break
          }
          
          // Try to capture leg data - should be 7 fields
          const legData = []
          let j = 0
          
          while (legData.length < 7 && currentPosition + j < data.length) {
            const val = data[currentPosition + j]
            
            // Skip empty values
            if (!val || val.trim() === '') {
              j++
              continue
            }
            
            // If we hit a date, we might be at the next bet
            if (legData.length > 0 && isDate(val)) {
              break
            }
            
            legData.push(val)
            j++
          }
          
          // Move position forward
          currentPosition += j
          
          // Check if we have enough data for a leg
          if (legData.length < 5) {
            console.log("Not enough data for leg, skipping")
            continue
          }
          
          console.log(`Processing leg ${legNum}`, legData)
          
          const parlayLeg = {
            parlayId: betId || "",
            legNumber: legNum,
            status: legData[0],
            league: legData[1],
            match: legData[2],
            market: legData[3],
            selection: legData[4],
            price: legData[5] ? parseFloat(legData[5]) : undefined,
            gameDate: legData[6] ? parseDate(legData[6]) : null
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
          
          legNum++
          legsProcessed++
        }
      } else {
        console.log("Parsing a single bet")
        
        // This is a single bet
        let betId: string | undefined
        
        // Try to find the bet ID - check for 19-digit number in bet info or next value
        if (currentPosition < data.length && isBetId(data[currentPosition])) {
          betId = data[currentPosition]
          currentPosition++
        } else {
          // Look for bet ID in the bet info
          for (let j = betInfo.length - 1; j >= 0; j--) {
            if (isBetId(betInfo[j])) {
              betId = betInfo[j]
              break
            }
          }
          
          // If no bet ID found, generate one
          if (!betId) {
            betId = `${Date.now()}${Math.floor(Math.random() * 1000)}`.padEnd(19, '0')
            console.log("Generated single bet ID:", betId)
          }
        }
        
        console.log("Single bet ID:", betId)
        
        const singleBet = {
          userId,
          datePlaced: parseDate(betInfo[0]),
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
          betSlipId: betId
        }
        
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

/**
 * Parse a date string and return a Date or null
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
 * Check if a date is valid
 */
function isValidDate(date: any): boolean {
  if (!date) return false
  if (!(date instanceof Date)) return false
  return !isNaN(date.getTime())
}