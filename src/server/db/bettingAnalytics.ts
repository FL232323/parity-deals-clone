import { db } from "@/drizzle/db"
import {
  SingleBetsTable,
  ParlayHeadersTable,
  ParlayLegsTable,
  TeamStatsTable,
  PlayerStatsTable,
  PropStatsTable
} from "@/drizzle/schema"
import { CACHE_TAGS, dbCache, getUserTag } from "@/lib/cache"
import { sql, eq, and, gte, desc, count } from "drizzle-orm"
import { startOfDay, subDays } from "date-fns"
import { tz } from "@date-fns/tz"

// Define chart intervals (similar to PPP structure but for betting data)
export const CHART_INTERVALS = {
  last7Days: {
    dateFormatter: (date: Date) => {
      try {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "short",
          timeZone: "UTC",
        }).format(date)
      } catch (error) {
        console.error("Date formatting error:", error)
        return String(date)
      }
    },
    startDate: subDays(new Date(), 7),
    label: "Last 7 Days",
    sql: sql`GENERATE_SERIES(current_date - 7, current_date, '1 day'::interval) as series`,
    dateGrouper: (col: any) => sql<string>`DATE(${col})`.inlineParams(),
  },
  last30Days: {
    dateFormatter: (date: Date) => {
      try {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "short",
          timeZone: "UTC",
        }).format(date)
      } catch (error) {
        console.error("Date formatting error:", error)
        return String(date)
      }
    },
    startDate: subDays(new Date(), 30),
    label: "Last 30 Days",
    sql: sql`GENERATE_SERIES(current_date - 30, current_date, '1 day'::interval) as series`,
    dateGrouper: (col: any) => sql<string>`DATE(${col})`.inlineParams(),
  },
  allTime: {
    dateFormatter: (date: Date) => {
      try {
        return new Intl.DateTimeFormat(undefined, {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }).format(date)
      } catch (error) {
        console.error("Date formatting error:", error)
        return String(date)
      }
    },
    startDate: new Date(0), // All time
    label: "All Time",
    sql: sql`GENERATE_SERIES(DATE_TRUNC('month', (SELECT MIN(date_placed) FROM single_bets UNION SELECT MIN(date_placed) FROM parlay_headers)), DATE_TRUNC('month', current_date), '1 month'::interval) as series`,
    dateGrouper: (col: any) => sql<string>`DATE_TRUNC('month', ${col})`.inlineParams(),
  },
}

// Get bets per day chart data
export function getBetsByDayChartData({
  timezone,
  userId,
  interval,
  includeParlayLegs = false,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  includeParlayLegs?: boolean
}) {
  const cacheFn = dbCache(getBetsByDayChartDataInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    timezone,
    userId,
    interval,
    includeParlayLegs,
  })
}

// Get betting performance by sport/league
export function getBetsByLeagueChartData({
  timezone,
  userId,
  interval,
  includeParlayLegs = false,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  includeParlayLegs?: boolean
}) {
  const cacheFn = dbCache(getBetsByLeagueChartDataInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    timezone,
    userId,
    interval,
    includeParlayLegs,
  })
}

// Get betting performance by team
export function getBetsByTeamChartData({
  timezone,
  userId,
  interval,
  includeParlayLegs = false,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  includeParlayLegs?: boolean
}) {
  const cacheFn = dbCache(getBetsByTeamChartDataInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    timezone,
    userId,
    interval,
    includeParlayLegs,
  })
}

// Get performance summary
export function getBettingPerformanceSummary({
  userId,
}: {
  userId: string
}) {
  const cacheFn = dbCache(getBettingPerformanceSummaryInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({ userId })
}

// Internal implementation functions
async function getBetsByDayChartDataInternal({
  timezone,
  userId,
  interval,
  includeParlayLegs = false,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  includeParlayLegs?: boolean
}) {
  const startDate = startOfDay(interval.startDate, { in: tz(timezone) })

  // Query single bets by day
  const singleBetsQuery = db
    .select({
      date: interval.dateGrouper(sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams())
        .mapWith(dateString => interval.dateFormatter(new Date(dateString))),
      count: count(),
      wins: sql`SUM(CASE WHEN ${SingleBetsTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      profit: sql`SUM(${SingleBetsTable.winnings})`.mapWith(Number),
    })
    .from(SingleBetsTable)
    .where(and(
      eq(SingleBetsTable.userId, userId),
      gte(
        sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
        startDate
      )
    ))
    .groupBy(({ date }) => [date])

  // Query parlay bets by day
  const parlayBetsQuery = db
    .select({
      date: interval.dateGrouper(sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams())
        .mapWith(dateString => interval.dateFormatter(new Date(dateString))),
      count: count(),
      wins: sql`SUM(CASE WHEN ${ParlayHeadersTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      profit: sql`SUM(${ParlayHeadersTable.winnings})`.mapWith(Number),
    })
    .from(ParlayHeadersTable)
    .where(and(
      eq(ParlayHeadersTable.userId, userId),
      gte(
        sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
        startDate
      )
    ))
    .groupBy(({ date }) => [date])

  // Execute both queries
  const [singleBetsData, parlayBetsData] = await Promise.all([
    singleBetsQuery,
    parlayBetsQuery
  ])

  // Combine the results by date
  const dateMap = new Map()
  
  // Add single bets data
  singleBetsData.forEach(item => {
    dateMap.set(item.date, {
      date: item.date,
      bets: item.count,
      wins: item.wins,
      profit: item.profit || 0
    })
  })
  
  // Add parlay bets data
  parlayBetsData.forEach(item => {
    const existing = dateMap.get(item.date) || { date: item.date, bets: 0, wins: 0, profit: 0 }
    dateMap.set(item.date, {
      date: item.date,
      bets: existing.bets + item.count,
      wins: existing.wins + item.wins,
      profit: existing.profit + (item.profit || 0)
    })
  })
  
  // Convert map to array and sort by date
  const combinedData = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
  
  return combinedData
}

async function getBetsByLeagueChartDataInternal({
  timezone,
  userId,
  interval,
  includeParlayLegs = false,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  includeParlayLegs?: boolean
}) {
  const startDate = startOfDay(interval.startDate, { in: tz(timezone) })

  // Query single bets by league
  const singleBetsQuery = db
    .select({
      league: SingleBetsTable.league,
      count: count(),
      wins: sql`SUM(CASE WHEN ${SingleBetsTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      profit: sql`SUM(${SingleBetsTable.winnings})`.mapWith(Number),
    })
    .from(SingleBetsTable)
    .where(and(
      eq(SingleBetsTable.userId, userId),
      gte(
        sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
        startDate
      )
    ))
    .groupBy(({ league }) => [league])
    .having(({ league }) => sql`${league} IS NOT NULL`)

  // Query parlay bets - use legs if includeParlayLegs is true
  let parlayDataPromise
  
  if (includeParlayLegs) {
    // Get data from parlay legs grouped by league
    parlayDataPromise = db
      .select({
        league: ParlayLegsTable.league,
        count: count(),
        wins: sql`SUM(CASE WHEN ${ParlayLegsTable.status} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
        // Note: We can't accurately calculate profit per leg, so we'll use null
        profit: sql`0`.mapWith(Number),
      })
      .from(ParlayLegsTable)
      .innerJoin(
        ParlayHeadersTable,
        eq(ParlayLegsTable.parlayId, ParlayHeadersTable.id)
      )
      .where(and(
        eq(ParlayHeadersTable.userId, userId),
        gte(
          sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
          startDate
        )
      ))
      .groupBy(({ league }) => [league])
      .having(({ league }) => sql`${league} IS NOT NULL`)
  } else {
    // Just count the parlays themselves by their main league
    parlayDataPromise = db
      .select({
        league: ParlayHeadersTable.league,
        count: count(),
        wins: sql`SUM(CASE WHEN ${ParlayHeadersTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
        profit: sql`SUM(${ParlayHeadersTable.winnings})`.mapWith(Number),
      })
      .from(ParlayHeadersTable)
      .where(and(
        eq(ParlayHeadersTable.userId, userId),
        gte(
          sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
          startDate
        )
      ))
      .groupBy(({ league }) => [league])
      .having(({ league }) => sql`${league} IS NOT NULL`)
  }

  // Execute both queries
  const [singleBetsData, parlayData] = await Promise.all([
    singleBetsQuery,
    parlayDataPromise
  ])

  // Combine the results by league
  const leagueMap = new Map()
  
  // Add single bets data
  singleBetsData.forEach(item => {
    if (!item.league) return
    
    leagueMap.set(item.league, {
      league: item.league,
      bets: item.count,
      wins: item.wins,
      profit: item.profit || 0,
      winRate: item.count > 0 ? (item.wins / item.count) * 100 : 0
    })
  })
  
  // Add parlay data
  parlayData.forEach(item => {
    if (!item.league) return
    
    const existing = leagueMap.get(item.league) || { 
      league: item.league, 
      bets: 0, 
      wins: 0, 
      profit: 0,
      winRate: 0 
    }
    
    const totalBets = existing.bets + item.count
    const totalWins = existing.wins + item.wins
    
    leagueMap.set(item.league, {
      league: item.league,
      bets: totalBets,
      wins: totalWins,
      profit: existing.profit + (item.profit || 0),
      winRate: totalBets > 0 ? (totalWins / totalBets) * 100 : 0
    })
  })
  
  // Convert map to array and sort by volume
  const combinedData = Array.from(leagueMap.values())
    .sort((a, b) => b.bets - a.bets)
  
  return combinedData
}

async function getBetsByTeamChartDataInternal({
  timezone,
  userId,
  interval,
  includeParlayLegs = false,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  includeParlayLegs?: boolean
}) {
  // For this function, we'll use the aggregated team stats table
  // since trying to extract teams from match strings is complex

  const teamStats = await db
    .select({
      team: TeamStatsTable.team,
      totalBets: TeamStatsTable.totalBets,
      wins: TeamStatsTable.wins,
      losses: TeamStatsTable.losses,
      pushes: TeamStatsTable.pushes,
      pending: TeamStatsTable.pending,
      league: TeamStatsTable.league,
    })
    .from(TeamStatsTable)
    .where(eq(TeamStatsTable.userId, userId))
    .orderBy(desc(TeamStatsTable.totalBets))
    .limit(20) // Top 20 teams by bet volume
  
  // Format the data for the chart
  return teamStats.map(stat => ({
    team: stat.team,
    bets: stat.totalBets,
    wins: stat.wins,
    losses: stat.losses,
    pushes: stat.pushes,
    pending: stat.pending,
    league: stat.league || 'Unknown',
    winRate: stat.totalBets > 0 
      ? ((stat.wins / (stat.totalBets - stat.pending)) * 100).toFixed(1) 
      : '0'
  }))
}

async function getBettingPerformanceSummaryInternal({
  userId,
}: {
  userId: string
}) {
  // Get single bets summary
  const singleBetsPromise = db
    .select({
      totalBets: count(),
      totalWins: sql`SUM(CASE WHEN ${SingleBetsTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      totalProfit: sql`SUM(${SingleBetsTable.winnings})`.mapWith(Number),
      avgOdds: sql`AVG(${SingleBetsTable.price})`.mapWith(Number),
    })
    .from(SingleBetsTable)
    .where(eq(SingleBetsTable.userId, userId))
  
  // Get parlay bets summary
  const parlayBetsPromise = db
    .select({
      totalBets: count(),
      totalWins: sql`SUM(CASE WHEN ${ParlayHeadersTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      totalProfit: sql`SUM(${ParlayHeadersTable.winnings})`.mapWith(Number),
      avgOdds: sql`AVG(${ParlayHeadersTable.price})`.mapWith(Number),
    })
    .from(ParlayHeadersTable)
    .where(eq(ParlayHeadersTable.userId, userId))
  
  // Get most bet leagues
  const topLeaguesPromise = db
    .select({
      league: SingleBetsTable.league,
      count: count(),
    })
    .from(SingleBetsTable)
    .where(eq(SingleBetsTable.userId, userId))
    .groupBy(({ league }) => [league])
    .orderBy(({ count }) => desc(count))
    .limit(5)
  
  // Execute all queries in parallel
  const [singleBets, parlayBets, topLeagues] = await Promise.all([
    singleBetsPromise,
    parlayBetsPromise,
    topLeaguesPromise
  ])
  
  // Format the summary
  const singleBetsSummary = singleBets[0] || { totalBets: 0, totalWins: 0, totalProfit: 0, avgOdds: 0 }
  const parlayBetsSummary = parlayBets[0] || { totalBets: 0, totalWins: 0, totalProfit: 0, avgOdds: 0 }
  
  const totalBets = singleBetsSummary.totalBets + parlayBetsSummary.totalBets
  const totalWins = singleBetsSummary.totalWins + parlayBetsSummary.totalWins
  const totalProfit = (singleBetsSummary.totalProfit || 0) + (parlayBetsSummary.totalProfit || 0)
  
  return {
    totalBets,
    totalWins,
    winRate: totalBets > 0 ? (totalWins / totalBets) * 100 : 0,
    totalProfit,
    roi: totalProfit, // We'd need to know total wagered to calculate true ROI
    singleBets: {
      count: singleBetsSummary.totalBets,
      wins: singleBetsSummary.totalWins,
      winRate: singleBetsSummary.totalBets > 0 
        ? (singleBetsSummary.totalWins / singleBetsSummary.totalBets) * 100 
        : 0,
      profit: singleBetsSummary.totalProfit || 0,
      avgOdds: singleBetsSummary.avgOdds || 0,
    },
    parlayBets: {
      count: parlayBetsSummary.totalBets,
      wins: parlayBetsSummary.totalWins,
      winRate: parlayBetsSummary.totalBets > 0 
        ? (parlayBetsSummary.totalWins / parlayBetsSummary.totalBets) * 100 
        : 0,
      profit: parlayBetsSummary.totalProfit || 0,
      avgOdds: parlayBetsSummary.avgOdds || 0,
    },
    topLeagues: topLeagues.filter(l => l.league).map(l => ({
      league: l.league || 'Unknown',
      count: l.count
    }))
  }
}
