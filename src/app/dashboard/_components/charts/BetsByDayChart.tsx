"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from "recharts"

interface BetsByDayChartData {
  date: string
  bets: number
  wins: number
  profit: number
}

export function BetsByDayChart({
  chartData,
}: {
  chartData: BetsByDayChartData[]
}) {
  const chartConfig = {
    bets: {
      label: "Bets",
      color: "hsl(var(--chart-1))",
    },
    profit: {
      label: "Profit",
      color: "hsl(var(--chart-2))",
    },
  }

  if (chartData.length === 0) {
    return (
      <p className="flex items-center justify-center text-muted-foreground min-h-[150px] max-h-[250px]">
        No data available
      </p>
    )
  }

  // Format profit for tooltips
  const formatProfit = (value: number) => {
    return value >= 0 
      ? `+$${value.toFixed(2)}` 
      : `-$${Math.abs(value).toFixed(2)}`
  }

  // Calculate domains to make chart look good
  const maxBets = Math.max(...chartData.map(d => d.bets)) || 5
  const minProfit = Math.min(...chartData.map(d => d.profit)) || -100
  const maxProfit = Math.max(...chartData.map(d => d.profit)) || 100
  
  // Ensure profit domain has reasonable bounds
  const profitDomain = [
    Math.min(-10, minProfit),
    Math.max(10, maxProfit)
  ]

  return (
    <div className="min-h-[150px] max-h-[250px] w-full">
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickLine={false} 
            tickMargin={10} 
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            tickMargin={10}
            allowDecimals={false}
            domain={[0, maxBets * 1.1]}
            tickFormatter={formatCompactNumber}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            tickMargin={10}
            domain={profitDomain}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-md">
                    <div className="font-medium">{label}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        <div className="size-2 rounded-full bg-[hsl(var(--chart-1))]" />
                        <span>Bets: {payload[0].value}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="size-2 rounded-full bg-[hsl(var(--chart-3))]" />
                        <span>Wins: {payload[1]?.value}</span>
                      </div>
                      <div className="flex items-center gap-1 col-span-2">
                        <div className="size-2 rounded-full bg-[hsl(var(--chart-2))]" />
                        <span className={payload[2]?.value >= 0 ? 'text-green-600' : 'text-red-600'}>
                          Profit: {formatProfit(payload[2]?.value || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Bar 
            yAxisId="left" 
            dataKey="bets" 
            fill="hsl(var(--chart-1))" 
            name="Bets"
          />
          <Bar 
            yAxisId="left" 
            dataKey="wins" 
            fill="hsl(var(--chart-3))" 
            name="Wins"
          />
          <Line 
            yAxisId="right"
            type="monotone"
            dataKey="profit"
            stroke="hsl(var(--chart-2))"
            name="Profit/Loss"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
