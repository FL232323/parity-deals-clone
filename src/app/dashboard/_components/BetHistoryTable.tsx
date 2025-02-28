"use client"

import { Button } from "@/components/ui/button"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, InfoIcon } from "lucide-react"
import Link from "next/link"
import { createURL } from "@/lib/utils"
import { format } from "date-fns"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState } from "react"

interface ParlayLeg {
  id: string
  parlayId: string
  legNumber: number
  status?: string | null
  league?: string | null
  match?: string | null
  market?: string | null
  selection?: string | null
  price?: number | null
  gameDate?: Date | null
}

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
  legs?: ParlayLeg[] // For parlays
}

export function BetHistoryTable({
  bets,
  parlayLegs,
  currentPage,
  totalPages,
}: {
  bets: Bet[]
  parlayLegs: Record<string, ParlayLeg[]> // Map of parlayId to legs
  currentPage: number
  totalPages: number
}) {
  const [expandedParlays, setExpandedParlays] = useState<Record<string, boolean>>({})

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

  // Format result with appropriate styling for bet outcome
  const formatResult = (result?: string | null, isLeg: boolean = false) => {
    if (!result) return { text: "Pending", class: "bg-yellow-100 text-yellow-800" }
    
    try {
      const lowerResult = result.toLowerCase()
      
      // For parlay legs, use "Hit"/"Miss" instead of "Win"/"Loss"
      if (isLeg) {
        if (lowerResult.includes("win")) 
          return { text: "Hit", class: "bg-green-100 text-green-800" }
        if (lowerResult.includes("lose") || lowerResult.includes("lost")) 
          return { text: "Miss", class: "bg-red-100 text-red-800" }
      } else {
        if (lowerResult.includes("win")) 
          return { text: "Win", class: "bg-green-100 text-green-800" }
        if (lowerResult.includes("lose") || lowerResult.includes("lost")) 
          return { text: "Loss", class: "bg-red-100 text-red-800" }
      }
      
      if (lowerResult.includes("push")) 
        return { text: isLeg ? "Push" : "Push", class: "bg-blue-100 text-blue-800" }
      
      return { text: result, class: "bg-gray-100 text-gray-800" }
    } catch (error) {
      return { text: "Unknown", class: "bg-gray-100 text-gray-800" }
    }
  }

  // Toggle expanded state for a parlay
  const toggleParlay = (parlayId: string) => {
    setExpandedParlays(prev => ({
      ...prev,
      [parlayId]: !prev[parlayId]
    }))
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
              const isParlay = bet.type === "Parlay"
              const betLegs = parlayLegs[bet.id] || []
              const isExpanded = expandedParlays[bet.id] || false
              
              return (
                <>
                  <tr 
                    key={bet.id} 
                    className={`border-b hover:bg-muted/50 ${isParlay ? 'cursor-pointer' : ''}`}
                    onClick={isParlay ? () => toggleParlay(bet.id) : undefined}
                  >
                    <td className="px-4 py-3">{formatDate(bet.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${isParlay ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                          {bet.type || "Unknown"}
                        </span>
                        {isParlay && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {betLegs.length} leg{betLegs.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isParlay && (
                          <span className="ml-1">
                            {isExpanded ? 
                              <ChevronUpIcon className="h-4 w-4 text-muted-foreground" /> : 
                              <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />}
                          </span>
                        )}
                      </div>
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InfoIcon className="size-4" />
                      </Link>
                    </td>
                  </tr>
                  
                  {/* Render parlay legs if this is a parlay and it's expanded */}
                  {isParlay && isExpanded && betLegs.map(leg => {
                    const legResult = formatResult(leg.status, true)
                    
                    return (
                      <tr key={`${bet.id}-leg-${leg.legNumber}`} className="border-b bg-muted/20">
                        <td className="px-4 py-2 pl-8 text-sm">
                          <div className="flex items-center">
                            <span className="text-muted-foreground mr-2">Leg {leg.legNumber}</span>
                            {formatDate(leg.gameDate)}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className="inline-block px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            Leg
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">{leg.league || "-"}</td>
                        <td className="px-4 py-2 text-sm hidden md:table-cell">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="max-w-48 truncate block text-left">
                                {leg.match || "-"}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-80">{leg.match || "-"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-4 py-2 text-sm hidden lg:table-cell">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="max-w-40 truncate block text-left">
                                {`${leg.market || ""} ${leg.selection || ""}`}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-80">{`${leg.market || ""} ${leg.selection || ""}`}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-4 py-2 text-right text-sm">{leg.price ? leg.price.toFixed(2) : "-"}</td>
                        <td className="px-4 py-2 text-right text-sm">-</td>
                        <td className="px-4 py-2 text-center text-sm">
                          <span 
                            className={`inline-block px-2 py-1 text-xs rounded ${legResult.class}`}
                          >
                            {legResult.text}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-sm">-</td>
                        <td className="px-4 py-2 text-center text-sm">-</td>
                      </tr>
                    )
                  })}
                </>
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