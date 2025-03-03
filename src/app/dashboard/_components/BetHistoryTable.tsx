"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ChevronDownIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ChevronUpIcon, 
  FilterIcon, 
  InfoIcon, 
  SearchIcon, 
  XIcon 
} from "lucide-react"
import Link from "next/link"
import { createURL } from "@/lib/utils"
import { format } from "date-fns"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

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
  leagues = [],
}: {
  bets: Bet[]
  parlayLegs: Record<string, ParlayLeg[]> // Map of parlayId to legs
  currentPage: number
  totalPages: number
  leagues?: string[]
}) {
  const [expandedParlays, setExpandedParlays] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [betTypeFilter, setBetTypeFilter] = useState<"All" | "Single" | "Parlay">("All")
  const [resultFilter, setResultFilter] = useState<"All" | "Win" | "Loss" | "Push" | "Pending">("All")
  const [leagueFilter, setLeagueFilter] = useState<string>("All")
  const [showFilters, setShowFilters] = useState(false)
  const [filteredBets, setFilteredBets] = useState<Bet[]>(bets)

  // Effect to update filtered bets when filters change
  useEffect(() => {
    let result = [...bets]
    
    // Apply bet type filter
    if (betTypeFilter !== "All") {
      result = result.filter(bet => bet.type === betTypeFilter)
    }
    
    // Apply result filter
    if (resultFilter !== "All") {
      result = result.filter(bet => {
        const lowerResult = (bet.result || "").toLowerCase()
        
        if (resultFilter === "Win" && lowerResult.includes("win")) return true
        if (resultFilter === "Loss" && (lowerResult.includes("lose") || lowerResult.includes("lost"))) return true
        if (resultFilter === "Push" && lowerResult.includes("push")) return true
        if (resultFilter === "Pending" && (lowerResult === "" || !bet.result)) return true
        
        return false
      })
    }
    
    // Apply league filter
    if (leagueFilter !== "All") {
      result = result.filter(bet => bet.league === leagueFilter)
    }
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      result = result.filter(bet => {
        return (
          (bet.match && bet.match.toLowerCase().includes(search)) ||
          (bet.selection && bet.selection.toLowerCase().includes(search)) ||
          (bet.betType && bet.betType.toLowerCase().includes(search)) ||
          (bet.league && bet.league.toLowerCase().includes(search))
        )
      })
    }
    
    setFilteredBets(result)
  }, [bets, searchTerm, betTypeFilter, resultFilter, leagueFilter])

  // Safeguard against null/undefined bets array
  if (!bets || !Array.isArray(bets) || bets.length === 0) {
    return (
      <div className="p-4 text-center">
        <p>No betting data available for the current page.</p>
        <p className="text-muted-foreground mt-2">
          Try uploading some betting data or navigating to a different page.
        </p>
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

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setBetTypeFilter("All")
    setResultFilter("All")
    setLeagueFilter("All")
  }

  // Toggle expand all parlays
  const toggleExpandAll = () => {
    const parlayIds = filteredBets
      .filter(bet => bet.type === "Parlay")
      .map(bet => bet.id)
    
    const allExpanded = parlayIds.every(id => expandedParlays[id])
    
    const newExpandedState = {}
    parlayIds.forEach(id => {
      newExpandedState[id] = !allExpanded
    })
    
    setExpandedParlays(newExpandedState)
  }

  // Ensure parlayLegs is a valid object
  const safeLegsMap: Record<string, ParlayLeg[]> = parlayLegs || {}

  // Get filter stats
  const filterStats = {
    total: bets.length,
    filtered: filteredBets.length,
    singles: filteredBets.filter(bet => bet.type === "Single").length,
    parlays: filteredBets.filter(bet => bet.type === "Parlay").length
  }

  // Check if any filters are active
  const hasActiveFilters = searchTerm !== "" || betTypeFilter !== "All" || resultFilter !== "All" || leagueFilter !== "All"

  // Render active filters badges
  const renderFilterBadges = () => {
    if (!hasActiveFilters) return null
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {searchTerm && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Search: {searchTerm}
            <XIcon className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm("")} />
          </Badge>
        )}
        
        {betTypeFilter !== "All" && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Type: {betTypeFilter}
            <XIcon className="h-3 w-3 cursor-pointer" onClick={() => setBetTypeFilter("All")} />
          </Badge>
        )}
        
        {resultFilter !== "All" && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Result: {resultFilter}
            <XIcon className="h-3 w-3 cursor-pointer" onClick={() => setResultFilter("All")} />
          </Badge>
        )}
        
        {leagueFilter !== "All" && (
          <Badge variant="secondary" className="flex items-center gap-1">
            League: {leagueFilter}
            <XIcon className="h-3 w-3 cursor-pointer" onClick={() => setLeagueFilter("All")} />
          </Badge>
        )}
        
        {hasActiveFilters && (
          <Badge variant="destructive" className="flex items-center gap-1 cursor-pointer" onClick={clearFilters}>
            Clear All Filters
            <XIcon className="h-3 w-3" />
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        {/* Search field */}
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search teams, players, or events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searchTerm && (
            <XIcon 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" 
              onClick={() => setSearchTerm("")}
            />
          )}
        </div>
        
        {/* Filter button */}
        <Button 
          variant={showFilters ? "default" : "outline"} 
          className="flex items-center gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FilterIcon className="h-4 w-4" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
        
        {/* Expand all parlays button */}
        <Button 
          variant="outline" 
          onClick={toggleExpandAll}
          className="flex items-center gap-2"
        >
          {filteredBets.some(bet => bet.type === "Parlay") && filteredBets.filter(bet => bet.type === "Parlay").every(bet => expandedParlays[bet.id]) ? (
            <>
              <ChevronUpIcon className="h-4 w-4" />
              Collapse All Parlays
            </>
          ) : (
            <>
              <ChevronDownIcon className="h-4 w-4" />
              Expand All Parlays
            </>
          )}
        </Button>
      </div>
      
      {/* Filter badges */}
      {renderFilterBadges()}
      
      {/* Filters row */}
      {showFilters && (
        <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Bet Type</label>
            <Select value={betTypeFilter} onValueChange={(val) => setBetTypeFilter(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="All Bet Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Bet Types</SelectItem>
                <SelectItem value="Single">Singles</SelectItem>
                <SelectItem value="Parlay">Parlays</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Result</label>
            <Select value={resultFilter} onValueChange={(val) => setResultFilter(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="All Results" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Results</SelectItem>
                <SelectItem value="Win">Wins</SelectItem>
                <SelectItem value="Loss">Losses</SelectItem>
                <SelectItem value="Push">Pushes</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">League</label>
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Leagues</SelectItem>
                {leagues.map(league => (
                  <SelectItem key={league} value={league}>{league}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}
      
      {/* Filter results stats */}
      {hasActiveFilters && (
        <div className="text-sm mb-4 text-muted-foreground">
          Showing {filterStats.filtered} of {filterStats.total} bets 
          ({filterStats.singles} singles, {filterStats.parlays} parlays)
        </div>
      )}
      
      {/* Main table */}
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
            {filteredBets.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No bets match your filters. Try adjusting your search criteria.
                </td>
              </tr>
            ) : (
              filteredBets.map(bet => {
                if (!bet || typeof bet !== 'object' || !bet.id) return null;
                
                const result = formatResult(bet.result)
                const isParlay = bet.type === "Parlay"
                const betLegs = isParlay ? (safeLegsMap[bet.id] || []) : []
                const isExpanded = expandedParlays[bet.id] || false
                
                return (
                  <React.Fragment key={bet.id}>
                    <tr 
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
                            <TooltipTrigger asChild>
                              <span className="max-w-48 truncate block text-left">
                                {bet.match || "-"}
                              </span>
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
                            <TooltipTrigger asChild>
                              <span className="max-w-40 truncate block text-left">
                                {bet.selection || "-"}
                              </span>
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
                    {isParlay && isExpanded && betLegs.length > 0 && betLegs.map(leg => {
                      if (!leg || !leg.legNumber) return null;
                      
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
                                <TooltipTrigger asChild>
                                  <span className="max-w-48 truncate block text-left">
                                    {leg.match || "-"}
                                  </span>
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
                                <TooltipTrigger asChild>
                                  <span className="max-w-40 truncate block text-left">
                                    {`${leg.market || ""} ${leg.selection || ""}`}
                                  </span>
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
                    
                    {/* Show message when there are no legs for an expanded parlay */}
                    {isParlay && isExpanded && betLegs.length === 0 && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={10} className="px-4 py-3 text-center text-sm text-muted-foreground">
                          No leg details available for this parlay.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls */}
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