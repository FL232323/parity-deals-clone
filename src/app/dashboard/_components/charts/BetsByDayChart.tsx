"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Bar, BarChart, Legend, XAxis, YAxis } from "recharts"

export function BetsByDayChart({
  chartData,
}: {
  chartData: { date: string; singleBets: number; parlayBets: number; profit: number }[]
}) {
  const chartConfig = {
    singleBets: {
      label: "Single Bets",
      color: "hsl(220, 70%, 50%)",
    },
    parlayBets: {
      label: "Parlay Bets",
      color: "hsl(280, 70%, 50%)",
    },
    profit: {
      label: "Profit/Loss",
      color: "#22c55e", // Green
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
      <BarChart accessibilityLayer data={chartData}>
        <XAxis dataKey="date" tickLine={false} tickMargin={10} />
        <YAxis
          tickLine={false}
          tickMargin={10}
          allowDecimals={false}
          tickFormatter={formatCompactNumber}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="singleBets" fill="var(--color-singleBets)" stackId="a" />
        <Bar dataKey="parlayBets" fill="var(--color-parlayBets)" stackId="a" />
        <Legend />
      </BarChart>
    </ChartContainer>
  )
}