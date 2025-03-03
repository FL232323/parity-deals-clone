/**
 * Extract betting data from rows of data
 * @param rows Raw betting data as array of string arrays, each representing a row
 * @param userId User ID
 * @returns Extracted betting data objects
 */
export function extractBettingData(rows: string[][], userId: string) {
  const singleBets: any[] = []
  const parlayHeaders: any[] = []
  const parlayLegs: any[] = []
  const teamStatsMap = new Map<string, any>()
  const playerStatsMap = new Map<string, any>()
  const propStatsMap = new Map<string, any>()
  
  // Log a sample of rows for debugging
  console.log("Sample rows for processing:", rows.slice(0, 3))
  
  // Define expected column indexes - this helps with more reliable parsing
  const COL = {
    DATE: 0,
    STATUS: 1,
    LEAGUE: 2,
    MATCH: 3,
    BET_TYPE: 4,
    MARKET: 5,
    PRICE: 6,
    WAGER: 7,
    WINNINGS: 8,
    PAYOUT: 9,
    POTENTIAL_PAYOUT: 10,
    RESULT: 11,
    BET_SLIP_ID: 12
  }
  
  // Helper functions
  
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
   * Get safe string from row at index
   */
  function getCell(row: string[], index: number): string {
    return (row[index] || "").trim()
  }
  
  /**
   * Get safe number from row at index
   */
  function getCellAsNumber(row: string[], index: number): number | undefined {
    const value = getCell(row, index)
    if (!value) return undefined
    
    const num = parseFloat(value)
    return isNaN(num) ? undefined : num
  }
  
  /**
   * Check if a row looks like a parlay header
   */
  function isParlay(row: string[]): boolean {
    // Check if the row has the typical structure of a parlay header:
    // 1. Has a date/time in the first column
    // 2. Has "MULTIPLE" in the bet type column
    return (
      row.length > COL.BET_TYPE && 
      getCell(row, COL.BET_TYPE) === "MULTIPLE" &&
      isDateString(getCell(row, COL.DATE))
    )
  }
  
  /**
   * Check if a row looks like a single bet
   */
  function isSingleBet(row: string[]): boolean {
    // Check if the row has the typical structure of a single bet:
    // 1. Has a date/time in the first column
    // 2. Doesn't have "MULTIPLE" in the bet type column
    return (
      row.length > COL.BET_TYPE && 
      getCell(row, COL.BET_TYPE) !== "MULTIPLE" &&
      isDateString(getCell(row, COL.DATE))
    )
  }
  
  /**
   * Check if a row looks like a parlay leg
   */
  function isParlayLeg(row: string[]): boolean {
    // Check if the row has the typical structure of a leg:
    // 1. First column (date) is typically empty for legs
    // 2. Contains data in status, league, etc.
    return (
      row.length > COL.STATUS &&
      getCell(row, COL.DATE) === "" && // Empty date cell
      getCell(row, COL.STATUS) !== "" && // Has status
      getCell(row, COL.LEAGUE) !== "" // Has league
    )
  }
  
  // Process each row of data
  let currentParlayId: string | null = null
  let currentLegNumber = 0
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    // Skip rows that are too short
    if (!row || row.length < 5) {
      continue
    }
    
    // Process parlay header
    if (isParlay(row)) {
      const betId = getCell(row, COL.BET_SLIP_ID)
      currentParlayId = betId
      currentLegNumber = 0
      
      console.log(`Found parlay header: ${getCell(row, COL.DATE)}`)
      
      const parlayHeader = {
        userId,
        datePlaced: parseDate(getCell(row, COL.DATE)),
        status: getCell(row, COL.STATUS),
        league: getCell(row, COL.LEAGUE),
        match: getCell(row, COL.MATCH),
        betType: getCell(row, COL.BET_TYPE),
        market: getCell(row, COL.MARKET),
        price: getCellAsNumber(row, COL.PRICE),
        wager: getCellAsNumber(row, COL.WAGER),
        winnings: getCellAsNumber(row, COL.WINNINGS),
        payout: getCellAsNumber(row, COL.PAYOUT),
        potentialPayout: getCellAsNumber(row, COL.POTENTIAL_PAYOUT),
        result: getCell(row, COL.RESULT) || getCell(row, COL.STATUS), // Use status if result is empty
        betSlipId: betId
      }
      
      parlayHeaders.push(parlayHeader)
      
      console.log(`Created parlay header:`, { 
        id: betId, 
        match: parlayHeader.match,
        wager: parlayHeader.wager,
        potentialPayout: parlayHeader.potentialPayout
      })
    }
    // Process single bet
    else if (isSingleBet(row)) {
      const betId = getCell(row, COL.BET_SLIP_ID)
      currentParlayId = null // Reset current parlay
      
      console.log(`Found single bet: ${getCell(row, COL.DATE)}`)
      
      const singleBet = {
        userId,
        datePlaced: parseDate(getCell(row, COL.DATE)),
        status: getCell(row, COL.STATUS),
        league: getCell(row, COL.LEAGUE),
        match: getCell(row, COL.MATCH),
        betType: getCell(row, COL.BET_TYPE),
        market: getCell(row, COL.MARKET),
        price: getCellAsNumber(row, COL.PRICE),
        wager: getCellAsNumber(row, COL.WAGER),
        winnings: getCellAsNumber(row, COL.WINNINGS),
        payout: getCellAsNumber(row, COL.PAYOUT),
        result: getCell(row, COL.RESULT) || getCell(row, COL.STATUS), // Use status if result is empty
        betSlipId: betId
      }
      
      singleBets.push(singleBet)
      
      console.log(`Created single bet:`, { 
        id: betId, 
        match: singleBet.match,
        wager: singleBet.wager,
        winnings: singleBet.winnings
      })
      
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
        
        const result = (singleBet.result || '').toLowerCase()
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
        
        const result = (singleBet.result || '').toLowerCase()
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
        
        const result = (singleBet.result || '').toLowerCase()
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
    // Process parlay legs
    else if (isParlayLeg(row) && currentParlayId) {
      currentLegNumber++
      
      console.log(`Found parlay leg ${currentLegNumber} for parlay ${currentParlayId}`)
      
      const parlayLeg = {
        parlayId: currentParlayId,
        legNumber: currentLegNumber,
        status: getCell(row, COL.STATUS),
        league: getCell(row, COL.LEAGUE),
        match: getCell(row, COL.MATCH),
        market: getCell(row, COL.MARKET),
        selection: getCell(row, COL.BET_TYPE), // Selection is often in bet type column for legs
        price: getCellAsNumber(row, COL.PRICE),
        gameDate: parseDate(getCell(row, COL.RESULT)) // Game date often in result column for legs
      }
      
      // For some formats, the selection might be in a different column 
      // If selection is empty but we have data in market or potential payout, use that
      if (!parlayLeg.selection && getCell(row, COL.POTENTIAL_PAYOUT)) {
        parlayLeg.selection = getCell(row, COL.POTENTIAL_PAYOUT)
      }
      
      // Use BET_TYPE as market and MARKET as selection if market is empty
      if (!parlayLeg.market && getCell(row, COL.BET_TYPE) && getCell(row, COL.MARKET)) {
        parlayLeg.market = getCell(row, COL.BET_TYPE)
        parlayLeg.selection = getCell(row, COL.MARKET)
      }
      
      // Add the leg
      parlayLegs.push(parlayLeg)
      
      console.log(`Processed leg: ${parlayLeg.market} - ${parlayLeg.selection}`)
      
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
        
        const status = (parlayLeg.status || '').toLowerCase()
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
        
        const status = (parlayLeg.status || '').toLowerCase()
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