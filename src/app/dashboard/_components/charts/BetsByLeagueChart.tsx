"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Bar, BarChart, Legend, XAxis, YAxis } from "recharts"

export function BetsByLeagueChart({
  chartData,
}: {
  chartData: { league: string; bets: number; parlayLegs: number; profit: number; totalBets: number }[]
}) {
  const chartConfig = {
    bets: {
      label: "Single Bets",
      color: "hsl(220, 70%, 50%)",
    },
    parlayLegs: {
      label: "Parlay Legs",
      color: "hsl(280, 70%, 50%)",
    }
  }

  if (chartData.length === 0) {
    return (
      <p className="flex items-center justify-center text-muted-foreground min-h-[150px] max-h-[250px]">
        No data available
      </p>
    )
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[250px] w-full"
    >
      <BarChart 
        accessibilityLayer 
        data={chartData}
        layout="vertical"
        margin={{ left: 100 }}
      >
        <XAxis type="number" tickLine={false} tickMargin={10} tickFormatter={formatCompactNumber} />
        <YAxis 
          dataKey="league" 
          type="category" 
          tickLine={false} 
          tickMargin={10}
          width={100}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="bets" fill="var(--color-bets)" stackId="a" />
        <Bar dataKey="parlayLegs" fill="var(--color-parlayLegs)" stackId="a" />
        <Legend />
      </BarChart>
    </ChartContainer>
  )
}