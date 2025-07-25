"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, TrendingUp, Users, Trophy, Activity, Brain, Target, Zap, Star, Shield, BarChart3, Flame, Sparkles, Globe, Award, ChevronDown, MousePointer } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { API_URL, ENDPOINTS } from "@/lib/api-config"
import { Badge } from "@/components/ui/badge"
import { useIsMobile, createFighterSlug } from "@/lib/utils"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { BuyMeCoffeeButton } from "@/components/ui/buy-me-coffee-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

export default function HomePage() {
  const [fightersCount, setFightersCount] = useState<number>(0)
  const [featuredFighters, setFeaturedFighters] = useState(FEATURED_FIGHTERS)
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalPicks: 1247,
    activeTraders: 89,
    totalWagered: 458750
  })
  const [showScrollIndicator, setShowScrollIndicator] = useState(true)
  const isMobile = useIsMobile()
  const heroRef = useRef<HTMLElement>(null)

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

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.offsetTop + heroRef.current.offsetHeight;
        const scrolled = window.scrollY > heroBottom * 0.3;
        setShowScrollIndicator(!scrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <PageTransition variant="slide-up">
      <div className="relative">
        {/* Hero Section */}
        <section ref={heroRef} className="relative min-h-screen flex items-start justify-center overflow-hidden pt-4 md:pt-8">
          <div className="container mx-auto px-4 relative z-10">
            <AnimatedContainer className="text-center space-y-8 md:space-y-12 max-w-6xl mx-auto">
              
              {/* Main Hero Content */}
              <AnimatedItem variant="fadeDown" className="space-y-8">
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center justify-center gap-3 mb-4 md:mb-6">
                    <Badge variant="secondary" className="px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-primary text-sm md:text-base">
                      <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                      AI-Powered MMA Analysis
                    </Badge>
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-light leading-tight tracking-tight text-foreground">
                    ZOCRATIC
                  </h1>
                  
                  <div className="w-20 md:w-32 h-1 md:h-1.5 bg-gradient-to-r from-primary to-secondary rounded-full mx-auto"></div>
                  
                  <p className="text-lg md:text-xl lg:text-2xl text-foreground/80 leading-relaxed max-w-4xl mx-auto font-normal px-4">
                    Master the art of fight analysis with advanced UFC fighter statistics, 
                    AI-powered predictions, and compete with fellow MMA enthusiasts
                  </p>
                </div>

                                                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 pt-2 md:pt-4">
                                       <Button 
                      size="lg" 
                      className="px-6 py-3 md:px-8 md:py-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-base md:text-lg font-medium border border-primary/20"
                      asChild
                    >
                     <Link href="/fight-predictions">
                       Start Predicting
                       <ArrowRight className="ml-2 h-5 w-5" />
                     </Link>
                   </Button>
                   
                                       <Button 
                      variant="outline" 
                      size="lg" 
                      className="px-6 py-3 md:px-8 md:py-4 border-2 border-foreground/20 bg-card/50 hover:bg-card/80 text-foreground hover:border-primary/60 text-base md:text-lg font-medium transition-all duration-300 backdrop-blur-sm"
                      asChild
                    >
                     <Link href="/fighters">
                       Explore Fighters
                     </Link>
                   </Button>
                 </div>
              </AnimatedItem>

              {/* Live Stats Row */}
              <AnimatedItem variant="fadeUp" delay={0.2}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 max-w-4xl mx-auto px-4">
                  <div className="flex items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl bg-card/40 border border-primary/20 backdrop-blur-md shadow-lg">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-blue-500/20">
                      <Target className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-lg md:text-2xl font-semibold text-blue-600">{globalStats.totalPicks.toLocaleString()}</div>
                      <div className="text-xs md:text-sm text-foreground/60 font-normal">Predictions Made</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl bg-card/40 border border-primary/20 backdrop-blur-md shadow-lg">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-green-500/20">
                      <Users className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-lg md:text-2xl font-semibold text-green-600">{globalStats.activeTraders}</div>
                      <div className="text-xs md:text-sm text-foreground/60 font-normal">Active Traders</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl bg-card/40 border border-primary/20 backdrop-blur-md shadow-lg">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-orange-500/20">
                      <Trophy className="h-4 w-4 md:h-6 md:w-6 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-lg md:text-2xl font-semibold text-orange-600">{fightersCount}</div>
                      <div className="text-xs md:text-sm text-foreground/60 font-normal">UFC Fighters</div>
                    </div>
                  </div>
                </div>
              </AnimatedItem>

              {/* Scroll Indicator */}
              {showScrollIndicator && (
                <AnimatedItem variant="fadeUp" delay={0.4} className="flex flex-col items-center space-y-2 md:space-y-4 pt-4 md:pt-8">
                  <div className="flex items-center gap-2 text-foreground/60 text-xs md:text-sm font-normal">
                    <MousePointer className="h-3 w-3 md:h-4 md:w-4" />
                    <span>Scroll to explore</span>
                  </div>
                  <div className="animate-bounce">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border-2 border-primary/50 flex items-center justify-center bg-primary/10 backdrop-blur-sm hover:bg-primary/20 transition-colors cursor-pointer">
                      <ChevronDown className="h-4 w-4 md:h-6 md:w-6 text-primary" />
                    </div>
                  </div>
                </AnimatedItem>
              )}
            </AnimatedContainer>
          </div>
        </section>

        {/* Features Section */}
        <section className="min-h-screen py-20 relative flex items-center">
          <div className="container mx-auto px-4">
            <AnimatedContainer className="space-y-16">
              
              {/* Section Header */}
              <AnimatedItem variant="fadeDown" className="text-center space-y-4 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-thin text-foreground">
                  Dominate Your Predictions
                </h2>
                <p className="text-xl text-foreground/70 leading-relaxed">
                  Advanced tools and AI-powered insights to elevate your MMA analysis game
                </p>
              </AnimatedItem>

              {/* Feature Cards Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                
                {/* AI Analysis */}
                <AnimatedItem variant="scale" delay={0.1}>
                  <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Brain className="h-7 w-7 text-blue-600" />
                      </div>
                      <CardTitle className="text-xl font-light text-foreground group-hover:text-primary transition-colors">AI Prediction Engine</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <p className="text-foreground/70 leading-relaxed mb-6">
                        Advanced machine learning analyzes fighter data, styles, and historical matchups to provide unmatched prediction accuracy.
                      </p>
                      <Button variant="ghost" className="group-hover:bg-primary/10 group-hover:text-primary transition-all p-0 h-auto font-semibold" asChild>
                        <Link href="/zobot">
                          Try AI Analysis
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedItem>

                {/* Live Predictions */}
                <AnimatedItem variant="scale" delay={0.2}>
                  <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-green-500/10 hover:border-green-500/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Zap className="h-7 w-7 text-green-600" />
                      </div>
                                              <CardTitle className="text-xl font-light text-foreground group-hover:text-green-600 transition-colors">Live Event Picks</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <p className="text-foreground/70 leading-relaxed mb-6">
                        Place strategic picks on live UFC events with real DraftKings odds and compete for leaderboard supremacy.
                      </p>
                      <Button variant="ghost" className="group-hover:bg-green-500/10 group-hover:text-green-600 transition-all p-0 h-auto font-semibold" asChild>
                        <Link href="/fight-predictions/events">
                          View Live Events
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedItem>

                {/* Fighter Database */}
                <AnimatedItem variant="scale" delay={0.3}>
                  <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-500/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-red-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <BarChart3 className="h-7 w-7 text-orange-600" />
                      </div>
                                             <CardTitle className="text-xl font-light text-foreground group-hover:text-orange-600 transition-colors">Fighter Analytics</CardTitle>
                     </CardHeader>
                     <CardContent className="relative z-10">
                       <p className="text-foreground/70 leading-relaxed mb-6">
                         Deep dive into comprehensive UFC fighter statistics, performance metrics, and detailed fighting styles.
                       </p>
                      <Button variant="ghost" className="group-hover:bg-orange-500/10 group-hover:text-orange-600 transition-all p-0 h-auto font-semibold" asChild>
                        <Link href="/fighters">
                          Browse Fighters
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedItem>

                {/* Global Competition */}
                <AnimatedItem variant="scale" delay={0.4}>
                  <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-500/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Globe className="h-7 w-7 text-purple-600" />
                      </div>
                                             <CardTitle className="text-xl font-light text-foreground group-hover:text-purple-600 transition-colors">Global Leaderboard</CardTitle>
                     </CardHeader>
                     <CardContent className="relative z-10">
                       <p className="text-foreground/70 leading-relaxed mb-6">
                         Compete with MMA enthusiasts worldwide and climb the ranks to become the ultimate prediction champion.
                       </p>
                      <Button variant="ghost" className="group-hover:bg-purple-500/10 group-hover:text-purple-600 transition-all p-0 h-auto font-semibold" asChild>
                        <Link href="/leaderboard">
                          View Rankings
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedItem>

                {/* Real-time Data */}
                <AnimatedItem variant="scale" delay={0.5}>
                  <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-500/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Activity className="h-7 w-7 text-cyan-600" />
                      </div>
                                             <CardTitle className="text-xl font-light text-foreground group-hover:text-cyan-600 transition-colors">Live Updates</CardTitle>
                     </CardHeader>
                     <CardContent className="relative z-10">
                       <p className="text-foreground/70 leading-relaxed mb-6">
                         Stay ahead with real-time fighter updates, fight results, and instant notifications for upcoming events.
                       </p>
                      <Button variant="ghost" className="group-hover:bg-cyan-500/10 group-hover:text-cyan-600 transition-all p-0 h-auto font-semibold" asChild>
                        <Link href="/fight-predictions/events">
                          Live Events
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedItem>

                {/* Performance Tracking */}
                <AnimatedItem variant="scale" delay={0.6}>
                  <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-yellow-500/10 hover:border-yellow-500/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-orange-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Award className="h-7 w-7 text-yellow-600" />
                      </div>
                                             <CardTitle className="text-xl font-light text-foreground group-hover:text-yellow-600 transition-colors">Track Progress</CardTitle>
                     </CardHeader>
                     <CardContent className="relative z-10">
                       <p className="text-foreground/70 leading-relaxed mb-6">
                         Monitor your prediction accuracy, portfolio growth, and compare performance against the global community.
                       </p>
                      <Button variant="ghost" className="group-hover:bg-yellow-500/10 group-hover:text-yellow-600 transition-all p-0 h-auto font-semibold" asChild>
                        <Link href="/fight-predictions">
                          My Dashboard
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedItem>
              </div>
            </AnimatedContainer>
          </div>
        </section>

        {/* Featured Fighters Section */}
        <section className="min-h-screen py-20 relative flex items-center">
          <div className="container mx-auto px-4">
            <AnimatedContainer className="space-y-12">
              
              <AnimatedItem variant="fadeDown" className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-thin text-foreground">
                  Elite Fighters
                </h2>
                <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
                  Analyze performance data from the world's best UFC athletes
                </p>
              </AnimatedItem>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {featuredFighters.map((fighter, index) => (
                  <AnimatedItem key={fighter.id} variant="scale" delay={0.1 * index}>
                    <Link href={`/fighters/${fighter.id}`}>
                      <Card className="group cursor-pointer bg-gradient-to-br from-card to-card/50 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                        <CardContent className="p-6 text-center space-y-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-primary/30 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                            <Star className="h-8 w-8 text-primary fill-current" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-light text-lg group-hover:text-primary transition-colors">{fighter.name}</h3>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/30">
                              {fighter.stat}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </AnimatedItem>
                ))}
              </div>

              <AnimatedItem variant="fadeUp" delay={0.4} className="text-center">
                <Button variant="outline" size="lg" className="px-8 py-4 border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-lg font-semibold" asChild>
                  <Link href="/fighters">
                    View All Fighters
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </AnimatedItem>
            </AnimatedContainer>
          </div>
        </section>

        {/* CTA Section */}
        <section className="min-h-screen py-20 relative overflow-hidden flex items-center">
          <div className="container mx-auto px-4 relative z-10">
            <AnimatedContainer className="text-center space-y-12 max-w-4xl mx-auto">
              
              <AnimatedItem variant="fadeDown" className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-thin text-foreground">
                  Ready to Dominate?
                </h2>
                <p className="text-xl text-foreground/70 leading-relaxed">
                  Join the elite community of MMA analysts and start your journey to prediction mastery
                </p>
              </AnimatedItem>

              <AnimatedItem variant="scale" delay={0.2}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Button 
                    size="lg" 
                    className="px-10 py-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 text-xl font-light border border-primary/20"
                    asChild
                  >
                    <Link href="/fight-predictions">
                      Start Predicting Now
                      <Flame className="ml-3 h-6 w-6" />
                    </Link>
                  </Button>
                  
                  <BuyMeCoffeeButton />
                </div>
              </AnimatedItem>
            </AnimatedContainer>
          </div>
        </section>
      </div>
    </PageTransition>
  )
}
