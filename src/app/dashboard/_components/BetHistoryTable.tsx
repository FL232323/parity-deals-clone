"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "lucide-react"
import Link from "next/link"
import { createURL } from "@/lib/utils"
import { format } from "date-fns"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Bet {
  id: string
  date?: Date | null
  type: "Single" | "Parlay"
  league?: string | null
  match?: string | null
  betType?: string | null
  selection?: string | null
  odds?: number | null
  stake?: number | null
  result?: string | null
  profit?: number | null
}

export function BetHistoryTable({
  bets,
  currentPage,
  totalPages,
}: {
  bets: Bet[]
  currentPage: number
  totalPages: number
}) {
  // Safeguard against null/undefined bets array
  if (!bets || !Array.isArray(bets)) {
    return (
      <div className="p-4 text-center">
        <p>No betting data available</p>
      </div>
    );
  }

  // Format date in a readable way
  const formatDate = (date?: Date | null) => {
    if (!date) return "Unknown"
    try {
      return format(date, "MMM d, yyyy h:mm a")
    } catch (error) {
      return "Invalid date"
    }
  }

  // Format result with appropriate styling
  const formatResult = (result?: string | null) => {
    if (!result) return { text: "Pending", class: "bg-yellow-100 text-yellow-800" }
    
    try {
      const lowerResult = result.toLowerCase()
      if (lowerResult.includes("win")) return { text: "Win", class: "bg-green-100 text-green-800" }
      if (lowerResult.includes("lose") || lowerResult.includes("lost")) return { text: "Loss", class: "bg-red-100 text-red-800" }
      if (lowerResult.includes("push")) return { text: "Push", class: "bg-blue-100 text-blue-800" }
      
      return { text: result, class: "bg-gray-100 text-gray-800" }
    } catch (error) {
      return { text: "Unknown", class: "bg-gray-100 text-gray-800" }
    }
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">League</th>
              <th className="px-4 py-2 text-left hidden md:table-cell">Team/Match</th>
              <th className="px-4 py-2 text-left hidden lg:table-cell">Selection</th>
              <th className="px-4 py-2 text-right">Odds</th>
              <th className="px-4 py-2 text-right">Stake</th>
              <th className="px-4 py-2 text-center">Result</th>
              <th className="px-4 py-2 text-right">Profit</th>
              <th className="px-4 py-2 text-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {bets.map(bet => {
              if (!bet || typeof bet !== 'object') return null;
              
              const result = formatResult(bet.result)
              
              return (
                <tr key={bet.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3">{formatDate(bet.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${bet.type === "Parlay" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                      {bet.type || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{bet.league || "-"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="max-w-48 truncate block text-left">
                          {bet.match || "-"}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-80">{bet.match || "-"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="max-w-40 truncate block text-left">
                          {bet.selection || "-"}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-80">{bet.selection || "-"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="px-4 py-3 text-right">{bet.odds ? bet.odds.toFixed(2) : "-"}</td>
                  <td className="px-4 py-3 text-right">${bet.stake ? bet.stake.toFixed(2) : "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span 
                      className={`inline-block px-2 py-1 text-xs rounded ${result.class}`}
                    >
                      {result.text}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${(bet.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${bet.profit ? Math.abs(bet.profit).toFixed(2) : "-"}
                    {bet.profit && bet.profit < 0 && " (Loss)"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link 
                      href={`/dashboard/bets/${bet.id}`}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <InfoIcon className="size-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <Button
          variant="outline"
          disabled={currentPage <= 1}
          asChild
        >
          <Link href={createURL("/dashboard/bets", {}, { page: (currentPage - 1).toString() })}>
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            Previous
          </Link>
        </Button>
        
        <span>Page {currentPage} of {totalPages || 1}</span>
        
        <Button
          variant="outline"
          disabled={currentPage >= totalPages}
          asChild
        >
          <Link href={createURL("/dashboard/bets", {}, { page: (currentPage + 1).toString() })}>
            Next
            <ChevronRightIcon className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
