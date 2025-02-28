"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactNumber } from "@/lib/formatters"
import { Cell, Legend, Pie, PieChart, Tooltip as RechartsTooltip } from "recharts"

export function TeamPerformanceChart({
  chartData,
}: {
  chartData: { 
    team: string; 
    wins: number; 
    losses: number; 
    pushes: number; 
    pending: number;
    totalBets: number;
    winRate: string;
    league?: string | null;
  }[]
}) {
  const chartConfig = {
    wins: {
      label: "Wins",
      color: "#22c55e", // Green
    },
    losses: {
      label: "Losses",
      color: "#ef4444", // Red
    },
    pushes: {
      label: "Pushes",
      color: "#3b82f6", // Blue
    },
    pending: {
      label: "Pending",
      color: "#f59e0b", // Yellow
    }
  }

  if (!chartData || chartData.length === 0) {
    return (
      <p className="flex items-center justify-center text-muted-foreground min-h-[150px] max-h-[250px]">
        No team performance data available
      </p>
    )
  }

  // Take top 3 teams for the pie chart
  const topTeams = chartData.slice(0, 3);
  
  // Create data for the pie chart
  const createPieData = (team: any) => {
    return [
      { name: "Wins", value: team.wins, color: chartConfig.wins.color },
      { name: "Losses", value: team.losses, color: chartConfig.losses.color },
      { name: "Pushes", value: team.pushes, color: chartConfig.pushes.color },
      { name: "Pending", value: team.pending, color: chartConfig.pending.color }
    ].filter(item => item.value > 0); // Only include non-zero values
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {topTeams.map((team, index) => (
        <div key={index} className="flex flex-col items-center">
          <h4 className="font-medium mb-2">{team.team}</h4>
          <div className="text-sm text-muted-foreground mb-1">
            Win Rate: {team.winRate}% ({team.league || "Unknown"})
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            {team.wins}W - {team.losses}L - {team.pushes}P
          </div>
          
          <ChartContainer config={chartConfig} className="h-[150px] w-[150px]">
            <PieChart width={150} height={150}>
              <Pie
                data={createPieData(team)}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={60}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
              >
                {createPieData(team).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </div>
      ))}
    </div>
  )
}