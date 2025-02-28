"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

export function PropBetPerformanceChart({
  chartData,
}: {
  chartData: { 
    propType: string; 
    wins: number; 
    losses: number; 
    pushes: number; 
    pending: number;
    totalBets: number;
    winRate: string;
  }[]
}) {
  const chartConfig = {
    winRate: {
      label: "Win Rate (%)",
      color: "hsl(120, 70%, 50%)",
    },
    totalBets: {
      label: "Total Bets",
      color: "hsl(200, 70%, 50%)",
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
    winRate: parseFloat(item.winRate),
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[250px] w-full"
    >
      <BarChart 
        accessibilityLayer 
        data={formattedData}
        layout="vertical"
        margin={{ left: 120 }}
      >
        <XAxis type="number" tickLine={false} tickMargin={10} />
        <YAxis 
          dataKey="propType" 
          type="category" 
          tickLine={false} 
          tickMargin={10}
          width={120}
        />
        <ChartTooltip content={<ChartTooltipContent nameKey="propType"/>} />
        <Bar 
          dataKey="winRate" 
          fill="var(--color-winRate)" 
          radius={[0, 4, 4, 0]}
          name="Win Rate (%)"
        />
      </BarChart>
    </ChartContainer>
  )
}