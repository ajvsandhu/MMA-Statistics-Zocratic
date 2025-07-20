"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { History, Calendar, Loader2, Trophy, Target, CheckCircle, XCircle, ArrowLeft, ChevronRight } from 'lucide-react'
import { ENDPOINTS } from "@/lib/api-config"

interface HistoricalEvent {
  event_id: string
  filename: string
  created_at: string
  event_name?: string
  event_date?: string
  is_current?: boolean
  completed_fights?: number
  total_fights?: number
  is_complete?: boolean
}

interface Fight {
  fighter1_name?: string
  fighter2_name?: string
  prediction?: {
    predicted_winner_name?: string
    confidence_percent?: number
    fighter1_win_probability_percent?: number
    fighter2_win_probability_percent?: number
  }
  result?: {
    winner_name?: string
    method?: string
    round?: number
    time?: string
  }
  prediction_correct?: boolean
}

interface EventData {
  event_info?: {
    name?: string
    date?: string
    total_fights?: number
    completed_fights?: number
  }
  fights?: Fight[]
}

export function FightHistoryModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [events, setEvents] = useState<HistoricalEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)
  const [selectedEventName, setSelectedEventName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'events' | 'details'>('events')

  // Load events when modal opens
  useEffect(() => {
    if (isOpen && events.length === 0) {
      loadEvents()
    }
  }, [isOpen])

  const loadEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      // First, try to get current/active events from the database
      const currentResponse = await fetch(ENDPOINTS.UPCOMING_EVENTS)
      const allEvents = []
      
      if (currentResponse.ok) {
        const currentData = await currentResponse.json()
        if (currentData.event_name && currentData.fights) {
          // Check if this event has any completed fights
          const completedFights = currentData.fights.filter((fight: any) => fight.status === 'completed')
          if (completedFights.length > 0) {
            const totalFights = currentData.fights.length
            const isEventComplete = completedFights.length === totalFights
            
            allEvents.push({
              event_id: 'current_event',
              filename: 'current_event',
              created_at: currentData.scraped_at || new Date().toISOString(),
              event_name: currentData.event_name,
              event_date: currentData.event_date,
              is_current: !isEventComplete, // Only show as current if not all fights are done
              completed_fights: completedFights.length,
              total_fights: totalFights,
              is_complete: isEventComplete
            })
          }
        }
      }
      
      // Then get historical events from storage
      const historyResponse = await fetch(ENDPOINTS.FIGHT_RESULTS)
      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        if (historyData.events) {
          allEvents.push(...historyData.events.map((event: any) => ({ ...event, is_current: false })))
        }
      }
      
      setEvents(allEvents)
    } catch (err) {
      setError('Failed to load events')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEventDetails = async (filename: string, eventName: string) => {
    setLoading(true)
    setError(null)
    try {
      let eventData
      
      if (filename === 'current_event') {
        // Load current event from database
        const response = await fetch(ENDPOINTS.UPCOMING_EVENTS)
        if (!response.ok) throw new Error('Failed to load current event')
        const data = await response.json()
        
        // Transform the database format to match the expected format
        eventData = {
          event_info: {
            name: data.event_name,
            date: data.event_date,
            completed_fights: data.fights?.filter((fight: any) => fight.status === 'completed').length || 0,
            total_fights: data.fights?.length || 0
          },
          fights: data.fights || []
        }
      } else {
        // Load historical event from storage
        const response = await fetch(ENDPOINTS.FIGHT_RESULTS_EVENT(filename))
        if (!response.ok) throw new Error('Failed to load event details')
        const data = await response.json()
        eventData = data.event
      }
      
      setSelectedEvent(eventData)
      setSelectedEventName(eventName)
      setCurrentView('details')
    } catch (err) {
      setError('Failed to load event details')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatEventName = (filename: string) => {
    return filename
      .replace('.json', '')
      .replace('TEST_', '')
      .replace(/_/g, ' ')
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const goBackToEvents = () => {
    setCurrentView('events')
    setSelectedEvent(null)
    setSelectedEventName('')
  }

  const EventsGrid = () => (
    <div className="space-y-4 pt-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-bold">Historical Fight Events</h3>
        <p className="text-sm text-muted-foreground">Select an event to view detailed predictions and results</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <div className="space-y-3">
              <p className="font-medium text-destructive">{error}</p>
              <Button onClick={loadEvents} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="space-y-3">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <h4 className="font-medium">No Events Found</h4>
                <p className="text-sm text-muted-foreground">No historical fight events are available at this time.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card 
              key={event.filename}
              className="cursor-pointer transition-all hover:shadow-md border hover:border-primary/50"
              onClick={() => loadEventDetails(event.filename, event.event_name || formatEventName(event.filename))}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={event.is_current ? "default" : "secondary"} className="text-xs">
                          {event.is_current ? "LIVE EVENT" : "UFC EVENT"}
                        </Badge>
                        {event.completed_fights && event.total_fights && (
                          <Badge variant={event.is_complete ? "default" : "outline"} className="text-xs">
                            {event.completed_fights}/{event.total_fights} {event.is_complete ? "Complete" : "Completed"}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-lg leading-tight mb-1">
                        {event.event_name || formatEventName(event.filename)}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {event.is_current ? "Live Results Available" : 
                         event.event_date ? event.event_date : formatDate(event.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors flex-shrink-0">
                    <span className="text-sm font-medium">View Results</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  const EventDetails = () => (
    <div>
      {/* Back Button & Header */}
      <div className="sticky top-0 z-10 bg-background backdrop-blur-xl border-b mb-4 -mx-4 px-4 py-4 rounded-t-lg">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={goBackToEvents} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Button>
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-xl font-bold">{selectedEventName}</h3>
            <p className="text-sm text-muted-foreground">Fight predictions and results analysis</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading event details...</p>
          </div>
        </div>
      ) : !selectedEvent ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-12 text-center">
            <div className="space-y-3">
              <p className="text-destructive">Failed to load event details</p>
              <Button onClick={goBackToEvents} variant="outline">
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Event Summary Card */}
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <h4 className="text-xl font-bold">
                    {selectedEvent.event_info?.name || selectedEventName}
                  </h4>
                  <p className="text-muted-foreground">
                    {selectedEvent.event_info?.date || 'Date Unknown'}
                  </p>
                </div>
                <Badge variant="default" className="text-sm px-3 py-1 flex-shrink-0">
                  {selectedEvent.event_info?.completed_fights || 0} / {selectedEvent.event_info?.total_fights || 0} Fights
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Fights Section */}
          {selectedEvent.fights && selectedEvent.fights.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="text-lg font-semibold">Fight Results</h4>
              </div>
              
              <div className="space-y-2">
                {selectedEvent.fights.map((fight, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="p-3 space-y-2">
                      {/* Fight Header */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h5 className="font-bold text-sm">
                            {fight.fighter1_name || 'Fighter 1'} vs {fight.fighter2_name || 'Fighter 2'}
                          </h5>
                          <p className="text-xs text-muted-foreground">Fight {index + 1}</p>
                        </div>
                        {fight.result && fight.result.winner_name && fight.prediction_correct !== undefined && (
                          <Badge 
                            variant={fight.prediction_correct ? "default" : "destructive"}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs flex-shrink-0"
                          >
                            {fight.prediction_correct ? (
                              <><CheckCircle className="h-2.5 w-2.5" /> Correct</>
                            ) : (
                              <><XCircle className="h-2.5 w-2.5" /> Incorrect</>
                            )}
                          </Badge>
                        )}
                      </div>

                      {/* Prediction vs Result Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* AI Prediction */}
                        {fight.prediction ? (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="p-2 space-y-2">
                              <div className="flex items-center gap-1 text-primary">
                                <Target className="h-3 w-3" />
                                <h6 className="font-semibold text-xs">AI Prediction</h6>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">Predicted Winner</p>
                                  <p className="font-semibold text-xs">
                                    {fight.prediction.predicted_winner_name}
                                  </p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">Confidence</p>
                                  <p className="font-bold text-primary text-xs">
                                    {fight.prediction.confidence_percent?.toFixed(1)}%
                                  </p>
                                </div>
                                
                                {fight.prediction.fighter1_win_probability_percent && (
                                  <>
                                    <Separator />
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground font-medium">Win Probabilities</p>
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-muted-foreground truncate pr-2">
                                            {fight.fighter1_name}
                                          </span>
                                          <span className="font-bold text-primary text-xs">
                                            {fight.prediction.fighter1_win_probability_percent.toFixed(1)}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-muted-foreground truncate pr-2">
                                            {fight.fighter2_name}
                                          </span>
                                          <span className="font-bold text-primary text-xs">
                                            {fight.prediction.fighter2_win_probability_percent?.toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="bg-muted/50">
                            <CardContent className="p-2 flex items-center justify-center h-full">
                              <p className="text-muted-foreground text-center text-xs">No prediction data available</p>
                            </CardContent>
                          </Card>
                        )}

                        {/* Actual Result */}
                        {fight.result && fight.result.winner_name ? (
                          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                            <CardContent className="p-2 space-y-2">
                              <div className="flex items-center gap-1 text-green-700 dark:text-green-400">
                                <Trophy className="h-3 w-3" />
                                <h6 className="font-semibold text-xs">Actual Result</h6>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">Winner</p>
                                  <p className="font-semibold text-xs text-green-700 dark:text-green-400">
                                    {fight.result.winner_name}
                                  </p>
                                </div>
                                {fight.result.method && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground">Method</p>
                                    <p className="font-medium text-xs">{fight.result.method}</p>
                                  </div>
                                )}
                                {fight.result.round && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground">Round</p>
                                    <p className="font-medium text-xs">Round {fight.result.round}</p>
                                  </div>
                                )}
                                {fight.result.time && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground">Time</p>
                                    <p className="font-medium text-xs">{fight.result.time}</p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="bg-muted/50">
                            <CardContent className="p-2 flex items-center justify-center h-full">
                              <p className="text-muted-foreground text-center text-xs">No result data available</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="space-y-3">
                  <Trophy className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">No fight data available for this event</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          View History
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] h-[90vh] p-0">
        <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
          {currentView === 'events' ? <EventsGrid /> : <EventDetails />}
        </div>
      </DialogContent>
    </Dialog>
  )
} 