import { db } from "@/drizzle/db"
import { SingleBetsTable, ParlayHeadersTable, ParlayLegsTable, TeamStatsTable, PlayerStatsTable, PropStatsTable } from "@/drizzle/schema"
import { CACHE_TAGS, dbCache, getUserTag } from "@/lib/cache"
import { SQL, and, count, desc, eq, gte, sql, sum } from "drizzle-orm"
import { startOfDay, subDays } from "date-fns"
import { tz } from "@date-fns/tz"

// Reuse chart intervals from product views
import { CHART_INTERVALS } from "./productViews"
export { CHART_INTERVALS }

/**
 * Get betting data by day for charts
 */
export function getBettingDataByDay({
  timezone,
  userId,
  interval,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
}) {
  const cacheFn = dbCache(getBettingDataByDayInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    timezone,
    userId,
    interval,
  })
}

/**
 * Get betting data by league for charts
 */
export function getBettingDataByLeague({
  timezone,
  userId,
  interval,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
}) {
  const cacheFn = dbCache(getBettingDataByLeagueInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    timezone,
    userId,
    interval,
  })
}

/**
 * Get win rate by bet type for charts
 */
export function getWinRateByBetType({
  timezone,
  userId,
  interval,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
}) {
  const cacheFn = dbCache(getWinRateByBetTypeInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    timezone,
    userId,
    interval,
  })
}

/**
 * Get team performance data for charts
 */
export function getTeamPerformanceData({
  userId,
  limit = 10,
}: {
  userId: string
  limit?: number
}) {
  const cacheFn = dbCache(getTeamPerformanceDataInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    userId,
    limit,
  })
}

/**
 * Get prop bet performance data for charts
 */
export function getPropBetPerformance({
  userId,
  limit = 10,
}: {
  userId: string
  limit?: number
}) {
  const cacheFn = dbCache(getPropBetPerformanceInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.productViews)],
  })

  return cacheFn({
    userId,
    limit,
  })
}

// Internal implementation functions

async function getBettingDataByDayInternal({
  timezone,
  userId,
  interval,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
}) {
  const startDate = startOfDay(interval.startDate, { in: tz(timezone) })
  
  // Get single bets by day
  const singleBetsQuery = db.$with("single_bets_by_day").as(
    db
      .select({
        date: interval.dateGrouper(
          sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams()
        ).mapWith(String).as("date"),
        count: count(),
        profit: sum(SingleBetsTable.winnings).mapWith(Number)
      })
      .from(SingleBetsTable)
      .where(
        and(
          eq(SingleBetsTable.userId, userId),
          gte(
            sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
            startDate
          )
        )
      )
      .groupBy(({ date }) => [date])
  )
  
  // Get parlays by day
  const parlaysQuery = db.$with("parlays_by_day").as(
    db
      .select({
        date: interval.dateGrouper(
          sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams()
        ).mapWith(String).as("date"),
        count: count(),
        profit: sum(ParlayHeadersTable.winnings).mapWith(Number)
      })
      .from(ParlayHeadersTable)
      .where(
        and(
          eq(ParlayHeadersTable.userId, userId),
          gte(
            sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
            startDate
          )
        )
      )
      .groupBy(({ date }) => [date])
  )
  
  // Get all dates from interval for complete chart
  const allDatesQuery = db.$with("all_dates").as(
    db.select({
      date: interval.dateGrouper(sql.raw("series"))
        .mapWith(dateString => interval.dateFormatter(new Date(dateString)))
        .as("date")
    })
    .from(interval.sql)
  )
  
  // Combine data with left joins
  const result = await db
    .with(allDatesQuery, singleBetsQuery, parlaysQuery)
    .select({
      date: allDatesQuery.date,
      singleBets: sql`COALESCE(${singleBetsQuery.count}, 0)`.mapWith(Number),
      parlayBets: sql`COALESCE(${parlaysQuery.count}, 0)`.mapWith(Number),
      profit: sql`COALESCE(${singleBetsQuery.profit}, 0) + COALESCE(${parlaysQuery.profit}, 0)`.mapWith(Number)
    })
    .from(allDatesQuery)
    .leftJoin(singleBetsQuery, eq(allDatesQuery.date, singleBetsQuery.date))
    .leftJoin(parlaysQuery, eq(allDatesQuery.date, parlaysQuery.date))
    .orderBy(allDatesQuery.date)
  
  return result
}

async function getBettingDataByLeagueInternal({
  timezone,
  userId,
  interval,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
}) {
  const startDate = startOfDay(interval.startDate, { in: tz(timezone) })
  
  // Query for single bets by league
  const singleBetsQuery = db
    .select({
      league: SingleBetsTable.league,
      count: count(),
      profit: sum(SingleBetsTable.winnings).mapWith(Number)
    })
    .from(SingleBetsTable)
    .where(
      and(
        eq(SingleBetsTable.userId, userId),
        gte(
          sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
          startDate
        )
      )
    )
    .groupBy(({ league }) => [league])
  
  // Query for parlay bets by league
  const parlayLegsQuery = db
    .select({
      league: ParlayLegsTable.league,
      count: count()
    })
    .from(ParlayLegsTable)
    .innerJoin(
      ParlayHeadersTable, 
      eq(ParlayLegsTable.parlayId, ParlayHeadersTable.id)
    )
    .where(
      and(
        eq(ParlayHeadersTable.userId, userId),
        gte(
          sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(), 
          startDate
        )
      )
    )
    .groupBy(({ league }) => [league])
  
  // Execute the queries
  const [singleBetsByLeague, parlayLegsByLeague] = await Promise.all([
    singleBetsQuery,
    parlayLegsQuery
  ])
  
  // Combine the data
  const leagueMap = new Map<string, { league: string, bets: number, parlayLegs: number, profit: number }>()
  
  // Add single bet data
  singleBetsByLeague.forEach(item => {
    if (item.league) {
      leagueMap.set(item.league, {
        league: item.league,
        bets: Number(item.count || 0),
        parlayLegs: 0,
        profit: Number(item.profit || 0)
      })
    }
  })
  
  // Add parlay leg data
  parlayLegsByLeague.forEach(item => {
    if (item.league) {
      const existing = leagueMap.get(item.league)
      if (existing) {
        existing.parlayLegs = Number(item.count || 0)
      } else {
        leagueMap.set(item.league, {
          league: item.league,
          bets: 0,
          parlayLegs: Number(item.count || 0),
          profit: 0
        })
      }
    }
  })
  
  // Convert to array and sort by total bets
  return Array.from(leagueMap.values())
    .map(item => ({
      ...item,
      totalBets: item.bets + item.parlayLegs
    }))
    .sort((a, b) => b.totalBets - a.totalBets)
    .slice(0, 10) // Limit to top 10 leagues
}

async function getWinRateByBetTypeInternal({
  timezone,
  userId,
  interval,
}: {
  timezone: string
  userId: string
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
}) {
  const startDate = startOfDay(interval.startDate, { in: tz(timezone) })
  
  // Query for single bet results
  const singleBetsQuery = db
    .select({
      type: sql`'Single'`.as('type'),
      total: count(),
      wins: sql`SUM(CASE WHEN ${SingleBetsTable.result} ILIKE '%won%' OR ${SingleBetsTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      profit: sum(SingleBetsTable.winnings).mapWith(Number)
    })
    .from(SingleBetsTable)
    .where(
      and(
        eq(SingleBetsTable.userId, userId),
        gte(
          sql`${SingleBetsTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
          startDate
        )
      )
    )
  
  // Query for parlay results
  const parlayQuery = db
    .select({
      type: sql`'Parlay'`.as('type'),
      total: count(),
      wins: sql`SUM(CASE WHEN ${ParlayHeadersTable.result} ILIKE '%won%' OR ${ParlayHeadersTable.result} ILIKE '%win%' THEN 1 ELSE 0 END)`.mapWith(Number),
      profit: sum(ParlayHeadersTable.winnings).mapWith(Number)
    })
    .from(ParlayHeadersTable)
    .where(
      and(
        eq(ParlayHeadersTable.userId, userId),
        gte(
          sql`${ParlayHeadersTable.datePlaced} AT TIME ZONE ${timezone}`.inlineParams(),
          startDate
        )
      )
    )
  
  // Execute the queries
  const [singleResults, parlayResults] = await Promise.all([
    singleBetsQuery,
    parlayQuery
  ])
  
  // Prepare the results
  const singleStats = singleResults[0];
  const parlayStats = parlayResults[0];
  
  return [
    {
      type: "Single",
      total: Number(singleStats?.total || 0),
      wins: Number(singleStats?.wins || 0),
      winRate: singleStats?.total ? (Number(singleStats.wins || 0) / Number(singleStats.total)) * 100 : 0,
      profit: Number(singleStats?.profit || 0)
    },
    {
      type: "Parlay",
      total: Number(parlayStats?.total || 0),
      wins: Number(parlayStats?.wins || 0),
      winRate: parlayStats?.total ? (Number(parlayStats.wins || 0) / Number(parlayStats.total)) * 100 : 0,
      profit: Number(parlayStats?.profit || 0)
    }
  ]
}

async function getTeamPerformanceDataInternal({
  userId,
  limit,
}: {
  userId: string
  limit: number
}) {
  // Get team stats from the aggregated stats table
  const teamStats = await db
    .select({
      team: TeamStatsTable.team,
      totalBets: TeamStatsTable.totalBets,
      wins: TeamStatsTable.wins,
      losses: TeamStatsTable.losses,
      pushes: TeamStatsTable.pushes,
      pending: TeamStatsTable.pending,
      league: TeamStatsTable.league
    })
    .from(TeamStatsTable)
    .where(eq(TeamStatsTable.userId, userId))
    .orderBy(desc(TeamStatsTable.totalBets))
    .limit(limit)
  
  // Calculate win rate and format data for chart
  return teamStats.map(team => ({
    team: team.team,
    wins: team.wins,
    losses: team.losses,
    pushes: team.pushes,
    pending: team.pending,
    totalBets: team.totalBets,
    winRate: team.totalBets > 0 ? 
      ((team.wins / (team.wins + team.losses)) * 100).toFixed(1) : "0",
    league: team.league
  }))
}

async function getPropBetPerformanceInternal({
  userId,
  limit,
}: {
  userId: string
  limit: number
}) {
  // Get prop bet stats from the aggregated stats table
  const propStats = await db
    .select({
      propType: PropStatsTable.propType,
      totalBets: PropStatsTable.totalBets,
      wins: PropStatsTable.wins,
      losses: PropStatsTable.losses,
      pushes: PropStatsTable.pushes,
      pending: PropStatsTable.pending
    })
    .from(PropStatsTable)
    .where(eq(PropStatsTable.userId, userId))
    .orderBy(desc(PropStatsTable.totalBets))
    .limit(limit)
  
  // Calculate win rate and format data for chart
  return propStats.map(prop => ({
    propType: prop.propType,
    wins: prop.wins,
    losses: prop.losses,
    pushes: prop.pushes,
    pending: prop.pending,
    totalBets: prop.totalBets,
    winRate: prop.totalBets > 0 ? 
      ((prop.wins / (prop.wins + prop.losses)) * 100).toFixed(1) : "0"
  }))
}