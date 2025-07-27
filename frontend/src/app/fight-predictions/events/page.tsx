"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import Image from 'next/image'
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { ArrowUpRight, Calendar, Clock, ExternalLink, ArrowLeft, CheckCircle, XCircle, Trophy, Coins } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"
import { ENDPOINTS } from "@/lib/api-config"
import { FighterOdds } from "@/components/ui/odds-display"
import { FightHistoryModal } from "@/components/ui/fight-history-modal"
import { PlacePickModal } from "@/components/ui/place-pick-modal"
import { EventCountdown } from "@/components/ui/event-countdown"
import { useAuth } from '@/hooks/use-auth'

interface Fighter {
  fighter_name: string
  fighter_url: string
  fighter_id: number
  tap_link: string
  image: string
}

interface Prediction {
  fighter1_name: string
  fighter2_name: string
  fighter1_id: number
  fighter2_id: number
  predicted_winner: number
  predicted_winner_name: string
  confidence_percent: number
  fighter1_win_probability_percent: number
  fighter2_win_probability_percent: number
}

interface OddsData {
  event_id: string
  home_team: string
  away_team: string
  best_odds: {
    home_team: { odds: number | null; bookmaker: string | null }
    away_team: { odds: number | null; bookmaker: string | null }
  }
  fighter1_odds: { odds: number | null; bookmaker: string | null }
  fighter2_odds: { odds: number | null; bookmaker: string | null }
  bookmaker_count: number
  last_update: string
}

interface Fight {
  fighter1_name: string
  fighter1_url: string
  fighter1_id: number
  fighter1_tap_link: string
  fighter1_image: string
  fighter2_name: string
  fighter2_url: string
  fighter2_id: number
  fighter2_tap_link: string
  fighter2_image: string
  prediction: Prediction
  odds_data?: OddsData | null
  odds_event_id?: string | null
  result?: {
    winner_name?: string
    method?: string
    round?: number
    time?: string
  }
  status?: string
  prediction_correct?: boolean
  fight_id: string
}

interface Event {
  event_name: string
  event_date: string
  event_url: string
  event_start_time?: string | null
  scraped_at: string
  fights: Fight[]
  // Additional fields for completed events
  status?: string
  total_fights?: number
  completed_fights?: number
  exported_at?: string
  accuracy_stats?: {
    total_fights: number
    completed_fights: number
    correct_predictions: number
    accuracy_percentage: number
  }
  id: number
}

export default function EventAnalysisPage() {
  const router = useRouter()
  const [eventData, setEventData] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isContentReady, setIsContentReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const { user, isAuthenticated, getToken } = useAuth()
  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  const [modalState, setModalState] = useState({
    isOpen: false,
    eventId: 0,
    fightId: '',
    fighterId: 0,
    fighterName: '',
    oddsAmerican: 0,
  })

  const [userBets, setUserBets] = useState<any[]>([])
  const [predictionWindowOpen, setPredictionWindowOpen] = useState<boolean>(true)

  // Function to check if event has passed
  const isEventPassed = () => {
    if (!eventData?.event_date) return false
    const eventDate = new Date(eventData.event_date)
    const now = new Date()
    return eventDate < now
  }

  // Function to check prediction window status
  const checkPredictionWindow = async () => {
    if (!isAuthenticated || !eventData?.id) return

    console.log('DEBUG: Checking prediction window for event ID:', eventData.id)

    try {
      const token = await getToken()
      if (!token) return

      // Use the actual event ID from eventData instead of hard-coded 5
      const response = await fetch(`${ENDPOINTS.GET_BALANCE.replace('/balance', `/event-picks/${eventData.id}`)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPredictionWindowOpen(data.prediction_window_open)
      }
    } catch (error) {
      console.error('Error checking prediction window:', error)
    }
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check prediction window status when authenticated and periodically
  useEffect(() => {
    if (isAuthenticated && eventData?.id) {
      checkPredictionWindow()
      // Check every 30 seconds to keep status updated
      const interval = setInterval(checkPredictionWindow, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, eventData?.id])

  // Fetch coin balance when user is authenticated - independent of event data
  useEffect(() => {
    let isMounted = true;

    async function fetchBalance() {
      if (!isAuthenticated) {
        setCoinBalance(null)
        return
      }

      try {
        const token = await getToken()
        if (!token || !isMounted) return

        console.log('Fetching user balance...')
        const balanceResponse = await fetch(ENDPOINTS.GET_BALANCE, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!isMounted) return;

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json()
          setCoinBalance(balanceData.balance)
          console.log('Balance loaded:', balanceData.balance)
        } else {
          console.error('Failed to fetch balance:', balanceResponse.status, balanceResponse.statusText)
          setCoinBalance(0) // Set to 0 instead of null to stop loading state
        }
      } catch (error) {
        console.error('Error fetching balance:', error)
        setCoinBalance(0) // Set to 0 instead of null to stop loading state
      }
    }

    fetchBalance()
    
    return () => {
      isMounted = false;
    }
  }, [isAuthenticated]) // Only depend on authentication status

  // Fetch event-specific bets when both auth and event data are available
  useEffect(() => {
    let isMounted = true;

    async function fetchEventBets() {
      if (!isAuthenticated || !eventData?.id) {
        setUserBets([])
        return
      }

      try {
        const token = await getToken()
        if (!token || !isMounted) return

        console.log('Fetching event bets for event ID:', eventData.id)
        const betsResponse = await fetch(`${ENDPOINTS.MY_PICKS}?event_id=${eventData.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!isMounted) return;

        if (betsResponse.ok) {
          const betsData = await betsResponse.json()
          setUserBets(betsData)
          console.log('Event bets loaded:', betsData.length, 'bets')
        } else {
          console.error('Failed to fetch bets:', betsResponse.status, betsResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching event bets:', error)
      }
    }

    fetchEventBets()
    
    return () => {
      isMounted = false;
    }
  }, [isAuthenticated, eventData?.id]) // Run when authentication status or event ID changes

  // Function to refresh balance after successful bet - CALL MANUALLY ONLY
  const refreshBalance = async () => {
    console.log('Manually refreshing balance and bets...')
    
    try {
      const token = await getToken()
      if (!token) return

      // Always refresh balance
      const balanceResponse = await fetch(ENDPOINTS.GET_BALANCE, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        setCoinBalance(balanceData.balance)
        console.log('Balance manually refreshed:', balanceData.balance)
      }

      // Only refresh bets if we have event data
      if (eventData?.id) {
        const userBetsResponse = await fetch(`${ENDPOINTS.MY_PICKS}?event_id=${eventData.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (userBetsResponse.ok) {
          const betsData = await userBetsResponse.json()
          setUserBets(betsData)
          console.log('Bets manually refreshed:', betsData.length, 'bets')
        }
      }
    } catch (error) {
      console.error('Error manually refreshing data:', error)
    }
  }

  useEffect(() => {
    async function fetchEventData() {
      try {
        // Try to fetch active upcoming event first
        let response = await fetch(ENDPOINTS.UPCOMING_EVENTS)
        
                 if (response.ok) {
           // Active event exists - use it
           const eventData = await response.json()
           console.log('DEBUG: Fetched event data:', eventData)
           console.log('DEBUG: Event ID is:', eventData.id)
           setEventData(eventData)
           setError(null)
        } else {
          // No active event - fetch most recent completed event from bucket
          response = await fetch(ENDPOINTS.FIGHT_RESULTS)
          if (!response.ok) {
            throw new Error('Failed to fetch event data')
          }
          
          const eventsData = await response.json()
          if (!eventsData.events || eventsData.events.length === 0) {
            throw new Error('No event data available')
          }
          
          // Get the most recent completed event
          const mostRecentEvent = eventsData.events[0]
          const eventResponse = await fetch(`${ENDPOINTS.FIGHT_RESULTS_EVENT}/${mostRecentEvent.filename}`)
          
          if (!eventResponse.ok) {
            throw new Error('Failed to fetch completed event data')
          }
          
          const eventResponseData = await eventResponse.json()
          setEventData(eventResponseData.event)
          setError(null)
        }
      } catch (err) {
        console.error('Error fetching event data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch event data')
      } finally {
        setIsLoading(false)
        setTimeout(() => setIsContentReady(true), 100)
      }
    }

    fetchEventData()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
          <div className="space-y-2">
            <div className="flex items-center h-12 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-16 h-8 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse"></div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-md w-2/3 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-md w-32 animate-pulse"></div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-full w-40 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-full w-24 animate-pulse"></div>
            </div>
            
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-full max-w-md mt-4 animate-pulse"></div>
          </div>

          <div className="h-px w-full bg-gray-200 dark:bg-gray-800 my-6"></div>

          {[...Array(3)].map((_, i) => (
            <div 
              key={i} 
              className="bg-card/50 backdrop-blur border border-border rounded-lg p-4 md:p-6 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex flex-row gap-1 sm:gap-2 md:gap-8 items-center">
                <div className="flex flex-col items-center text-center flex-1 w-[40%]">
                  <div className="w-16 md:w-32 h-16 md:h-32 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                  <div className="h-4 w-20 mt-2 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                  <div className="h-3 w-16 mt-2 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                  <div className="h-6 w-14 mt-3 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                </div>

                <div className="flex flex-col items-center justify-center p-1 md:p-3 w-[20%]">
                  <div className="w-8 md:w-12 h-8 md:h-12 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                  <div className="h-3 w-12 mt-2 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                </div>

                <div className="flex flex-col items-center text-center flex-1 w-[40%]">
                  <div className="w-16 md:w-32 h-16 md:h-32 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                  <div className="h-4 w-20 mt-2 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                  <div className="h-3 w-16 mt-2 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                  <div className="h-6 w-14 mt-3 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                </div>
              </div>

              <div className="h-px w-full bg-gray-200 dark:bg-gray-800 my-4"></div>

              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">Failed to load event data: {error}</p>
        </div>
      </div>
    )
  }

  if (!eventData) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h1 className="text-3xl font-bold">No event data available</h1>
          <p className="text-muted-foreground">There is no upcoming event data to display at this time.</p>
        </div>
      </div>
    )
  }

  if (!isContentReady) {
    return null
  }

  return (
    <PageTransition variant="fade">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <AnimatedContainer className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
          <AnimatedItem variant="fadeIn" className="space-y-2">
            <div className="flex items-center justify-between min-h-[3rem] mb-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/fight-predictions')}
                  className="gap-1 px-1 sm:px-2 h-8 sm:h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only text-sm">Back</span>
                </Button>
                <h2 className="text-sm sm:text-lg md:text-xl font-light">Event Analysis</h2>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                {isAuthenticated ? (
                  coinBalance !== null ? (
                    <div className="flex items-center gap-1 sm:gap-2 bg-primary/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                      <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                      <span className="font-semibold text-xs sm:text-sm">{coinBalance} coins</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 sm:gap-2 bg-muted px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                      <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground animate-pulse" />
                      <span className="text-xs sm:text-sm text-muted-foreground">Loading...</span>
                    </div>
                  )
                ) : (
                  <Link href="/auth">
                    <Button variant="outline" size="sm" className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                      <span className="hidden sm:inline">Sign In to Place Picks</span>
                      <span className="sm:hidden">Sign In</span>
                    </Button>
                  </Link>
                )}
                <FightHistoryModal />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-thin leading-tight">{eventData.event_name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{eventData.event_date || 'Date Unknown'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Clock className="h-2 w-2 sm:h-3 sm:w-3" /> 
                <span className="text-xs">Last Updated: {new Date(eventData.scraped_at || eventData.exported_at || Date.now()).toLocaleString()}</span>
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Trophy className="h-2 w-2 sm:h-3 sm:w-3" />
                <span className="text-xs">{eventData.completed_fights || 0}/{eventData.total_fights || 0} Fights</span>
              </Badge>
              {eventData.event_url && (
                <Link 
                  href={eventData.event_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-2 w-2 sm:h-3 sm:w-3" /> 
                  UFC Stats
                </Link>
              )}
              {/* Compact countdown next to UFC Stats for upcoming events */}
              {eventData.status !== 'completed' && eventData.event_start_time && isAuthenticated && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Picks Lock In:</span>
                  <EventCountdown 
                    eventStartTime={eventData.event_start_time} 
                    eventName={eventData.event_name}
                    compact={true}
                  />
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm sm:text-base pt-2 leading-relaxed">
              {eventData.status === 'completed' 
                ? 'AI-powered fight predictions and results analysis for the completed UFC event.'
                : 'AI-powered fight predictions for the upcoming UFC event, based on comprehensive fighter analysis.'
              }
            </p>
          </AnimatedItem>

          <Separator className="my-4 sm:my-6" />

          <AnimatedContainer className="space-y-4 sm:space-y-6 md:space-y-8" delay={0.05}>
            {eventData.fights.map((fight, index) => {
              const fighter1Win = fight.prediction?.fighter1_win_probability_percent >= 50
              const fighter2Win = !fighter1Win
              
              return (
                <AnimatedItem key={index} variant="fadeUp" delay={0.1 + (index * 0.05)} className="relative">
                  <Card className="bg-card/50 backdrop-blur border-primary/20 hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-2 sm:p-3 md:p-4 lg:p-6 space-y-2 sm:space-y-3 md:space-y-4">
                      <div className="flex flex-row gap-1 sm:gap-2 md:gap-8 items-center">
                        <div className="flex flex-col items-center text-center flex-1 w-[40%] min-w-0">
                          <div className="relative w-16 md:w-32 h-16 md:h-32 mb-2 md:mb-4 overflow-hidden rounded-full">
                            {fight.fighter1_image ? (
                              <div className="w-full h-full relative">
                                <Image 
                                  src={fight.fighter1_image} 
                                  alt={fight.fighter1_name} 
                                  fill
                                  className="object-cover"
                                  style={{ 
                                    borderRadius: '50%',
                                    border: fighter1Win ? '4px solid rgba(74, 222, 128, 0.5)' : '4px solid transparent'
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-full h-full rounded-full bg-card flex items-center justify-center border-4 border-muted">
                                <span className="text-lg md:text-2xl font-bold">{fight.fighter1_name.charAt(0)}</span>
                              </div>
                            )}
                            {fighter1Win && (
                              <div className="absolute bottom-0 right-0 bg-green-500 text-white rounded-full w-5 md:w-8 h-5 md:h-8 flex items-center justify-center border-2 border-background shadow-md z-10">
                                <span className="text-[8px] md:text-xs font-bold">✓</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center">
                            <h3 className="text-xs sm:text-sm md:text-xl font-bold line-clamp-2 break-words w-full px-1 leading-tight">{fight.fighter1_name}</h3>
                          </div>
                          
                          {/* Display odds for fighter 1 */}
                          <div className="mt-1 flex justify-center">
                            <FighterOdds
                              fighterName={fight.fighter1_name}
                              odds={fight.odds_data?.fighter1_odds?.odds || null}
                              bookmaker={fight.odds_data?.fighter1_odds?.bookmaker || null}
                              size="sm"
                              className="text-center"
                            />
                          </div>
                          
                          <div className="flex items-center gap-1 mt-1 justify-center">
                            <Link 
                              href={fight.fighter1_tap_link || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] md:text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              Tapology <ExternalLink className="h-2 w-2 md:h-3 md:w-3" />
                            </Link>
                          </div>
                          <div className="mt-1 md:mt-3 text-center">
                            <div className="text-[10px] md:text-sm text-muted-foreground mb-0 md:mb-1">Win Probability</div>
                            <div 
                              className={`text-sm md:text-2xl font-bold ${fighter1Win ? 'text-green-500' : 'text-foreground'}`}
                            >
                              {fight.prediction?.fighter1_win_probability_percent.toFixed(1)}%
                            </div>
                          </div>
                          {isAuthenticated && fight.odds_data && fight.odds_data.fighter1_odds?.odds && (
                            <Button 
                              className={cn(
                                "mt-2 font-medium px-4 py-2 rounded-lg shadow-sm transition-colors",
                                predictionWindowOpen && !isEventPassed()
                                  ? "bg-green-600 hover:bg-green-700 text-white" 
                                  : "bg-gray-400 text-gray-600 cursor-not-allowed"
                              )}
                              size="sm"
                              disabled={!predictionWindowOpen || isEventPassed()}
                                                             onClick={() => {
                                 if (predictionWindowOpen && !isEventPassed() && fight.odds_data?.fighter1_odds?.odds) {
                                   console.log('DEBUG: Setting modal state with event ID:', eventData.id)
                                   setModalState({
                                     isOpen: true,
                                     eventId: eventData.id, // Use actual event ID
                                     fightId: fight.fight_id,
                                     fighterId: fight.fighter1_id,
                                     fighterName: fight.fighter1_name,
                                     oddsAmerican: fight.odds_data.fighter1_odds.odds,
                                   })
                                 }
                               }}
                            >
                              <Coins className="h-3 w-3 mr-1" />
                              {predictionWindowOpen && !isEventPassed() ? "Place Pick" : "Picks Locked"}
                            </Button>
                          )}
                        </div>

                        <div className="flex flex-col items-center justify-center p-1 md:p-3 w-[20%]">
                          <div className="w-8 md:w-12 h-8 md:h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs md:text-lg font-semibold text-primary">VS</span>
                          </div>
                          <div className="text-[8px] md:text-xs text-muted-foreground mt-1 md:mt-2">MATCHUP</div>
                        </div>

                        <div className="flex flex-col items-center text-center flex-1 w-[40%] min-w-0">
                          <div className="relative w-16 md:w-32 h-16 md:h-32 mb-2 md:mb-4 overflow-hidden rounded-full">
                            {fight.fighter2_image ? (
                              <div className="w-full h-full relative">
                                <Image 
                                  src={fight.fighter2_image} 
                                  alt={fight.fighter2_name} 
                                  fill
                                  className="object-cover"
                                  style={{ 
                                    borderRadius: '50%',
                                    border: fighter2Win ? '4px solid rgba(74, 222, 128, 0.5)' : '4px solid transparent'
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-full h-full rounded-full bg-card flex items-center justify-center border-4 border-muted">
                                <span className="text-lg md:text-2xl font-bold">{fight.fighter2_name.charAt(0)}</span>
                              </div>
                            )}
                            {fighter2Win && (
                              <div className="absolute bottom-0 right-0 bg-green-500 text-white rounded-full w-5 md:w-8 h-5 md:h-8 flex items-center justify-center border-2 border-background shadow-md z-10">
                                <span className="text-[8px] md:text-xs font-bold">✓</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center">
                            <h3 className="text-xs sm:text-sm md:text-xl font-bold line-clamp-2 break-words w-full px-1 leading-tight">{fight.fighter2_name}</h3>
                          </div>
                          
                          {/* Display odds for fighter 2 */}
                          <div className="mt-1 flex justify-center">
                            <FighterOdds
                              fighterName={fight.fighter2_name}
                              odds={fight.odds_data?.fighter2_odds?.odds || null}
                              bookmaker={fight.odds_data?.fighter2_odds?.bookmaker || null}
                              size="sm"
                              className="text-center"
                            />
                          </div>
                          
                          <div className="flex items-center gap-1 mt-1 justify-center">
                            <Link 
                              href={fight.fighter2_tap_link || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] md:text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              Tapology <ExternalLink className="h-2 w-2 md:h-3 md:w-3" />
                            </Link>
                          </div>
                          <div className="mt-1 md:mt-3 text-center">
                            <div className="text-[10px] md:text-sm text-muted-foreground mb-0 md:mb-1">Win Probability</div>
                            <div 
                              className={`text-sm md:text-2xl font-bold ${fighter2Win ? 'text-green-500' : 'text-foreground'}`}
                            >
                              {fight.prediction?.fighter2_win_probability_percent.toFixed(1)}%
                            </div>
                          </div>
                          {isAuthenticated && fight.odds_data && fight.odds_data.fighter2_odds?.odds && (
                            <Button 
                              className={cn(
                                "mt-2 font-medium px-4 py-2 rounded-lg shadow-sm transition-colors",
                                predictionWindowOpen && !isEventPassed()
                                  ? "bg-green-600 hover:bg-green-700 text-white" 
                                  : "bg-gray-400 text-gray-600 cursor-not-allowed"
                              )}
                              size="sm"
                              disabled={!predictionWindowOpen || isEventPassed()}
                              onClick={() => {
                                if (predictionWindowOpen && !isEventPassed() && fight.odds_data?.fighter2_odds?.odds) {
                                  setModalState({
                                    isOpen: true,
                                    eventId: eventData.id, // Use actual event ID
                                    fightId: fight.fight_id,
                                    fighterId: fight.fighter2_id,
                                    fighterName: fight.fighter2_name,
                                    oddsAmerican: fight.odds_data.fighter2_odds.odds,
                                  })
                                }
                              }}
                            >
                              <Coins className="h-3 w-3 mr-1" />
                              {predictionWindowOpen && !isEventPassed() ? "Place Pick" : "Picks Locked"}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 sm:mt-3 md:mt-4 pt-2 sm:pt-3 md:pt-4 border-t border-border">
                        {/* Show results if fight is completed */}
                        {fight.status === 'completed' && fight.result ? (
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-yellow-500" />
                                <span className="font-semibold text-sm">Fight Result</span>
                                {fight.prediction_correct !== undefined && (
                                  <Badge 
                                    variant={fight.prediction_correct ? "default" : "destructive"}
                                    className="flex items-center gap-1 px-2 py-0.5 text-xs"
                                  >
                                    {fight.prediction_correct ? (
                                      <><CheckCircle className="h-2.5 w-2.5" /> Correct</>
                                    ) : (
                                      <><XCircle className="h-2.5 w-2.5" /> Incorrect</>
                                    )}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Winner: </span>
                                <span className="font-semibold">{fight.result.winner_name}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Method: </span>
                                <span className="font-semibold">{fight.result.method}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Round: </span>
                                <span className="font-semibold">{fight.result.round}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Time: </span>
                                <span className="font-semibold">{fight.result.time}</span>
                              </div>
                            </div>
                            <Separator className="my-2" />
                          </div>
                        ) : (
                          <div className="mb-3">
                            <Badge variant="outline" className="text-xs">
                              {fight.status === 'scheduled' ? 'Scheduled' : 'Upcoming'}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Prediction details */}
                        <div className={cn(
                          "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2",
                          "text-xs md:text-sm"
                        )}>
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={cn(
                                "text-[9px] sm:text-[10px] md:text-xs py-0.5 md:py-1 px-1 sm:px-2",
                                fight.prediction?.confidence_percent > 75 ? "bg-green-500/20 text-green-600 hover:bg-green-500/30" : 
                                fight.prediction?.confidence_percent > 60 ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30" : 
                                "bg-red-500/20 text-red-600 hover:bg-red-500/30"
                              )}
                            >
                              {fight.prediction?.confidence_percent > 75 ? "High Confidence" : 
                               fight.prediction?.confidence_percent > 60 ? "Medium Confidence" : 
                               "Low Confidence"}
                            </Badge>
                            <span className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground">
                              {fight.prediction?.confidence_percent.toFixed(1)}% confidence
                            </span>
                          </div>
                          <div className="text-[9px] sm:text-[10px] md:text-sm text-muted-foreground">
                            Predicted Winner: <span className="font-semibold break-words line-clamp-1 inline-block align-bottom">{fight.prediction?.predicted_winner_name}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedItem>
              )
            })}
          </AnimatedContainer>

          <AnimatedItem variant="fadeUp" delay={0.3} className="mt-6 sm:mt-8 text-center text-xs md:text-sm text-muted-foreground">
            <p>
              Predictions are based on historical performance, fighter statistics, and matchup analysis. 
              These are AI estimations and should not be used for betting purposes.
            </p>
          </AnimatedItem>

          {/* User Bets Section */}
          {isAuthenticated && userBets.length > 0 && (
            <AnimatedItem variant="fadeUp" delay={0.4} className="mt-6 sm:mt-8">
              <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-primary">🎯</span>
                    Your Picks for This Event
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto">
                    <div className="space-y-3">
                      {userBets.map((bet, index) => (
                        <div key={bet.id} className="flex items-center justify-between p-3 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold">{bet.fighter_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {bet.odds_american > 0 ? `+${bet.odds_american}` : bet.odds_american} odds
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-primary">{bet.stake} coins</div>
                            <div className="text-sm text-muted-foreground">
                              Potential: {bet.potential_payout} coins
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 pt-3 border-t border-primary/20">
                        <div className="flex justify-between text-sm">
                          <span>Total Wagered:</span>
                          <span className="font-semibold">{userBets.reduce((sum, bet) => sum + bet.stake, 0)} coins</span>
                        </div>
                        <div className="flex justify-between text-sm text-primary">
                          <span>Potential Total Payout:</span>
                          <span className="font-semibold">{userBets.reduce((sum, bet) => sum + bet.potential_payout, 0)} coins</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedItem>
          )}
                                   </AnimatedContainer>
          <PlacePickModal 
           {...modalState}
           onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
           onSuccess={refreshBalance}
         />
       </div>
     </PageTransition>
   )
} 