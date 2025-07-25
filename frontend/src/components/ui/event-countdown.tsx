"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Lock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventCountdownProps {
  eventStartTime: string | null
  eventName?: string
  className?: string
  compact?: boolean
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  isLocked: boolean
  isPastEvent: boolean
}

function calculateTimeRemaining(eventStartTime: string | null): TimeRemaining {
  if (!eventStartTime) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isLocked: true,
      isPastEvent: false
    }
  }

  const now = new Date()
  const eventTime = new Date(eventStartTime)
  const lockTime = new Date(eventTime.getTime() - 10 * 60 * 1000) // 10 minutes before event

  // Check if event has already passed
  if (now > eventTime) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isLocked: true,
      isPastEvent: true
    }
  }

  // Check if picks are locked (less than 10 minutes to event)
  if (now > lockTime) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isLocked: true,
      isPastEvent: false
    }
  }

  // Calculate time remaining until picks lock
  const timeDiff = lockTime.getTime() - now.getTime()
  
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)

  return {
    days,
    hours,
    minutes,
    seconds,
    isLocked: false,
    isPastEvent: false
  }
}

function formatTimeUnit(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatCompactTime(timeRemaining: TimeRemaining): string {
  if (timeRemaining.days > 0) {
    return `${timeRemaining.days}d ${formatTimeUnit(timeRemaining.hours)}h ${formatTimeUnit(timeRemaining.minutes)}m`
  } else if (timeRemaining.hours > 0) {
    return `${formatTimeUnit(timeRemaining.hours)}h ${formatTimeUnit(timeRemaining.minutes)}m ${formatTimeUnit(timeRemaining.seconds)}s`
  } else {
    return `${formatTimeUnit(timeRemaining.minutes)}m ${formatTimeUnit(timeRemaining.seconds)}s`
  }
}

export function EventCountdown({ eventStartTime, eventName, className, compact = false }: EventCountdownProps) {
  const [timeRemaining, setTimeRemaining] = React.useState<TimeRemaining>(
    calculateTimeRemaining(eventStartTime)
  )

  React.useEffect(() => {
    if (!eventStartTime) return

    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(eventStartTime))
    }, 1000)

    return () => clearInterval(interval)
  }, [eventStartTime])

  // Compact mode for inline display
  if (compact) {
    if (!eventStartTime) {
      return (
        <Badge variant="secondary" className={cn("text-xs", className)}>
          <Clock className="h-3 w-3 mr-1" />
          Time TBD
        </Badge>
      )
    }

    if (timeRemaining.isPastEvent) {
      return (
        <Badge variant="secondary" className={cn("text-xs", className)}>
          <Clock className="h-3 w-3 mr-1" />
          Event Ended
        </Badge>
      )
    }

    if (timeRemaining.isLocked) {
      return (
        <Badge variant="destructive" className={cn("text-xs", className)}>
          <Lock className="h-3 w-3 mr-1" />
          Picks Locked
        </Badge>
      )
    }

    const urgency = timeRemaining.days === 0 && timeRemaining.hours < 2
    const badgeVariant = urgency ? "destructive" : "default"

    return (
      <Badge variant={badgeVariant} className={cn("text-xs font-mono", className)}>
        <Clock className="h-3 w-3 mr-1" />
        {formatCompactTime(timeRemaining)}
      </Badge>
    )
  }

  // Full card mode (original functionality)
  // If no event start time available
  if (!eventStartTime) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg flex items-center justify-center gap-2">
            <Clock className="w-5 h-5" />
            Event Countdown
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Badge variant="secondary" className="text-sm">
            Event time not available
          </Badge>
        </CardContent>
      </Card>
    )
  }

  // If event has passed
  if (timeRemaining.isPastEvent) {
    return (
      <Card className={cn("w-full border-gray-500", className)}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg flex items-center justify-center gap-2">
            <Clock className="w-5 h-5" />
            {eventName || "Event"} Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Badge variant="secondary" className="text-sm">
            Event has ended
          </Badge>
        </CardContent>
      </Card>
    )
  }

  // If picks are locked
  if (timeRemaining.isLocked) {
    return (
      <Card className={cn("w-full border-red-500", className)}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg flex items-center justify-center gap-2 text-red-600">
            <Lock className="w-5 h-5" />
            Picks Locked
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Badge variant="destructive" className="text-sm">
            <AlertTriangle className="w-4 h-4 mr-1" />
            No more picks allowed
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            Picks lock 10 minutes before event start
          </p>
        </CardContent>
      </Card>
    )
  }

  // Show countdown
  const urgency = timeRemaining.days === 0 && timeRemaining.hours < 2
  const borderColor = urgency ? "border-orange-500" : "border-green-500"
  const textColor = urgency ? "text-orange-600" : "text-green-600"

  return (
    <Card className={cn("w-full", borderColor, className)}>
      <CardHeader className="text-center pb-2">
        <CardTitle className={cn("text-lg flex items-center justify-center gap-2", textColor)}>
          <Clock className="w-5 h-5" />
          Picks Lock In
        </CardTitle>
        {eventName && (
          <p className="text-sm text-muted-foreground">{eventName}</p>
        )}
      </CardHeader>
      <CardContent className="text-center">
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center">
            <div className={cn("text-2xl font-bold", textColor)}>
              {formatTimeUnit(timeRemaining.days)}
            </div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
          <div className="text-center">
            <div className={cn("text-2xl font-bold", textColor)}>
              {formatTimeUnit(timeRemaining.hours)}
            </div>
            <div className="text-xs text-muted-foreground">Hours</div>
          </div>
          <div className="text-center">
            <div className={cn("text-2xl font-bold", textColor)}>
              {formatTimeUnit(timeRemaining.minutes)}
            </div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>
          <div className="text-center">
            <div className={cn("text-2xl font-bold", textColor)}>
              {formatTimeUnit(timeRemaining.seconds)}
            </div>
            <div className="text-xs text-muted-foreground">Seconds</div>
          </div>
        </div>
        
        <Badge variant={urgency ? "destructive" : "default"} className="text-sm">
          {urgency ? (
            <>
              <AlertTriangle className="w-4 h-4 mr-1" />
              Picks lock soon!
            </>
          ) : (
            "Picks available"
          )}
        </Badge>
        
        <p className="text-xs text-muted-foreground mt-2">
          Picks lock 10 minutes before event start
        </p>
      </CardContent>
    </Card>
  )
} 