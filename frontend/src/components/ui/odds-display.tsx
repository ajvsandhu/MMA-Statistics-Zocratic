import React from 'react'
import { cn } from "@/lib/utils"

interface OddsDisplayProps {
  odds: number | null
  bookmaker: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function OddsDisplay({ odds, bookmaker, className, size = 'md' }: OddsDisplayProps) {
  if (!odds || !bookmaker) {
    return null
  }

  const formatOdds = (odds: number): string => {
    if (odds > 0) {
      return `+${odds}`
    }
    return `${odds}`
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  // Special styling for preferred bookmakers
  const isDraftKings = bookmaker === 'DraftKings'
  const isFanDuel = bookmaker === 'FanDuel'

  return (
    <div className={cn(
      "inline-flex items-center gap-1 rounded-md font-medium hover:bg-primary/20 transition-colors",
      isDraftKings 
        ? "bg-green-500/10 border border-green-500/20 text-green-600 hover:bg-green-500/20"
        : isFanDuel
        ? "bg-blue-500/10 border border-blue-500/20 text-blue-600 hover:bg-blue-500/20"
        : "bg-primary/10 border border-primary/20 text-primary",
      sizeClasses[size],
      className
    )}>
      <span className="font-bold">{formatOdds(odds)}</span>
      <span className="text-muted-foreground text-xs opacity-80">({bookmaker})</span>
    </div>
  )
}

interface FighterOddsProps {
  fighterName: string
  odds: number | null
  bookmaker: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function FighterOdds({ fighterName, odds, bookmaker, className, size = 'md' }: FighterOddsProps) {
  if (!odds || !bookmaker) {
    return (
      <div className={cn("text-xs text-muted-foreground italic", className)}>
        Odds unavailable
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <OddsDisplay odds={odds} bookmaker={bookmaker} size={size} />
    </div>
  )
} 