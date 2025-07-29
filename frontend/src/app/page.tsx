"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Trophy, Users, Target, Zap, BarChart3, Star, Sparkles, Award, Calendar, MapPin } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import { API_URL, ENDPOINTS } from "@/lib/api-config"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { FighterOdds } from "@/components/ui/odds-display"
import Image from "next/image"

const FEATURED_FIGHTERS = [
  { id: "6270", name: "Jon Jones", stat: "28-1" },
  { id: "4487", name: "Israel Adesanya", stat: "24-5" },
  { id: "8532", name: "Alexander Volkanovski", stat: "27-4-0" },
  { id: "6758", name: "Islam Makhachev", stat: "27-1" },
]

interface GlobalStats {
  totalPicks: number
  activeTraders: number
  totalWagered: number
}

interface Prediction {
  fighter1_win_probability: number
  fighter2_win_probability: number
  fighter1_win_probability_percent: number
  fighter2_win_probability_percent: number
}

interface OddsData {
  fighter1_odds: { odds: number | null; bookmaker: string | null }
  fighter2_odds: { odds: number | null; bookmaker: string | null }
}

interface Fight {
  fighter1_name: string
  fighter1_id: number
  fighter1_image: string
  fighter1_page_link?: string
  fighter2_name: string
  fighter2_id: number
  fighter2_image: string
  fighter2_page_link?: string
  prediction: Prediction
  odds_data?: OddsData | null
  fight_id: string
}

interface EventData {
  event_name: string
  event_date: string
  event_start_time?: string
  total_fights: number
  fights: Fight[]
}

const TRANSITION_DURATION_MS = 800;

export default function HomePage() {
  const [fightersCount, setFightersCount] = useState<number>(0)
  const [featuredFighters, setFeaturedFighters] = useState(FEATURED_FIGHTERS)
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalPicks: 0,
    activeTraders: 0,
    totalWagered: 0
  })
  const [mainEvent, setMainEvent] = useState<EventData | null>(null)

  const [activeSection, setActiveSection] = useState(0)
  const [previousSection, setPreviousSection] = useState(-1)
  const sections = ["Hero", "Story", "Features", "CTA"]
  const isTransitioning = useRef(false)
  const touchStartY = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchGlobalStats()
    fetchFightersCount()
    fetchMainEvent()
  }, [])

  const fetchGlobalStats = async () => {
    try {
      // Fetch global community stats - using leaderboard endpoint for now
      const response = await fetch(ENDPOINTS.LEADERBOARD)
      
      if (response.ok) {
        const data = await response.json()
        setGlobalStats({
          totalPicks: data.total_picks || 0,
          activeTraders: data.active_users || 0,
          totalWagered: data.total_wagered || 0
        })
      }
    } catch (error) {
      console.error('Error fetching global stats:', error)
    }
  }

  const fetchFightersCount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/fighters-count`)
      if (response.ok) {
        const data = await response.json()
        setFightersCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching fighters count:', error)
    }
  }

  const fetchMainEvent = async () => {
    try {
      const response = await fetch(ENDPOINTS.UPCOMING_EVENTS)
      if (response.ok) {
        const data = await response.json()
        setMainEvent(data)
      }
    } catch (error) {
      console.error('Error fetching main event:', error)
    }
  }

  const formatEventDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const changeSection = (newSection: number) => {
    if (
      isTransitioning.current ||
      newSection < 0 ||
      newSection >= sections.length ||
      newSection === activeSection
    ) {
      return
    }

    isTransitioning.current = true
    setPreviousSection(activeSection)
    setActiveSection(newSection)

    setTimeout(() => {
      isTransitioning.current = false
      setPreviousSection(-1)
    }, TRANSITION_DURATION_MS)
  }

  useEffect(() => {
    const wheelTarget = document.documentElement;
    const touchTarget = scrollContainerRef.current;

    let wheelTimeoutId: NodeJS.Timeout
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      
      e.preventDefault();
      
      if (isTransitioning.current) {
        return
      }
      
      clearTimeout(wheelTimeoutId)
      wheelTimeoutId = setTimeout(() => {
        const direction = e.deltaY > 0 ? 1 : -1
        changeSection(activeSection + direction)
      }, 50)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (isTransitioning.current) return
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTransitioning.current) return
      
      const touchEndY = e.changedTouches[0].clientY
      const deltaY = touchStartY.current - touchEndY

      if (Math.abs(deltaY) > 40) {
        e.preventDefault();
        const direction = deltaY > 0 ? 1 : -1
        changeSection(activeSection + direction)
      }
    }

    wheelTarget.addEventListener('wheel', handleWheel, { passive: false })
    
    if (touchTarget) { 
      touchTarget.addEventListener('touchstart', handleTouchStart, { passive: false })
      touchTarget.addEventListener('touchend', handleTouchEnd, { passive: false })
    }

    return () => {
      clearTimeout(wheelTimeoutId)
      wheelTarget.removeEventListener('wheel', handleWheel)
      if (touchTarget) { 
        touchTarget.removeEventListener('touchstart', handleTouchStart)
        touchTarget.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [activeSection])

  const getSectionStyles = (index: number): React.CSSProperties => {
    const isActive = activeSection === index
    const isPrev = previousSection === index
    
    let moveDirection = 0; 
    if (previousSection !== -1) {
        moveDirection = activeSection > previousSection ? 1 : -1;
    }

    let transform = 'translateY(0)';
    let opacity = 0;
    let zIndex = 0;
    let visibility: 'visible' | 'hidden' = 'hidden';

    if (isActive) {
      transform = 'translateY(0)';
      opacity = 1;
      zIndex = 1;
      visibility = 'visible';
    } else if (isPrev) {
      transform = `translateY(${-moveDirection * 25}vh)`;
      opacity = 0;
      zIndex = 0;
      visibility = 'visible';
    } else {
      const initialDirection = index > activeSection ? 1 : -1;
      transform = `translateY(${initialDirection * 100}vh)`;
      opacity = 0;
      zIndex = 0;
      visibility = 'hidden';
    }

    const isVisible = isActive || isPrev;
    const visibilityDelay = isVisible ? '0ms' : `${TRANSITION_DURATION_MS}ms`;

    return {
      transform,
      opacity,
      zIndex,
      visibility,
      transition: 
        `transform ${TRANSITION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), ` +
        `opacity ${TRANSITION_DURATION_MS * 0.6}ms ease-out, ` +
        `visibility 0ms linear ${visibilityDelay}`,
      pointerEvents: isActive ? 'auto' : 'none',
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch fighters count
        const countResponse = await fetch(`${API_URL}/api/v1/fighters-count`);
        const countData = await countResponse.json();
        setFightersCount(countData.count);

        // Fetch updated data for featured fighters
        const updatedFighters = await Promise.all(
          FEATURED_FIGHTERS.map(async (fighter) => {
            const response = await fetch(`${API_URL}/api/v1/fighter/${fighter.id}`);
            if (!response.ok) return fighter;
            const data = await response.json();
            return {
              id: fighter.id,
              name: fighter.name,
              stat: data.Record || data.record || fighter.stat
            };
          })
        );
        setFeaturedFighters(updatedFighters);

        // Fetch global stats from leaderboard
        try {
          const leaderboardResponse = await fetch(ENDPOINTS.LEADERBOARD);
          if (leaderboardResponse.ok) {
            const leaderboardData = await leaderboardResponse.json();
            setGlobalStats({
              totalPicks: leaderboardData.total_picks || 1247,
              activeTraders: leaderboardData.total_users || 89,
              totalWagered: leaderboardData.total_wagered || 458750
            });
          }
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div 
      ref={scrollContainerRef} 
      className="fixed inset-0 h-full w-full overflow-hidden"
    >
        {/* Hero Section */}
      <section 
        className="absolute inset-0 h-full w-full flex items-center justify-center overflow-hidden px-4"
        style={getSectionStyles(0)}
      >
        <div className="container mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-6 md:space-y-8"
          >
            <Badge className="mx-auto px-4 py-2 bg-primary/10 border border-primary/30 text-primary">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered MMA Predictions
                    </Badge>
            
            <motion.h1 
              className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-light tracking-tight"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.1 }}
            >
                    ZOCRATIC
            </motion.h1>
            
            <motion.div 
              className="w-24 md:w-32 h-1 bg-gradient-to-r from-primary to-secondary rounded-full mx-auto"
              initial={{ width: 0 }}
              animate={{ width: "auto" }}
              transition={{ duration: 0.8, delay: 0.4 }}
            />
            
            <motion.p 
              className="text-lg md:text-xl lg:text-2xl text-foreground/80 max-w-3xl mx-auto leading-relaxed px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Master the art of UFC predictions with AI-powered insights and compete with fellow MMA enthusiasts
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 md:pt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <Button size="lg" className="px-8 py-4 text-lg" asChild>
                     <Link href="/fight-predictions">
                       Start Predicting
                       <ArrowRight className="ml-2 h-5 w-5" />
                     </Link>
                   </Button>
              <Button variant="outline" size="lg" className="px-8 py-4 text-lg" asChild>
                     <Link href="/fighters">
                       Explore Fighters
                     </Link>
                   </Button>
            </motion.div>
          </motion.div>
                 </div>
      </section>

      {/* What We Are Section */}
      <section 
        className="absolute inset-0 h-full w-full flex items-center justify-center overflow-hidden px-4"
        style={getSectionStyles(1)}
      >
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-light mb-4 md:mb-6">
                What You Can Do
              </h2>
              <p className="text-lg md:text-xl text-foreground/70 leading-relaxed max-w-3xl mx-auto px-4">
                Everything you need to analyze UFC fights and make intelligent predictions
              </p>
            </motion.div>

            <motion.div 
              className="grid md:grid-cols-3 gap-4 md:gap-8 mt-8 md:mt-12"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="text-center space-y-3">
                <div className="w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mx-auto">
                  <BarChart3 className="h-6 md:h-8 w-6 md:w-8 text-blue-600" />
                    </div>
                <h3 className="text-lg md:text-xl font-light text-foreground">Fighter Database</h3>
                <p className="text-sm md:text-base text-foreground/70 px-2">
                  Browse {fightersCount}+ UFC fighters with detailed stats and records
                </p>
                  </div>
                  
              <div className="text-center space-y-3">
                <div className="w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                  <Users className="h-6 md:h-8 w-6 md:w-8 text-green-600" />
                </div>
                <h3 className="text-lg md:text-xl font-light text-foreground">Compare Fighters</h3>
                <p className="text-sm md:text-base text-foreground/70 px-2">
                  Side-by-side analysis to see who has the edge
                </p>
                      </div>

              <div className="text-center space-y-3">
                <div className="w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mx-auto">
                  <Zap className="h-6 md:h-8 w-6 md:w-8 text-purple-600" />
                  </div>
                <h3 className="text-lg md:text-xl font-light text-foreground">AI Predictions</h3>
                <p className="text-sm md:text-base text-foreground/70 px-2">
                  Get AI-powered fight analysis and outcome predictions
                </p>
                    </div>
            </motion.div>
                  </div>
          </div>
        </section>

        {/* Main Event Section */}
        <section 
          className="absolute inset-0 h-full w-full flex items-center justify-center overflow-hidden px-4"
          style={getSectionStyles(2)}
        >
          <div className="container mx-auto">
            <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-light mb-4 md:mb-6">
                  Main Event Preview
                </h2>
                <p className="text-lg md:text-xl text-foreground/70 max-w-3xl mx-auto px-4">
                  See real odds and AI predictions for upcoming UFC fights
                </p>
              </motion.div>

              {mainEvent && mainEvent.fights && mainEvent.fights.length > 0 ? (
                <Link href="/fight-predictions/events" className="block">
                  <motion.div 
                    className="relative bg-gradient-to-br from-primary/5 to-primary/10 p-3 md:p-6 rounded-xl border border-primary/20 shadow-lg cursor-pointer group transition-all duration-300 hover:shadow-xl hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/10 hover:to-primary/15"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    viewport={{ once: true }}
                  >
                    {/* Enhanced click indicator - simplified for mobile */}
                    <div className="absolute top-2 md:top-3 right-2 md:right-3 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                      <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 group-hover:bg-primary/20 px-2 py-1 rounded-full border border-primary/20 group-hover:border-primary/40">
                        <span className="hidden sm:inline">Click to view</span>
                        <span className="sm:hidden">Tap</span>
                      </div>
                    </div>
                    
                    {/* Event Info */}
                    <div className="mb-3 md:mb-4 text-center">
                      <div className="inline-flex items-center gap-2 bg-primary/20 group-hover:bg-primary/30 px-2 md:px-3 py-1 rounded-full mb-2 transition-colors duration-300">
                        <span className="text-xs font-medium text-primary">NEXT EVENT</span>
                      </div>
                      <h3 className="text-base md:text-2xl font-bold text-primary mb-1 group-hover:text-primary/90 transition-all duration-200 px-2">
                        {mainEvent.event_name}
                      </h3>
                      <p className="text-xs md:text-sm text-foreground/70 flex items-center justify-center gap-1">
                        <Calendar className="h-3 w-3 group-hover:text-primary transition-colors duration-300" />
                        {formatEventDate(mainEvent.event_date)}
                      </p>
                    </div>

                    {/* Fight Card */}
                    <div className="bg-background/80 group-hover:bg-background/90 rounded-lg p-2 md:p-6 border border-primary/20 group-hover:border-primary/30 transition-all duration-300">
                      <div className="flex flex-row gap-2 sm:gap-4 md:gap-8 items-center justify-center">
                        {/* Fighter 1 */}
                        <div className="flex flex-col items-center text-center flex-1 min-w-0 max-w-[160px] sm:max-w-none">
                          <div className="w-20 sm:w-24 md:w-32 h-20 sm:h-24 md:h-32 mb-2 md:mb-3 relative group-hover:scale-105 transition-transform duration-200">
                            {mainEvent.fights[0].fighter1_image ? (
                              <Image 
                                src={mainEvent.fights[0].fighter1_image} 
                                alt={mainEvent.fights[0].fighter1_name}
                                fill
                                className="object-cover rounded-full border-2 border-primary/30 group-hover:border-primary/50 transition-colors duration-300"
                                sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, 128px"
                                quality={95}
                                priority
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center border-2 border-primary/30 group-hover:border-primary/50 transition-all duration-300">
                                <span className="text-xl md:text-3xl font-bold text-primary">{mainEvent.fights[0].fighter1_name.charAt(0)}</span>
                              </div>
                            )}
                      </div>
                          
                          <h4 className="font-bold text-xs sm:text-sm md:text-lg mb-1 md:mb-3 line-clamp-2 text-center leading-tight group-hover:text-primary transition-colors duration-300 px-1">
                            {mainEvent.fights[0].fighter1_name}
                          </h4>
                          
                          {/* Fighter 1 Odds */}
                          <div className="mb-1 md:mb-3 group-hover:scale-105 transition-transform duration-200">
                            <FighterOdds
                              fighterName={mainEvent.fights[0].fighter1_name}
                              odds={mainEvent.fights[0].odds_data?.fighter1_odds?.odds || null}
                              bookmaker={mainEvent.fights[0].odds_data?.fighter1_odds?.bookmaker || null}
                              size="md"
                            />
                      </div>
                          
                          {/* Fighter 1 Win Probability */}
                          <div className="text-center bg-green-500/15 group-hover:bg-green-500/25 rounded px-2 sm:px-3 md:px-3 py-1 md:py-2 border border-green-500/30 group-hover:border-green-500/50 transition-all duration-200">
                            <div className="text-[10px] sm:text-xs md:text-sm text-green-600 font-medium">AI</div>
                            <div className="text-sm sm:text-base md:text-xl font-bold text-green-600">
                              {mainEvent.fights[0].prediction?.fighter1_win_probability_percent?.toFixed(1) || '50.0'}%
                            </div>
                          </div>
                      </div>

                        {/* VS Section */}
                        <div className="flex flex-col items-center justify-center px-1 md:px-3 flex-shrink-0">
                          <div className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-16 rounded-full bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center mb-1 md:mb-2 border border-primary/30 group-hover:border-primary/50 group-hover:scale-105 transition-all duration-200">
                            <span className="text-sm sm:text-base md:text-2xl font-bold text-primary">VS</span>
                      </div>
                          <div className="text-[8px] sm:text-[10px] md:text-sm text-primary font-medium group-hover:text-primary/90 transition-colors duration-300 text-center leading-tight">
                            MAIN<br/>EVENT
              </div>
          </div>

                        {/* Fighter 2 */}
                        <div className="flex flex-col items-center text-center flex-1 min-w-0 max-w-[160px] sm:max-w-none">
                          <div className="w-20 sm:w-24 md:w-32 h-20 sm:h-24 md:h-32 mb-2 md:mb-3 relative group-hover:scale-105 transition-transform duration-200">
                            {mainEvent.fights[0].fighter2_image ? (
                              <Image 
                                src={mainEvent.fights[0].fighter2_image} 
                                alt={mainEvent.fights[0].fighter2_name}
                                fill
                                className="object-cover rounded-full border-2 border-primary/30 group-hover:border-primary/50 transition-colors duration-300"
                                sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, 128px"
                                quality={95}
                                priority
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center border-2 border-primary/30 group-hover:border-primary/50 transition-all duration-300">
                                <span className="text-xl md:text-3xl font-bold text-primary">{mainEvent.fights[0].fighter2_name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          
                          <h4 className="font-bold text-xs sm:text-sm md:text-lg mb-1 md:mb-3 line-clamp-2 text-center leading-tight group-hover:text-primary transition-colors duration-300 px-1">
                            {mainEvent.fights[0].fighter2_name}
                          </h4>
                          
                          {/* Fighter 2 Odds */}
                          <div className="mb-1 md:mb-3 group-hover:scale-105 transition-transform duration-200">
                            <FighterOdds
                              fighterName={mainEvent.fights[0].fighter2_name}
                              odds={mainEvent.fights[0].odds_data?.fighter2_odds?.odds || null}
                              bookmaker={mainEvent.fights[0].odds_data?.fighter2_odds?.bookmaker || null}
                              size="md"
                            />
                          </div>
                          
                          {/* Fighter 2 Win Probability */}
                          <div className="text-center bg-green-500/15 group-hover:bg-green-500/25 rounded px-2 sm:px-3 md:px-3 py-1 md:py-2 border border-green-500/30 group-hover:border-green-500/50 transition-all duration-200">
                            <div className="text-[10px] sm:text-xs md:text-sm text-green-600 font-medium">AI</div>
                            <div className="text-sm sm:text-base md:text-xl font-bold text-green-600">
                              {mainEvent.fights[0].prediction?.fighter2_win_probability_percent?.toFixed(1) || '50.0'}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ) : (
                <motion.div 
                  className="bg-primary/5 p-6 rounded-lg shadow-xl"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true }}
                >
                  <p className="text-lg text-foreground/80 text-center">
                    No upcoming main event scheduled. Check back later for updates!
                  </p>
                  <div className="mt-4 text-center">
                    <Link href="/fight-predictions/events">
                      <Button variant="outline">
                        View Fight History
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              )}
              </div>
          </div>
        </section>

      {/* Features Section - Now simplified */}
      <section 
        className="absolute inset-0 h-full w-full flex items-center justify-center overflow-hidden px-4"
        style={getSectionStyles(3)}
      >
        <div className="container mx-auto">
          <div className="max-w-5xl mx-auto text-center space-y-8 md:space-y-12">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-light mb-6 md:mb-8">
                  Ready to Dominate?
                </h2>
              <p className="text-xl md:text-2xl text-foreground/70 leading-relaxed max-w-4xl mx-auto">
                  Join the elite community of MMA analysts and start your journey to prediction mastery
                </p>
            </motion.div>

            <motion.div 
              className="flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
                  <Button 
                    size="lg" 
                className="px-12 md:px-16 py-6 md:py-8 text-xl md:text-2xl font-light hover:scale-105 transition-transform duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-2xl"
                    asChild
                  >
                    <Link href="/fight-predictions">
                  Get Started
                  <ArrowRight className="ml-4 h-6 md:h-7 w-6 md:w-7" />
                    </Link>
                  </Button>
            </motion.div>

            {/* Featured Fighters Preview */}
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-8 md:mt-16"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              {featuredFighters.map((fighter, index) => (
                <Link key={fighter.id} href={`/fighters/${fighter.id}`}>
                  <Card className="group cursor-pointer border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-xl">
                    <CardContent className="p-3 md:p-4 text-center space-y-2 md:space-y-3">
                      <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                        <Star className="h-5 md:h-6 w-5 md:w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-light text-xs md:text-sm group-hover:text-primary transition-colors">{fighter.name}</h3>
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border border-primary/30 mt-1">
                          {fighter.stat}
                        </Badge>
                </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </motion.div>
          </div>
          </div>
        </section>
      </div>
  )
}
