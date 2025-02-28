"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Bar, BarChart, Cell, Legend, XAxis, YAxis } from "recharts"

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
      color: "hsl(200, 70%, 50%)",
    },
    totalBets: {
      label: "Total Bets",
      color: "hsl(280, 70%, 50%)",
    },
  }

  if (chartData.length === 0) {
    return (
      <p className="flex items-center justify-center text-muted-foreground min-h-[150px] max-h-[250px]">
        No data available
      </p>
    )
  }

  // Format the data for the chart
  const formattedData = chartData.map(item => ({
    ...item,
    winRate: parseFloat(item.winRate),
    tooltipLabel: `${item.propType}: ${item.wins}/${item.totalBets} (${item.winRate}%)`,
  }));

  // Get color based on win rate (red to green gradient)
  const getColor = (winRate: number) => {
    // Below 40% is red, above 60% is green, in between is a gradient
    if (winRate < 40) return "#ef4444";
    if (winRate > 60) return "#22c55e";
    
    // Calculate gradient between red and green
    const redComponent = Math.round(255 * (1 - (winRate - 40) / 20));
    const greenComponent = Math.round(255 * ((winRate - 40) / 20));
    
    return `rgb(${redComponent}, ${greenComponent}, 0)`;
  };

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[250px] w-full"
    >
      <BarChart 
        accessibilityLayer 
        data={formattedData} 
        layout="vertical" 
        margin={{ left: 100 }}
      >
        <XAxis 
          type="number" 
          tickLine={false} 
          tickMargin={10} 
          tickFormatter={value => `${value}%`}
          domain={[0, 100]} 
        />
        <YAxis 
          dataKey="propType" 
          type="category" 
          tickLine={false} 
          tickMargin={10}
          width={100}
        />
        <ChartTooltip content={<ChartTooltipContent nameKey="tooltipLabel" />} />
        <Bar 
          dataKey="winRate" 
          fill="var(--color-winRate)"
          minPointSize={3}
          radius={[0, 4, 4, 0]}
        >
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.winRate)} />
          ))}
        </Bar>
        <Legend />
      </BarChart>
    </ChartContainer>
  )
}