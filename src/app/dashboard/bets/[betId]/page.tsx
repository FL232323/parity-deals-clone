import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import { db } from "@/drizzle/db"
import { SingleBetsTable, ParlayHeadersTable, ParlayLegsTable } from "@/drizzle/schema"
import { eq, or } from "drizzle-orm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"

export default async function BetDetailPage({
  params,
}: {
  params: { betId: string }
}) {
  const { userId, redirectToSignIn } = auth()
  if (!userId) return redirectToSignIn()
  
  const betId = params.betId
  
  // Check if this is a single bet
  const singleBet = await db.query.SingleBetsTable.findFirst({
    where: (table, { and, eq }) => 
      and(eq(table.id, betId), eq(table.userId, userId))
  })
  
  // Check if this is a parlay bet
  const parlayBet = await db.query.ParlayHeadersTable.findFirst({
    where: (table, { and, eq }) => 
      and(eq(table.id, betId), eq(table.userId, userId)),
    with: {
      legs: {
        orderBy: (legs, { asc }) => [asc(legs.legNumber)]
      }
    }
  })
  
  if (!singleBet && !parlayBet) {
    return notFound()
  }
  
  // Format date in a readable way
  const formatDate = (date?: Date | null) => {
    if (!date) return "Unknown"
    return format(date, "MMM d, yyyy h:mm a")
  }
  
  // Format result with appropriate styling
  const getResultClass = (result?: string | null) => {
    if (!result) return "text-yellow-600"
    
    const lowerResult = result.toLowerCase()
    if (lowerResult.includes("win")) return "text-green-600"
    if (lowerResult.includes("lose") || lowerResult.includes("lost")) return "text-red-600"
    if (lowerResult.includes("push")) return "text-blue-600"
    
    return "text-gray-600"
  }
  
  const resultClass = getResultClass(singleBet?.result || parlayBet?.result)
  
  return (
    <>
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/dashboard/bets">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Bet History
          </Link>
        </Button>
      </div>
      
      <h1 className="mb-6 text-3xl font-semibold">
        Bet Details
      </h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>{singleBet ? "Single Bet" : "Parlay"}</span>
              <span className={resultClass}>
                {singleBet?.result || parlayBet?.result || "Pending"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoItem label="Date Placed" value={formatDate(singleBet?.datePlaced || parlayBet?.datePlaced)} />
              <InfoItem label="League" value={singleBet?.league || parlayBet?.league || "N/A"} />
              <InfoItem label="Match" value={singleBet?.match || parlayBet?.match || "N/A"} />
              <InfoItem label="Selection" value={singleBet?.selection || parlayBet?.selection || "N/A"} />
              <InfoItem label="Odds" value={singleBet?.price?.toString() || parlayBet?.price?.toString() || "N/A"} />
              <InfoItem label="Wager" value={`$${singleBet?.wager?.toFixed(2) || parlayBet?.wager?.toFixed(2) || "N/A"}`} />
              
              {singleBet?.winnings != null || parlayBet?.winnings != null ? (
                <InfoItem 
                  label="Winnings" 
                  value={`$${(singleBet?.winnings || parlayBet?.winnings || 0).toFixed(2)}`} 
                  valueClass={(singleBet?.winnings || parlayBet?.winnings || 0) >= 0 ? "text-green-600" : "text-red-600"}
                />
              ) : (
                <InfoItem label="Potential Winnings" value={`$${parlayBet?.potentialPayout?.toFixed(2) || "N/A"}`} />
              )}
            </div>
          </CardContent>
        </Card>
        
        {parlayBet?.legs && parlayBet.legs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Parlay Legs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Leg</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">League</th>
                      <th className="px-4 py-2 text-left">Match</th>
                      <th className="px-4 py-2 text-left">Market</th>
                      <th className="px-4 py-2 text-left">Selection</th>
                      <th className="px-4 py-2 text-right">Odds</th>
                      <th className="px-4 py-2 text-left">Game Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parlayBet.legs.map((leg) => (
                      <tr key={leg.id} className="border-b">
                        <td className="px-4 py-2">{leg.legNumber}</td>
                        <td className="px-4 py-2">
                          <span className={getResultClass(leg.status)}>
                            {leg.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-2">{leg.league || "N/A"}</td>
                        <td className="px-4 py-2">{leg.match || "N/A"}</td>
                        <td className="px-4 py-2">{leg.market || "N/A"}</td>
                        <td className="px-4 py-2">{leg.selection || "N/A"}</td>
                        <td className="px-4 py-2 text-right">{leg.price?.toFixed(2) || "N/A"}</td>
                        <td className="px-4 py-2">{leg.gameDate ? formatDate(leg.gameDate) : "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function InfoItem({ 
  label, 
  value,
  valueClass
}: { 
  label: string,
  value: string,
  valueClass?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClass || ""}`}>{value}</span>
    </div>
  )
}
