"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown, Check } from "lucide-react"

interface SimpleSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: readonly { label: string; value: string }[]
  placeholder?: string
  className?: string
}

export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
}: SimpleSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find(option => option.value === value)

  return (
    <div ref={selectRef} className={cn("relative", className)}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption ? selectedOption.label : placeholder}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>
      {isOpen && (
        <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  value === option.value && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  onValueChange(option.value)
                  setIsOpen(false)
                }}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === option.value && <Check className="h-4 w-4" />}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 