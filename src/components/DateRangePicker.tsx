"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, format } from "date-fns"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  className?: string
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  align?: "start" | "center" | "end"
}

export function DateRangePicker({
  className,
  dateRange,
  onDateRangeChange,
  align = "start",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  // Common date range presets
  const dateRangePresets = [
    {
      name: "Last 7 Days",
      range: {
        from: addDays(new Date(), -7),
        to: new Date(),
      },
    },
    {
      name: "Last 30 Days",
      range: {
        from: addDays(new Date(), -30),
        to: new Date(),
      },
    },
    {
      name: "Last 90 Days",
      range: {
        from: addDays(new Date(), -90),
        to: new Date(),
      },
    },
    {
      name: "Last 365 Days",
      range: {
        from: addDays(new Date(), -365),
        to: new Date(),
      },
    },
  ]

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="p-3 border-b">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Select Range</h4>
              <div className="flex flex-wrap gap-2">
                {dateRangePresets.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onDateRangeChange(preset.range)
                      setIsOpen(false)
                    }}
                  >
                    {preset.name}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDateRangeChange(undefined)
                    setIsOpen(false)
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
