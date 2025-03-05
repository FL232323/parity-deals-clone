import { DOMParser } from 'xmldom';

/**
 * Enhanced XML parser for betting data from Excel files
 * @param xmlContent The XML content as a string
 * @param userId The user ID for the data
 * @returns Extracted betting data objects
 */
export function parseXMLBettingData(xmlContent: string, userId: string) {
  try {
    // Parse the XML content
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    
    // Get all rows
    const rows = xmlDoc.getElementsByTagName('ss:Row');
    if (!rows || rows.length === 0) {
      throw new Error("No rows found in the XML data");
    }
    
    // Get header row to map column names to indexes
    const headerRow = rows[0];
    const headerCells = headerRow.getElementsByTagName('ss:Cell');
    const columnMap: Record<string, number> = {};
    
    // Populate the column map from header cells
    for (let i = 0; i < headerCells.length; i++) {
      const cellData = headerCells[i].getElementsByTagName('ss:Data')[0];
      if (cellData && cellData.textContent) {
        columnMap[cellData.textContent.trim()] = i;
      }
    }
    
    console.log("Column mapping:", columnMap);
    
    // Alternative header names that might be used
    const headerAliases: Record<string, string[]> = {
      'Date Placed': ['Date', 'PlacedDate', 'Bet Date', 'Transaction Date'],
      'Status': ['Result', 'Outcome', 'State'],
      'League': ['Sport', 'Sports League', 'Category'],
      'Match': ['Event', 'Game', 'Matchup'],
      'Bet Type': ['Type', 'Wager Type', 'Selection Type'],
      'Market': ['Selection', 'Pick', 'Bet On', 'Option'],
      'Price': ['Odds', 'Line', 'Price Odds'],
      'Wager': ['Stake', 'Amount', 'Bet Amount'],
      'Winnings': ['Profit', 'Net', 'PL', 'Payout', 'Returns'],
      'Payout': ['Total Return', 'Gross Payout'],
      'Potential Payout': ['To Win', 'Potential Win']
    };
    
    // Resolve header aliases to actual column indexes
    const resolvedColumns: Record<string, number> = {};
    
    // For each standard header name
    for (const [standardName, aliases] of Object.entries(headerAliases)) {
      // Check if the standard name exists in the column map
      if (columnMap[standardName] !== undefined) {
        resolvedColumns[standardName] = columnMap[standardName];
        continue;
      }
      
      // If not, try each alias
      for (const alias of aliases) {
        if (columnMap[alias] !== undefined) {
          resolvedColumns[standardName] = columnMap[alias];
          break;
        }
      }
    }
    
    console.log("Resolved columns:", resolvedColumns);
    
    // Prepare data structures
    const singleBets: any[] = [];
    const parlayHeaders: any[] = [];
    const parlayLegs: any[] = [];
    const teamStatsMap = new Map<string, any>();
    const playerStatsMap = new Map<string, any>();
    const propStatsMap = new Map<string, any>();
    
    let currentParlay: any = null;
    let currentLegNumber = 0;
    let parlayIdCounter = 1;
    
    // Helper functions
    function getTextContent(row: Element, columnName: string): string {
      const index = resolvedColumns[columnName];
      if (index === undefined) return "";
      
      const cells = row.getElementsByTagName('ss:Cell');
      const cell = cells[index];
      
      if (!cell) return "";
      
      const dataElem = cell.getElementsByTagName('ss:Data')[0];
      return dataElem && dataElem.textContent ? dataElem.textContent.trim() : "";
    }
    
    function getNumberValue(row: Element, columnName: string): number | undefined {
      const text = getTextContent(row, columnName);
      if (!text) return undefined;
      
      // Remove currency symbols and commas
      const cleanValue = text.replace(/[$,]/g, '');
      const num = parseFloat(cleanValue);
      return isNaN(num) ? undefined : num;
    }
    
    /**
     * Extract teams from match string
     */
    function extractTeams(matchStr?: string): string[] {
      if (!matchStr) return [];
      
      const trimmed = matchStr.trim();
      if (trimmed.includes(' vs ')) {
        return trimmed.split(' vs ').map(team => team.trim());
      }
      if (trimmed.includes(' @ ')) {
        return trimmed.split(' @ ').map(team => team.trim());
      }
      return [];
    }
    
    /**
     * Extract player name and prop type from market string
     */
    function extractPlayerAndProp(marketStr?: string): [string | null, string | null] {
      if (!marketStr) return [null, null];
      
      if (marketStr.includes(' - ')) {
        const parts = marketStr.split(' - ', 2);
        const player = parts[0].trim();
        const propType = parts.length > 1 ? parts[1].trim() : null;
        return [player, propType];
      }
      return [null, null];
    }
    
    /**
     * Check if a string looks like a date
     */
    function isDateString(str: string): boolean {
      if (!str || str.trim() === "") return false;
      
      // Common date patterns
      const datePatterns = [
        // Date with @ time pattern - e.g., "9 Feb 2023 @ 4:08pm"
        /^\\d{1,2}\\s+[A-Za-z]{3,}\\s+\\d{4}\\s+@\\s+\\d{1,2}:\\d{2}(am|pm)/i,
        // ISO date pattern - e.g., "2023-02-09T16:08:00"
        /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/,
        // Standard date pattern - e.g., "02/09/2023"
        /^\\d{2}\\/\\d{2}\\/\\d{4}/,
        // Month day, year pattern - e.g., "February 9, 2023"
        /^[A-Za-z]{3,}\\s+\\d{1,2},\\s+\\d{4}/,
        // Day-month-year pattern - e.g., "9-Feb-2023"
        /^\\d{1,2}-[A-Za-z]{3}-\\d{4}/,
        // Day.month.year pattern - e.g., "09.02.2023"
        /^\\d{1,2}\\.\\d{1,2}\\.\\d{4}/
      ];
      
      return datePatterns.some(pattern => pattern.test(str.trim()));
    }
    
    /**
     * Parse a date string to Date object
     */
    function parseDate(dateStr: string): Date | null {
      if (!dateStr || dateStr.trim() === "") return null;
      
      try {
        // Try built-in date parsing first
        const date = new Date(dateStr);
        if (isValidDate(date)) return date;
        
        // Handle custom formats
        const trimmed = dateStr.trim();
        
        // Format: "9 Feb 2023 @ 4:08pm"
        const customFormat = /^(\\d{1,2})\\s+([A-Za-z]{3,})\\s+(\\d{4})\\s+@\\s+(\\d{1,2}):(\\d{2})(am|pm)/i;
        const match = trimmed.match(customFormat);
        
        if (match) {
          const [_, day, monthStr, year, hour, minute, ampm] = match;
          
          // Convert month name to month number (0-11)
          const months: { [key: string]: number } = {
            jan: 0, january: 0,
            feb: 1, february: 1,
            mar: 2, march: 2,
            apr: 3, april: 3,
            may: 4,
            jun: 5, june: 5,
            jul: 6, july: 6,
            aug: 7, august: 7,
            sep: 8, september: 8,
            oct: 9, october: 9,
            nov: 10, november: 10,
            dec: 11, december: 11
          };
          
          const month = months[monthStr.toLowerCase()];
          if (month === undefined) return null;
          
          // Parse hour, adjusting for 12-hour format
          let hourNum = parseInt(hour);
          if (ampm.toLowerCase() === 'pm' && hourNum < 12) {
            hourNum += 12;
          } else if (ampm.toLowerCase() === 'am' && hourNum === 12) {
            hourNum = 0;
          }
          
          const result = new Date(
            parseInt(year),
            month,
            parseInt(day),
            hourNum,
            parseInt(minute)
          );
          
          return isValidDate(result) ? result : null;
        }
        
        // If no custom format matched, return null
        return null;
      } catch (error) {
        console.error("Error parsing date:", dateStr, error);
        return null;
      }
    }
    
    /**
     * Check if a date object is valid
     */
    function isValidDate(date: any): boolean {
      return date instanceof Date && !isNaN(date.getTime());
    }
    
    /**
     * Check if a row is a parlay header
     */
    function isParlay(row: Element): boolean {
      const betType = getTextContent(row, 'Bet Type').toUpperCase();
      const dateStr = getTextContent(row, 'Date Placed');
      
      return (
        (betType === "MULTIPLE" || betType.includes("PARLAY")) &&
        isDateString(dateStr)
      );
    }
    
    /**
     * Check if a row is a single bet
     */
    function isSingleBet(row: Element): boolean {
      const betType = getTextContent(row, 'Bet Type').toUpperCase();
      const dateStr = getTextContent(row, 'Date Placed');
      const match = getTextContent(row, 'Match');
      const market = getTextContent(row, 'Market');
      
      return (
        betType !== "MULTIPLE" &&
        !betType.includes("PARLAY") &&
        isDateString(dateStr) &&
        (match !== "" || market !== "")
      );
    }
    
    /**
     * Check if a row looks like a parlay leg
     */
    function isParlayLeg(row: Element): boolean {
      const dateStr = getTextContent(row, 'Date Placed');
      const status = getTextContent(row, 'Status');
      const league = getTextContent(row, 'League');
      const match = getTextContent(row, 'Match');
      
      return (
        dateStr === "" && // Empty date cell
        (status !== "" || league !== "" || match !== "")
      );
    }
    
    // Process data rows (skip header row)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Process parlay header
      if (isParlay(row)) {
        const betId = getTextContent(row, 'Bet Slip ID') || `generated-parlay-${parlayIdCounter++}`;
        currentParlay = {
          userId,
          datePlaced: parseDate(getTextContent(row, 'Date Placed')),
          status: getTextContent(row, 'Status'),
          league: getTextContent(row, 'League'),
          match: getTextContent(row, 'Match'),
          betType: getTextContent(row, 'Bet Type'),
          market: getTextContent(row, 'Market'),
          selection: getTextContent(row, 'Selection'),
          price: getNumberValue(row, 'Price'),
          wager: getNumberValue(row, 'Wager'),
          winnings: getNumberValue(row, 'Winnings'),
          payout: getNumberValue(row, 'Payout'),
          potentialPayout: getNumberValue(row, 'Potential Payout'),
          result: getTextContent(row, 'Result') || getTextContent(row, 'Status'),
          betSlipId: betId
        };
        
        parlayHeaders.push(currentParlay);
        currentLegNumber = 0;
        
        console.log(`Found parlay header: ${getTextContent(row, 'Date Placed')}`);
      }
      // Process single bet
      else if (isSingleBet(row)) {
        const betId = getTextContent(row, 'Bet Slip ID') || `generated-single-${parlayIdCounter++}`;
        currentParlay = null; // Reset current parlay
        
        const singleBet = {
          userId,
          datePlaced: parseDate(getTextContent(row, 'Date Placed')),
          status: getTextContent(row, 'Status'),
          league: getTextContent(row, 'League'),
          match: getTextContent(row, 'Match'),
          betType: getTextContent(row, 'Bet Type'),
          market: getTextContent(row, 'Market'),
          selection: getTextContent(row, 'Selection') || getTextContent(row, 'Bet Type'),
          price: getNumberValue(row, 'Price'),
          wager: getNumberValue(row, 'Wager'),
          winnings: getNumberValue(row, 'Winnings'),
          payout: getNumberValue(row, 'Payout'),
          result: getTextContent(row, 'Result') || getTextContent(row, 'Status'),
          betSlipId: betId
        };
        
        singleBets.push(singleBet);
        
        console.log(`Found single bet: ${getTextContent(row, 'Date Placed')}`);
        
        // Process team stats from this single bet
        const teams = extractTeams(singleBet.match);
        teams.forEach(team => {
          if (!team || team.trim() === '') return;
          
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
            });
          }
          
          const stat = teamStatsMap.get(team)!;
          stat.totalBets++;
          
          const result = (singleBet.result || '').toLowerCase();
          if (result.includes('won') || result.includes('win')) {
            stat.wins++;
          } else if (result.includes('lost') || result.includes('lose')) {
            stat.losses++;
          } else if (result.includes('push')) {
            stat.pushes++;
          } else {
            stat.pending++;
          }
        });
        
        // Process player and prop stats
        const [player, propType] = extractPlayerAndProp(singleBet.market);
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
            });
          }
          
          const stat = playerStatsMap.get(player)!;
          stat.totalBets++;
          
          if (propType && !stat.propTypes?.includes(propType)) {
            stat.propTypes = [...(stat.propTypes || []), propType];
          }
          
          const result = (singleBet.result || '').toLowerCase();
          if (result.includes('won') || result.includes('win')) {
            stat.wins++;
          } else if (result.includes('lost') || result.includes('lose')) {
            stat.losses++;
          } else if (result.includes('push')) {
            stat.pushes++;
          } else {
            stat.pending++;
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
            });
          }
          
          const stat = propStatsMap.get(propType)!;
          stat.totalBets++;
          
          const result = (singleBet.result || '').toLowerCase();
          if (result.includes('won') || result.includes('win')) {
            stat.wins++;
          } else if (result.includes('lost') || result.includes('lose')) {
            stat.losses++;
          } else if (result.includes('push')) {
            stat.pushes++;
          } else {
            stat.pending++;
          }
        }
      }
      // Process parlay legs
      else if (isParlayLeg(row) && currentParlay) {
        currentLegNumber++;
        
        const parlayLeg = {
          parlayId: currentParlay.betSlipId,
          legNumber: currentLegNumber,
          status: getTextContent(row, 'Status'),
          league: getTextContent(row, 'League'),
          match: getTextContent(row, 'Match'),
          market: getTextContent(row, 'Market'),
          selection: getTextContent(row, 'Selection') || getTextContent(row, 'Bet Type'),
          price: getNumberValue(row, 'Price'),
          gameDate: parseDate(getTextContent(row, 'Result')) // Game date often in result column for legs
        };
        
        // For some formats, the selection might be in a different column
        if (!parlayLeg.selection && getTextContent(row, 'Potential Payout')) {
          parlayLeg.selection = getTextContent(row, 'Potential Payout');
        }
        
        // Use BET_TYPE as market and MARKET as selection if market is empty
        if (!parlayLeg.market && getTextContent(row, 'Bet Type') && getTextContent(row, 'Market')) {
          parlayLeg.market = getTextContent(row, 'Bet Type');
          parlayLeg.selection = getTextContent(row, 'Market');
        }
        
        // Add the leg
        parlayLegs.push(parlayLeg);
        
        console.log(`Found parlay leg ${currentLegNumber} for parlay ${currentParlay.betSlipId}`);
        
        // Process team stats from this leg
        const teams = extractTeams(parlayLeg.match);
        teams.forEach(team => {
          if (!team || team.trim() === '') return;
          
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
            });
          }
          
          const stat = teamStatsMap.get(team)!;
          stat.totalBets++;
          
          const status = (parlayLeg.status || '').toLowerCase();
          if (status.includes('win')) {
            stat.wins++;
          } else if (status.includes('lose') || status.includes('lost')) {
            stat.losses++;
          } else if (status.includes('push')) {
            stat.pushes++;
          } else {
            stat.pending++;
          }
        });
        
        // Process player and prop stats
        const [player, propType] = extractPlayerAndProp(parlayLeg.market);
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
            });
          }
          
          const stat = playerStatsMap.get(player)!;
          stat.totalBets++;
          
          if (propType && !stat.propTypes?.includes(propType)) {
            stat.propTypes = [...(stat.propTypes || []), propType];
          }
          
          const status = (parlayLeg.status || '').toLowerCase();
          if (status.includes('win')) {
            stat.wins++;
          } else if (status.includes('lose') || status.includes('lost')) {
            stat.losses++;
          } else if (status.includes('push')) {
            stat.pushes++;
          } else {
            stat.pending++;
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
            });
          }
          
          const stat = propStatsMap.get(propType)!;
          stat.totalBets++;
          
          const status = (parlayLeg.status || '').toLowerCase();
          if (status.includes('win')) {
            stat.wins++;
          } else if (status.includes('lose') || status.includes('lost')) {
            stat.losses++;
          } else if (status.includes('push')) {
            stat.pushes++;
          } else {
            stat.pending++;
          }
        }
      }
    }
    
    // Convert map values to arrays
    return {
      singleBets,
      parlayHeaders,
      parlayLegs,
      teamStats: Array.from(teamStatsMap.values()),
      playerStats: Array.from(playerStatsMap.values()),
      propStats: Array.from(propStatsMap.values())
    };
  } catch (error) {
    console.error("Error parsing XML betting data:", error);
    // Return empty arrays to maintain a consistent return type
    return {
      singleBets: [],
      parlayHeaders: [],
      parlayLegs: [],
      teamStats: [],
      playerStats: [],
      propStats: []
    };
  }
}
