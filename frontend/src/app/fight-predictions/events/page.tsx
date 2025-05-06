"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import Image from 'next/image'
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { ArrowUpRight, Calendar, Clock, ExternalLink, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"

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
}

interface Event {
  event_name: string
  event_date: string
  event_url: string
  scraped_at: string
  fights: Fight[]
}

export default function EventAnalysisPage() {
  const router = useRouter()
  const [eventData, setEventData] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isContentReady, setIsContentReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    async function fetchEventData() {
      try {
        const response = await fetch('/upcoming_event.json')
        if (!response.ok) {
          throw new Error('Failed to fetch event data')
        }
        const data = await response.json()
        setEventData(data)
        
        setTimeout(() => {
          setIsLoading(false)
          setTimeout(() => {
            setIsContentReady(true)
          }, 100)
        }, 300)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        console.error('Error fetching event data:', err)
        setIsLoading(false)
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
      <div className="container mx-auto px-4 py-8">
        <AnimatedContainer className="space-y-6 max-w-5xl mx-auto">
          <AnimatedItem variant="fadeIn" className="space-y-2">
            <div className="flex items-center justify-between h-12 mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/fight-predictions')}
                  className="gap-1 px-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">Back</span>
                </Button>
                <h2 className="text-lg sm:text-xl font-bold">Event Analysis</h2>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-3xl font-bold">{eventData.event_name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{eventData.event_date}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> 
                <span>Last Updated: {new Date(eventData.scraped_at).toLocaleString()}</span>
              </Badge>
              <Link 
                href={eventData.event_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> 
                UFC Stats
              </Link>
            </div>
            <p className="text-muted-foreground pt-2">
              AI-powered fight predictions for the upcoming UFC event, based on comprehensive fighter analysis.
            </p>
          </AnimatedItem>

          <Separator className="my-6" />

          <AnimatedContainer className="space-y-8" delay={0.05}>
            {eventData.fights.map((fight, index) => {
              const fighter1Win = fight.prediction?.fighter1_win_probability_percent >= 50
              const fighter2Win = !fighter1Win
              
              return (
                <AnimatedItem key={index} variant="fadeUp" delay={0.1 + (index * 0.05)} className="relative">
                  <Card className="bg-card/50 backdrop-blur border-primary/20 hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-4">
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
                        </div>
                      </div>

                      <div className="mt-2 sm:mt-3 md:mt-4 pt-2 sm:pt-3 md:pt-4 border-t border-border">
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

          <AnimatedItem variant="fadeUp" delay={0.3} className="mt-8 text-center text-xs md:text-sm text-muted-foreground">
            <p>
              Predictions are based on historical performance, fighter statistics, and matchup analysis. 
              These are AI estimations and should not be used for betting purposes.
            </p>
          </AnimatedItem>
        </AnimatedContainer>
      </div>
    </PageTransition>
  )
} 