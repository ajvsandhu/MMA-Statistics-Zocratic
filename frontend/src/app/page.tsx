"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Trophy, Users, Target, Zap, BarChart3, Star, Sparkles, Award, Calendar, MapPin, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import { API_URL, ENDPOINTS } from "@/lib/api-config"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { FighterOdds } from "@/components/ui/odds-display"
import Image from "next/image"
import { useRouter } from "next/navigation";

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
        const countResponse = await fetch(`${API_URL}/api/v1/fighters-count`);
        const countData = await countResponse.json();
        setFightersCount(countData.count);

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

  const router = useRouter();

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
              className="text-4xl sm:text-5xl md:text-8xl lg:text-9xl font-light tracking-tight"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.1 }}
            >
                    ZOCRATIC
            </motion.h1>
            
            <motion.div 
              className="w-16 sm:w-24 md:w-32 h-1 bg-gradient-to-r from-primary to-secondary rounded-full mx-auto"
              initial={{ width: 0 }}
              animate={{ width: "auto" }}
              transition={{ duration: 0.8, delay: 0.4 }}
            />
            
            <motion.p 
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-foreground/80 max-w-3xl mx-auto leading-relaxed px-2 sm:px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Master the art of UFC predictions with AI-powered insights and compete with fellow MMA enthusiasts
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-3 sm:pt-4 md:pt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <Button size="lg" className="px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg" asChild>
                     <Link href="/fight-predictions">
                       Start Predicting
                  <ArrowRight className="ml-2 h-4 sm:h-5 w-4 sm:w-5" />
                     </Link>
                   </Button>
              <Button variant="outline" size="lg" className="px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg" asChild>
                     <Link href="/about">
                       About
                     </Link>
                   </Button>
            </motion.div>
            
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-muted-foreground/60"
              >
                  <ChevronDown className="h-8 w-8" />
                </motion.div>
              </motion.div>
            </div>
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
              <motion.h2 
                className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-light mb-3 sm:mb-4 md:mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                viewport={{ once: true }}
              >
                What You Can Do
              </motion.h2>
              <motion.p 
                className="text-sm sm:text-lg md:text-xl text-foreground/70 leading-relaxed max-w-3xl mx-auto px-2 sm:px-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
              >
                Everything you need to analyze UFC fights and make intelligent predictions
              </motion.p>
            </motion.div>

            <motion.div 
              className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mt-6 sm:mt-8 md:mt-12"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <motion.div 
                className="text-center space-y-3 sm:space-y-4 group"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.05, y: -8 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
              >
                <motion.div 
                  className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all duration-500 hover:border-blue-500/50"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                >
                  <BarChart3 className="h-5 sm:h-6 md:h-8 w-5 sm:w-6 md:w-8 text-blue-500" />
                </motion.div>
                <motion.h3 
                  className="text-sm sm:text-lg md:text-xl font-semibold text-foreground group-hover:text-blue-500 transition-colors duration-300"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  viewport={{ once: true }}
                >
                  Fighter Database
                </motion.h3>
                <motion.p 
                  className="text-xs sm:text-sm md:text-base text-foreground/70 px-1 sm:px-2 group-hover:text-foreground/90 transition-colors duration-300"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                  viewport={{ once: true }}
                >
                  Browse {fightersCount}+ UFC fighters with detailed stats and records
                </motion.p>
              </motion.div>
                  
            <motion.div 
              className="text-center space-y-3 sm:space-y-4 group"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ scale: 1.05, y: -8 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <motion.div 
                className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-green-500/25 transition-all duration-500 hover:border-green-500/50"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
              >
                <Users className="h-5 sm:h-6 md:h-8 w-5 sm:w-6 md:w-8 text-green-500" />
              </motion.div>
              <motion.h3 
                className="text-sm sm:text-lg md:text-xl font-semibold text-foreground group-hover:text-green-500 transition-colors duration-300"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                viewport={{ once: true }}
              >
                Compare Fighters
              </motion.h3>
              <motion.p 
                className="text-xs sm:text-sm md:text-base text-foreground/70 px-1 sm:px-2 group-hover:text-foreground/90 transition-colors duration-300"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                viewport={{ once: true }}
              >
                  Side-by-side analysis to see who has the edge
              </motion.p>
            </motion.div>

            <motion.div 
              className="text-center space-y-3 sm:space-y-4 group"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ scale: 1.05, y: -8 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              viewport={{ once: true }}
            >
              <motion.div 
                className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-purple-500/25 transition-all duration-500 hover:border-purple-500/50"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
              >
                <Zap className="h-5 sm:h-6 md:h-8 w-5 sm:w-6 md:w-8 text-purple-500" />
              </motion.div>
              <motion.h3 
                className="text-sm sm:text-lg md:text-xl font-semibold text-foreground group-hover:text-purple-500 transition-colors duration-300"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                viewport={{ once: true }}
              >
                AI Predictions
              </motion.h3>
              <motion.p 
                className="text-xs sm:text-sm md:text-base text-foreground/70 px-1 sm:px-2 group-hover:text-foreground/90 transition-colors duration-300"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                viewport={{ once: true }}
              >
                  Get AI-powered fight analysis and outcome predictions
              </motion.p>
            </motion.div>
            </motion.div>
            
            <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-20">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-muted-foreground/60"
              >
                  <ChevronUp className="h-8 w-8" />
                </motion.div>
              </motion.div>
            </div>
            
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-muted-foreground/60"
              >
                  <ChevronDown className="h-8 w-8" />
                </motion.div>
            </motion.div>
            </div>
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
                <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-light mb-3 sm:mb-4 md:mb-6">
                  Main Event Preview
                </h2>
                <p className="text-sm sm:text-lg md:text-xl text-foreground/70 max-w-3xl mx-auto px-2 sm:px-4">
                  See real odds and AI predictions for upcoming UFC fights
                </p>
              </motion.div>

              {mainEvent && mainEvent.fights && mainEvent.fights.length > 0 ? (
                <Link href="/fight-predictions/events" className="block">
                  <motion.div 
                    className="relative bg-background/80 backdrop-blur-sm p-2 sm:p-3 md:p-6 rounded-xl border border-border/50 shadow-lg cursor-pointer group transition-all duration-300 hover:shadow-xl hover:border-primary/50 hover:bg-background/90"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    viewport={{ once: true }}
                  >
                    <div className="absolute top-1 sm:top-2 md:top-3 right-1 sm:right-2 md:right-3 opacity-50 group-hover:opacity-100 transition-all duration-300">
                      <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-1 sm:px-2 py-1 rounded-full border border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40">
                        <span className="hidden sm:inline">Click to view</span>
                        <span className="sm:hidden">Tap</span>
                      </div>
                    </div>
                    
                    <div className="mb-2 sm:mb-3 md:mb-4 text-center">
                      <div className="inline-flex items-center gap-2 bg-primary/20 px-1 sm:px-2 md:px-3 py-1 rounded-full mb-1 sm:mb-2 group-hover:bg-primary/30 transition-colors duration-300">
                        <span className="text-xs font-medium text-primary">NEXT EVENT</span>
                      </div>
                      <h3 className="text-sm sm:text-base md:text-2xl font-bold text-primary mb-1 px-1 sm:px-2 group-hover:text-primary/90 transition-colors duration-300">
                        {mainEvent.event_name}
                      </h3>
                      <p className="text-xs md:text-sm text-foreground/70 flex items-center justify-center gap-1 group-hover:text-foreground/90 transition-colors duration-300">
                        <Calendar className="h-3 w-3" />
                        {formatEventDate(mainEvent.event_date)}
                      </p>
                    </div>

                    <div className="bg-background/90 rounded-lg p-1 sm:p-2 md:p-6 border border-border/50 group-hover:border-primary/30 transition-all duration-300">
                      <div className="flex flex-row gap-1 sm:gap-2 md:gap-4 lg:gap-8 items-center justify-center">
                        {/* Fighter 1 */}
                        <div className="flex flex-col items-center text-center flex-1 min-w-0 max-w-[120px] sm:max-w-[160px] md:max-w-none">
                          <div className="w-16 sm:w-20 md:w-24 lg:w-32 h-16 sm:h-20 md:h-24 lg:h-32 mb-1 sm:mb-2 md:mb-3 relative group-hover:scale-105 transition-transform duration-200">
                            {mainEvent.fights[0].fighter1_image ? (
                              <Image 
                                src={mainEvent.fights[0].fighter1_image} 
                                alt={mainEvent.fights[0].fighter1_name}
                                fill
                                className="object-cover rounded-full border-2 border-primary/30 group-hover:border-primary/50 transition-colors duration-300"
                                sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, (max-width: 1024px) 96px, 128px"
                                quality={95}
                                priority
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30 group-hover:border-primary/50 group-hover:bg-primary/30 transition-all duration-300">
                                <span className="text-lg sm:text-xl md:text-3xl font-bold text-primary">{mainEvent.fights[0].fighter1_name.charAt(0)}</span>
                              </div>
                            )}
                      </div>
                          
                          <h4 className="font-bold text-xs sm:text-sm md:text-lg mb-1 md:mb-3 line-clamp-2 text-center leading-tight px-1 group-hover:text-primary transition-colors duration-300">
                            {mainEvent.fights[0].fighter1_name}
                          </h4>
                          
                          <div className="mb-1 md:mb-3 group-hover:scale-105 transition-transform duration-200">
                            <FighterOdds
                              fighterName={mainEvent.fights[0].fighter1_name}
                              odds={mainEvent.fights[0].odds_data?.fighter1_odds?.odds || null}
                              bookmaker={mainEvent.fights[0].odds_data?.fighter1_odds?.bookmaker || null}
                              size="md"
                            />
                      </div>
                          
                          <div className="text-center bg-green-500/15 rounded px-1 sm:px-2 md:px-3 py-1 md:py-2 border border-green-500/30 group-hover:bg-green-500/25 group-hover:border-green-500/50 transition-all duration-300">
                            <div className="text-[8px] sm:text-[10px] md:text-sm text-green-600 font-medium">AI</div>
                            <div className="text-xs sm:text-sm md:text-xl font-bold text-green-600">
                              {mainEvent.fights[0].prediction?.fighter1_win_probability_percent?.toFixed(1) || '50.0'}%
                            </div>
                          </div>
                      </div>

                        {/* VS Section */}
                        <div className="flex flex-col items-center justify-center px-1 md:px-3 flex-shrink-0">
                          <div className="w-8 sm:w-10 md:w-12 lg:w-16 h-8 sm:h-10 md:h-12 lg:h-16 rounded-full bg-primary/20 flex items-center justify-center mb-1 md:mb-2 border border-primary/30 group-hover:scale-105 group-hover:bg-primary/30 group-hover:border-primary/50 transition-all duration-200">
                            <span className="text-xs sm:text-sm md:text-base lg:text-2xl font-bold text-primary">VS</span>
                      </div>
                          <div className="text-[6px] sm:text-[8px] md:text-[10px] lg:text-sm text-primary font-medium text-center leading-tight group-hover:text-primary/90 transition-colors duration-300">
                            MAIN<br/>EVENT
              </div>
          </div>

                        {/* Fighter 2 */}
                        <div className="flex flex-col items-center text-center flex-1 min-w-0 max-w-[120px] sm:max-w-[160px] md:max-w-none">
                          <div className="w-16 sm:w-20 md:w-24 lg:w-32 h-16 sm:h-20 md:h-24 lg:h-32 mb-1 sm:mb-2 md:mb-3 relative group-hover:scale-105 transition-transform duration-200">
                            {mainEvent.fights[0].fighter2_image ? (
                              <Image 
                                src={mainEvent.fights[0].fighter2_image} 
                                alt={mainEvent.fights[0].fighter2_name}
                                fill
                                className="object-cover rounded-full border-2 border-primary/30 group-hover:border-primary/50 transition-colors duration-300"
                                sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, (max-width: 1024px) 96px, 128px"
                                quality={95}
                                priority
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30 group-hover:border-primary/50 group-hover:bg-primary/30 transition-all duration-300">
                                <span className="text-lg sm:text-xl md:text-3xl font-bold text-primary">{mainEvent.fights[0].fighter2_name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          
                          <h4 className="font-bold text-xs sm:text-sm md:text-lg mb-1 md:mb-3 line-clamp-2 text-center leading-tight px-1 group-hover:text-primary transition-colors duration-300">
                            {mainEvent.fights[0].fighter2_name}
                          </h4>
                          
                          <div className="mb-1 md:mb-3 group-hover:scale-105 transition-transform duration-200">
                            <FighterOdds
                              fighterName={mainEvent.fights[0].fighter2_name}
                              odds={mainEvent.fights[0].odds_data?.fighter2_odds?.odds || null}
                              bookmaker={mainEvent.fights[0].odds_data?.fighter2_odds?.bookmaker || null}
                              size="md"
                            />
                          </div>
                          
                          <div className="text-center bg-green-500/15 rounded px-1 sm:px-2 md:px-3 py-1 md:py-2 border border-green-500/30 group-hover:bg-green-500/25 group-hover:border-green-500/50 transition-all duration-300">
                            <div className="text-[8px] sm:text-[10px] md:text-sm text-green-600 font-medium">AI</div>
                            <div className="text-xs sm:text-sm md:text-xl font-bold text-green-600">
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
                  className="bg-background/80 backdrop-blur-sm p-6 rounded-lg border border-border/50"
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
              
              <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-20">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-muted-foreground/60"
                >
                    <ChevronUp className="h-8 w-8" />
                  </motion.div>
                </motion.div>
              </div>
              
              <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-muted-foreground/60"
                >
                    <ChevronDown className="h-8 w-8" />
                  </motion.div>
              </motion.div>
              </div>
              </div>
          </div>
        </section>

      {/* Features Section */}
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-light mb-4 sm:mb-6 md:mb-8">
                  Ready to Dominate?
                </h2>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-foreground/70 leading-relaxed max-w-4xl mx-auto px-2 sm:px-4">
                  Join the elite community of MMA analysts and start your journey to prediction mastery
                </p>
            </motion.div>

            <motion.div 
              className="flex flex-col items-center justify-center gap-4 sm:gap-6"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
                  <Button 
                    size="lg" 
                className="px-8 sm:px-12 md:px-16 py-4 sm:py-6 md:py-8 text-lg sm:text-xl md:text-2xl font-light hover:scale-105 transition-transform duration-300"
                    asChild
                  >
                    <Link href="/fight-predictions">
                  Get Started
                  <ArrowRight className="ml-2 sm:ml-4 h-5 sm:h-6 md:h-7 w-5 sm:w-6 md:w-7" />
                    </Link>
                  </Button>
            </motion.div>

            {/* Featured Fighters Preview */}
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-6 sm:mt-8 md:mt-16"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              {featuredFighters.map((fighter, index) => (
                <button 
                  key={fighter.id} 
                  onClick={() => {
                    const existingFromPage = sessionStorage.getItem('fighterPageFrom');
                    if (!existingFromPage) {
                      sessionStorage.setItem('fighterPageFrom', window.location.pathname + window.location.search);
                    }
                    router.push(`/fighters/${fighter.id}`);
                  }}
                  className="w-full"
                >
                  <Card className="group cursor-pointer border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                    <CardContent className="p-2 sm:p-3 md:p-4 text-center space-y-1 sm:space-y-2 md:space-y-3">
                      <div className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                        <Star className="h-4 sm:h-5 md:h-6 w-4 sm:w-5 md:w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-light text-xs sm:text-xs md:text-sm group-hover:text-primary transition-colors">{fighter.name}</h3>
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border border-primary/30 mt-1">
                          {fighter.stat}
                        </Badge>
                </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </motion.div>
            
            <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-20">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-muted-foreground/60"
              >
                  <ChevronUp className="h-8 w-8" />
                </motion.div>
              </motion.div>
            </div>
          </div>
          </div>
        </section>
      </div>
  )
}
