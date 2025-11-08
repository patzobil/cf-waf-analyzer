"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateRangePickerProps {
  value: { start: Date; end: Date }
  onChange: (range: { start: Date; end: Date }) => void
}

const presets = [
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 3 months", value: "3m" },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const handlePresetChange = (preset: string) => {
    const now = new Date()
    let start: Date
    
    switch (preset) {
      case "24h":
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "3m":
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    
    onChange({ start, end: now })
  }

  return (
    <div className="flex items-center gap-2">
      <Select onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? (
              <>
                {format(value.start, "MMM dd, yyyy")} -{" "}
                {format(value.end, "MMM dd, yyyy")}
              </>
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Custom date range picker coming soon
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
