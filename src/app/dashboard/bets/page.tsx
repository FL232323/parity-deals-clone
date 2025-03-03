import { auth } from "@clerk/nextjs/server"
import { Card } from "@/components/ui/card"
import { BetHistoryTable } from "../_components/BetHistoryTable"
import { db } from "@/drizzle/db"
import { SingleBetsTable, ParlayHeadersTable, ParlayLegsTable } from "@/drizzle/schema"
import { desc, eq, sql } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UploadIcon, BarChart2Icon } from "lucide-react"
import { ClearDataButton } from "../_components/ClearDataButton"

export default async function BetHistoryPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const { userId, redirectToSignIn } = auth()
  if (!userId) return redirectToSignIn()
  
  const page = searchParams.page ? parseInt(searchParams.page) : 1
  const pageSize = 15
  const offset = (page - 1) * pageSize
  
  try {
    console.log("Fetching betting data for user:", userId)
    
    // Get total count for pagination first to check if there's any data
    const singleBetsCount = await db
      .select({ count: sql`COUNT(*)`.mapWith(Number) })
      .from(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
    
    const parlayBetsCount = await db
      .select({ count: sql`COUNT(*)`.mapWith(Number) })
      .from(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
    
    console.log("Data counts:", { singles: singleBetsCount[0]?.count, parlays: parlayBetsCount[0]?.count })
    
    // Get summary statistics
    const totalBets = Number(singleBetsCount[0]?.count || 0) + Number(parlayBetsCount[0]?.count || 0)
    const totalPages = Math.ceil(totalBets / pageSize) || 1  // Ensure at least 1 page
    
    // Early return if no data
    if (totalBets === 0) {
      return (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-semibold">Betting History</h1>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/dashboard/analytics">
                  <BarChart2Icon className="size-4 mr-2" />
                  Analytics
                </Link>
              </Button>
              <ClearDataButton />
              <Button asChild>
                <Link href="/dashboard/upload">
                  <UploadIcon className="size-4 mr-2" />
                  Upload Data
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h2 className="text-2xl font-semibold mb-2">No betting data found</h2>
            <p className="mb-6 text-muted-foreground">
              Upload your betting data to see your betting history and analytics.
            </p>
            <Button asChild>
              <Link href="/dashboard/upload">
                <UploadIcon className="size-4 mr-2" />
                Upload Betting Data
              </Link>
            </Button>
          </div>
        </>
      )
    }
    
    // Get single bets - handle NULL values with COALESCE
    const singleBets = await db
      .select({
        id: SingleBetsTable.id,
        date: SingleBetsTable.datePlaced,
        type: sql`'Single'`.as('type'),
        league: sql`COALESCE(${SingleBetsTable.league}, '')`.as('league'),
        match: sql`COALESCE(${SingleBetsTable.match}, '')`.as('match'),
        betType: sql`COALESCE(${SingleBetsTable.betType}, '')`.as('betType'),
        selection: sql`COALESCE(${SingleBetsTable.selection}, '')`.as('selection'),
        odds: SingleBetsTable.price,
        stake: SingleBetsTable.wager,
        result: sql`COALESCE(${SingleBetsTable.result}, '')`.as('result'),
        profit: SingleBetsTable.winnings,
      })
      .from(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
      .orderBy(desc(SingleBetsTable.datePlaced))
      .limit(pageSize)
      .offset(offset)
    
    console.log(`Retrieved ${singleBets.length} single bets`)
    
    // Get parlay bets - handle NULL values with COALESCE
    const parlayBets = await db
      .select({
        id: ParlayHeadersTable.id,
        date: ParlayHeadersTable.datePlaced,
        type: sql`'Parlay'`.as('type'),
        league: sql`COALESCE(${ParlayHeadersTable.league}, '')`.as('league'),
        match: sql`COALESCE(${ParlayHeadersTable.match}, '')`.as('match'),
        betType: sql`COALESCE(${ParlayHeadersTable.betType}, '')`.as('betType'),
        selection: sql`COALESCE(${ParlayHeadersTable.selection}, '')`.as('selection'),
        odds: ParlayHeadersTable.price,
        stake: ParlayHeadersTable.wager,
        result: sql`COALESCE(${ParlayHeadersTable.result}, '')`.as('result'),
        profit: ParlayHeadersTable.winnings,
      })
      .from(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
      .orderBy(desc(ParlayHeadersTable.datePlaced))
      .limit(pageSize)
      .offset(offset)
    
    console.log(`Retrieved ${parlayBets.length} parlay bets`)
    
    // Safe handling of parlay legs - only proceed if we have parlays
    let legsMap: Record<string, any[]> = {}
    
    if (parlayBets && parlayBets.length > 0) {
      // Get all parlay IDs from the current page and ensure they're valid
      const parlayIds = parlayBets
        .map(bet => bet?.id)
        .filter(id => id !== undefined && id !== null) as string[]
      
      if (parlayIds && parlayIds.length > 0) {
        console.log("Retrieving legs for parlays:", parlayIds)
        
        try {
          // Safer approach for IN query - query each parlay separately to avoid parameter limits
          const allLegs = []
          
          for (const parlayId of parlayIds) {
            const legs = await db
              .select({
                id: ParlayLegsTable.id,
                parlayId: ParlayLegsTable.parlayId,
                legNumber: ParlayLegsTable.legNumber,
                status: ParlayLegsTable.status,
                league: ParlayLegsTable.league,
                match: ParlayLegsTable.match,
                market: ParlayLegsTable.market,
                selection: ParlayLegsTable.selection,
                price: ParlayLegsTable.price,
                gameDate: ParlayLegsTable.gameDate,
              })
              .from(ParlayLegsTable)
              .where(eq(ParlayLegsTable.parlayId, parlayId))
              .orderBy(ParlayLegsTable.legNumber)
            
            allLegs.push(...legs)
          }
          
          console.log(`Retrieved ${allLegs.length} parlay legs for ${parlayIds.length} parlays`)
          
          // Group legs by parlay ID
          if (allLegs && allLegs.length > 0) {
            legsMap = allLegs.reduce((acc, leg) => {
              if (leg && leg.parlayId) {
                if (!acc[leg.parlayId]) {
                  acc[leg.parlayId] = []
                }
                acc[leg.parlayId].push(leg)
              }
              return acc
            }, {} as Record<string, any[]>)
          }
        } catch (error) {
          console.error("Error fetching parlay legs:", error)
          // Continue with empty legs map
        }
      }
    }
    
    // Combine and sort by date
    const bets = [...(singleBets || []), ...(parlayBets || [])]
      .filter(bet => bet !== null && bet !== undefined)
      .sort((a, b) => {
        if (!a?.date || !b?.date) return 0
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
      .slice(0, pageSize)
    
    console.log(`Combining bets - total: ${bets.length}`)
    
    // Get betting summary for display
    const allBets = await db
      .select({
        profit: sql`COALESCE(SUM(${SingleBetsTable.winnings}), 0)`.mapWith(Number),
        count: sql`COUNT(*)`.mapWith(Number)
      })
      .from(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
    
    const allParlays = await db
      .select({
        profit: sql`COALESCE(SUM(${ParlayHeadersTable.winnings}), 0)`.mapWith(Number),
        count: sql`COUNT(*)`.mapWith(Number)
      })
      .from(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
    
    const totalProfit = (allBets[0]?.profit || 0) + (allParlays[0]?.profit || 0)
    const profitLossText = totalProfit >= 0 
      ? `$${totalProfit.toFixed(2)} profit` 
      : `$${Math.abs(totalProfit).toFixed(2)} loss`
    
    // Get unique leagues for filtering
    const uniqueLeagues = await db
      .select({
        league: sql`DISTINCT COALESCE(${SingleBetsTable.league}, '')`.as('league')
      })
      .from(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
      .orderBy(SingleBetsTable.league)
    
    // Additional leagues from parlays
    const parlayLeagues = await db
      .select({
        league: sql`DISTINCT COALESCE(${ParlayHeadersTable.league}, '')`.as('league')
      })
      .from(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
      .orderBy(ParlayHeadersTable.league)
    
    // Combine all unique leagues
    const leagues = [...uniqueLeagues, ...parlayLeagues]
      .map(l => l.league)
      .filter((value, index, self) => self.indexOf(value) === index && value !== "")
      .sort()
    
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">Betting History</h1>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/analytics">
                <BarChart2Icon className="size-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <ClearDataButton />
            <Button asChild>
              <Link href="/dashboard/upload">
                <UploadIcon className="size-4 mr-2" />
                Upload Data
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Bets</h3>
            <div className="text-2xl font-bold">{totalBets}</div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Profit/Loss</h3>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitLossText}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Bet Types</h3>
            <div className="text-2xl font-bold">
              {allBets[0]?.count || 0} Singles / {allParlays[0]?.count || 0} Parlays
            </div>
          </Card>
        </div>
        
        {/* Bet History Table */}
        <Card>
          <BetHistoryTable 
            bets={bets} 
            parlayLegs={legsMap} 
            currentPage={page} 
            totalPages={totalPages}
            leagues={leagues}
          />
        </Card>
      </>
    )
  } catch (error) {
    console.error("Error loading bet history:", error)
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">Betting History</h1>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/analytics">
                <BarChart2Icon className="size-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <ClearDataButton />
            <Button asChild>
              <Link href="/dashboard/upload">
                <UploadIcon className="size-4 mr-2" />
                Upload Data
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h2 className="text-2xl font-semibold mb-2">Error loading betting data</h2>
          <p className="mb-6 text-muted-foreground">
            There was an error loading your betting history. Please try again later.
          </p>
          <p className="text-sm text-red-500 mb-4">Error details: {error instanceof Error ? error.message : String(error)}</p>
          <Button asChild>
            <Link href="/dashboard/upload">
              <UploadIcon className="size-4 mr-2" />
              Upload Betting Data
            </Link>
          </Button>
        </div>
      </>
    )
  }
}
