"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Bar, BarChart, Legend, XAxis, YAxis } from "recharts"

export function WinRateByBetTypeChart({
  chartData,
}: {
  chartData: { type: string; total: number; wins: number; winRate: number; profit: number }[]
}) {
  const chartConfig = {
    winRate: {
      label: "Win Rate (%)",
      color: "hsl(200, 70%, 50%)",
    },
    profit: {
      label: "Profit",
      color: "hsl(120, 70%, 50%)",
    }
  }

  if (chartData.length === 0) {
    return (
      <p className="flex items-center justify-center text-muted-foreground min-h-[150px] max-h-[250px]">
        No data available
      </p>
    )
  }

  // Format the data for better display
  const formattedData = chartData.map(item => ({
    ...item,
    winRate: parseFloat(item.winRate.toFixed(1)),
    totalLabel: `${item.type}: ${item.wins}/${item.total} (${item.winRate.toFixed(1)}%)`,
    profitFormatted: `$${item.profit.toFixed(2)}`
  }))

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[250px] w-full"
    >
      <BarChart 
        accessibilityLayer 
        data={formattedData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <XAxis dataKey="type" tickLine={false} tickMargin={10} />
        <YAxis 
          yAxisId="left"
          orientation="left"
          tickLine={false} 
          tickMargin={10}
          domain={[0, 100]}
          label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
        />
        <YAxis 
          yAxisId="right"
          orientation="right"
          tickLine={false}
          tickMargin={10}
          tickFormatter={(value) => `$${value}`}
          label={{ value: 'Profit', angle: 90, position: 'insideRight' }}
        />
        <ChartTooltip content={<ChartTooltipContent nameKey="totalLabel" />} />
        <Bar 
          dataKey="winRate" 
          yAxisId="left"
          fill="var(--color-winRate)" 
        />
        <Bar 
          dataKey="profit" 
          yAxisId="right"
          fill={({ profit }) => profit >= 0 ? "var(--color-profit)" : "#ef4444"}
        />
        <Legend />
      </BarChart>
    </ChartContainer>
  )
}