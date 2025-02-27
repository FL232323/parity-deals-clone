import { auth } from "@clerk/nextjs/server"
import { Card } from "@/components/ui/card"
import { BetHistoryTable } from "../_components/BetHistoryTable"
import { db } from "@/drizzle/db"
import { SingleBetsTable, ParlayHeadersTable } from "@/drizzle/schema"
import { desc, eq } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UploadIcon, TrashIcon } from "lucide-react"
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
    // Get single bets
    const singleBets = await db
      .select({
        id: SingleBetsTable.id,
        date: SingleBetsTable.datePlaced,
        type: () => "Single" as const,
        league: SingleBetsTable.league,
        match: SingleBetsTable.match,
        betType: SingleBetsTable.betType,
        selection: SingleBetsTable.selection,
        odds: SingleBetsTable.price,
        stake: SingleBetsTable.wager,
        result: SingleBetsTable.result,
        profit: SingleBetsTable.winnings,
      })
      .from(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
      .orderBy(desc(SingleBetsTable.datePlaced))
      .limit(pageSize)
      .offset(offset)
    
    // Get parlay bets
    const parlayBets = await db
      .select({
        id: ParlayHeadersTable.id,
        date: ParlayHeadersTable.datePlaced,
        type: () => "Parlay" as const,
        league: ParlayHeadersTable.league,
        match: ParlayHeadersTable.match,
        betType: ParlayHeadersTable.betType,
        selection: ParlayHeadersTable.selection,
        odds: ParlayHeadersTable.price,
        stake: ParlayHeadersTable.wager,
        result: ParlayHeadersTable.result,
        profit: ParlayHeadersTable.winnings,
      })
      .from(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
      .orderBy(desc(ParlayHeadersTable.datePlaced))
      .limit(pageSize)
      .offset(offset)
    
    // Combine and sort by date
    const bets = [...singleBets, ...parlayBets]
      .sort((a, b) => {
        if (!a.date || !b.date) return 0
        return b.date.getTime() - a.date.getTime()
      })
      .slice(0, pageSize)
    
    // Get total count for pagination
    const singleBetsCount = await db
      .select({ count: db.fn.count() })
      .from(SingleBetsTable)
      .where(eq(SingleBetsTable.userId, userId))
    
    const parlayBetsCount = await db
      .select({ count: db.fn.count() })
      .from(ParlayHeadersTable)
      .where(eq(ParlayHeadersTable.userId, userId))
    
    const totalBets = Number(singleBetsCount[0]?.count || 0) + Number(parlayBetsCount[0]?.count || 0)
    const totalPages = Math.ceil(totalBets / pageSize)
    
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">Betting History</h1>
          <div className="flex gap-3">
            <ClearDataButton />
            <Button asChild>
              <Link href="/dashboard/upload">
                <UploadIcon className="size-4 mr-2" />
                Upload Data
              </Link>
            </Button>
          </div>
        </div>
        
        {bets && bets.length > 0 ? (
          <Card>
            <BetHistoryTable bets={bets} currentPage={page} totalPages={totalPages} />
          </Card>
        ) : (
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
        )}
      </>
    )
  } catch (error) {
    console.error("Error loading bet history:", error)
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">Betting History</h1>
          <div className="flex gap-3">
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