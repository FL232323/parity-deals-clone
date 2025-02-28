import { HasPermission } from "@/components/HasPermission"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CHART_INTERVALS,
  getBettingDataByDay,
  getBettingDataByLeague,
  getTeamPerformanceData,
  getPropBetPerformance,
  getWinRateByBetType
} from "@/server/db/bettingAnalytics"
import { canAccessAnalytics } from "@/server/permissions"
import { auth } from "@clerk/nextjs/server"
import { ChevronDownIcon, Dices, LineChart, TrendingUp, Trophy } from "lucide-react"
import { BetsByDayChart } from "../_components/charts/BetsByDayChart"
import { BetsByLeagueChart } from "../_components/charts/BetsByLeagueChart"
import { TeamPerformanceChart } from "../_components/charts/TeamPerformanceChart"
import { PropBetPerformanceChart } from "../_components/charts/PropBetPerformanceChart"
import { WinRateByBetTypeChart } from "../_components/charts/WinRateByBetTypeChart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createURL } from "@/lib/utils"
import { TimezoneDropdownMenuItem } from "../_components/TimezoneDropdownMenuItem"

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: {
    interval?: string
    timezone?: string
  }
}) {
  const { userId, redirectToSignIn } = auth()
  if (userId == null) return redirectToSignIn()

  const interval =
    CHART_INTERVALS[searchParams.interval as keyof typeof CHART_INTERVALS] ??
    CHART_INTERVALS.last7Days
  const timezone = searchParams.timezone || "UTC"

  return (
    <>
      <div className="mb-6 flex justify-between items-baseline">
        <h1 className="text-3xl font-semibold">Betting Analytics</h1>
        <HasPermission permission={canAccessAnalytics}>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {interval.label}
                  <ChevronDownIcon className="size-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {Object.entries(CHART_INTERVALS).map(([key, value]) => (
                  <DropdownMenuItem asChild key={key}>
                    <Link
                      href={createURL("/dashboard/analytics", searchParams, {
                        interval: key,
                      })}
                    >
                      {value.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {timezone}
                  <ChevronDownIcon className="size-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link
                    href={createURL("/dashboard/analytics", searchParams, {
                      timezone: "UTC",
                    })}
                  >
                    UTC
                  </Link>
                </DropdownMenuItem>
                <TimezoneDropdownMenuItem searchParams={searchParams} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </HasPermission>
      </div>
      
      <HasPermission permission={canAccessAnalytics} renderFallback>
        <div className="flex flex-col gap-8">
          <BettingActivityCard
            interval={interval}
            timezone={timezone}
            userId={userId}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <BetTypePerformanceCard
              interval={interval}
              timezone={timezone}
              userId={userId}
            />
            <BetsByLeagueCard
              interval={interval}
              timezone={timezone}
              userId={userId}
            />
          </div>
          
          <TeamStatsCard
            userId={userId}
          />
          
          <PropBetPerformanceCard
            userId={userId}
          />
        </div>
      </HasPermission>
    </>
  )
}

async function BettingActivityCard({
  interval,
  timezone,
  userId,
}: {
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  timezone: string
  userId: string
}) {
  const chartData = await getBettingDataByDay({
    interval,
    timezone,
    userId,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <CardTitle>Betting Activity</CardTitle>
        </div>
        <LineChart className="ml-auto h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <BetsByDayChart chartData={chartData} />
      </CardContent>
    </Card>
  )
}

async function BetTypePerformanceCard({
  interval,
  timezone,
  userId,
}: {
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  timezone: string
  userId: string
}) {
  const chartData = await getWinRateByBetType({
    interval,
    timezone,
    userId,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <CardTitle>Win Rate by Bet Type</CardTitle>
        </div>
        <Trophy className="ml-auto h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <WinRateByBetTypeChart chartData={chartData} />
      </CardContent>
    </Card>
  )
}

async function BetsByLeagueCard({
  interval,
  timezone,
  userId,
}: {
  interval: (typeof CHART_INTERVALS)[keyof typeof CHART_INTERVALS]
  timezone: string
  userId: string
}) {
  const chartData = await getBettingDataByLeague({
    interval,
    timezone,
    userId,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <CardTitle>Betting by League</CardTitle>
        </div>
        <TrendingUp className="ml-auto h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <BetsByLeagueChart chartData={chartData} />
      </CardContent>
    </Card>
  )
}

async function TeamStatsCard({
  userId,
}: {
  userId: string
}) {
  const chartData = await getTeamPerformanceData({
    userId,
    limit: 3
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <TeamPerformanceChart chartData={chartData} />
      </CardContent>
    </Card>
  )
}

async function PropBetPerformanceCard({
  userId,
}: {
  userId: string
}) {
  const chartData = await getPropBetPerformance({
    userId,
    limit: 10
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <CardTitle>Prop Bet Performance</CardTitle>
        </div>
        <Dices className="ml-auto h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <PropBetPerformanceChart chartData={chartData} />
      </CardContent>
    </Card>
  )
}