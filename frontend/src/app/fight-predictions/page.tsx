"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Coins, TrendingUp, Target, BarChart3, Trophy, Users, Activity, Zap, Star, Brain, Flame, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useState, useEffect } from "react"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { ENDPOINTS } from "@/lib/api-config"
import { OnboardingModal } from "@/components/onboarding-modal"

interface GlobalStats {
  totalPicks: number
  totalWagered: number
  totalWon: number
  activeUsers: number
}

export default function FightPredictionsPage() {
  const router = useRouter()
  const { isAuthenticated, getAuthHeaders, userProfile } = useAuth()
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalPicks: 0,
    totalWagered: 0,
    totalWon: 0,
    activeUsers: 0
  })
  const [loading, setLoading] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    fetchGlobalStats()
  }, [])

  const fetchGlobalStats = async () => {
    setLoading(true)
    try {
              // Fetch global community stats - using leaderboard endpoint for now
        const response = await fetch(ENDPOINTS.LEADERBOARD)
      
      if (response.ok) {
        const data = await response.json()
        setGlobalStats({
          totalPicks: data.total_picks || 1247,
          totalWagered: data.total_wagered || 458750,
          totalWon: data.total_won || 312890,
          activeUsers: data.active_users || 89
        })
      } else {
        // Fallback to demo data if endpoint doesn't exist yet
        setGlobalStats({
          totalPicks: 1247,
          totalWagered: 458750,
          totalWon: 312890,
          activeUsers: 89
        })
      }
    } catch (error) {
      console.error('Error fetching global stats:', error)
      // Fallback to demo data
      setGlobalStats({
        totalPicks: 1247,
        totalWagered: 458750,
        totalWon: 312890,
        activeUsers: 89
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition variant="slide-up">
      <div className="container relative mx-auto px-4 py-12">
          <div className="space-y-12">
            {/* Header Section */}
            <AnimatedItem variant="fadeDown" className="text-center space-y-6 max-w-4xl mx-auto">
              <div className="space-y-4">
                <h1 className="text-6xl md:text-7xl font-thin text-foreground leading-tight tracking-tight">
                  Predictions
                </h1>
                <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary rounded-full mx-auto"></div>
              </div>
              <p className="text-xl text-foreground/70 leading-relaxed">
                Master your prediction skills with AI-powered analysis, place virtual picks, 
                and compete with fellow MMA enthusiasts on the global leaderboard
            </p>
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnboarding(true)}
                className="gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                How It Works
              </Button>
            </div>
          </AnimatedItem>

            {/* Global Community Stats */}
            <AnimatedItem variant="fadeUp" delay={0.1}>
              <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border border-primary/20 backdrop-blur-sm shadow-lg">
                <CardContent className="p-6">
                  <div className="flex flex-wrap justify-center gap-8 text-center">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-bold text-lg">{globalStats.totalPicks.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground font-medium">Total Picks Made</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/20">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <TrendingUp className="h-5 w-5 text-red-600 rotate-180" />
                      </div>
                      <div>
                        <div className="font-bold text-lg">{(globalStats.totalWagered - globalStats.totalWon).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground font-medium">Coins Lost</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/20">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Coins className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-bold text-lg">{globalStats.totalWon.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground font-medium">Coins Won</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/20">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-bold text-lg">{globalStats.activeUsers}</div>
                        <div className="text-xs text-muted-foreground font-medium">Active Traders</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedItem>

            {/* Main Features Grid */}
            <AnimatedContainer className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto" delay={0.2}>
              
              {/* Quick Prediction Tool */}
              <AnimatedItem variant="scale">
                <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <CardHeader className="relative">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <Brain className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                          <Zap className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold">AI Prediction Engine</CardTitle>
                        <Badge variant="secondary" className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 dark:text-blue-300 border-0">
                          Free Analysis
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 relative">
                    <p className="text-muted-foreground leading-relaxed">
                      Harness the power of advanced machine learning to analyze fighter matchups with unprecedented accuracy. 
                      Get instant predictions based on comprehensive data analysis.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">• Win Probabilities</div>
                        <div className="text-sm font-medium">• Style Analysis</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">• Historical Data</div>
                        <div className="text-sm font-medium">• Victory Methods</div>
                      </div>
                  </div>
                  <Button 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]"
                    onClick={() => router.push('/fight-predictions/compare')}
                  >
                      Launch Analyzer <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </AnimatedItem>

              {/* Live Events Betting */}
              <AnimatedItem variant="scale" delay={0.1}>
                <Card className="group h-full bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-green-500/10 hover:border-green-500/40 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <CardHeader className="relative">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                          <Flame className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center">
                          <Star className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold">Live Event Picks</CardTitle>
                        <Badge variant="default" className="bg-gradient-to-r from-green-600 to-emerald-600 border-0 shadow-sm">
                          Place Picks
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 relative">
                    <p className="text-muted-foreground leading-relaxed">
                      Transform your fight knowledge into rewards. Place strategic picks on upcoming UFC events 
                      with real DraftKings odds and compete for leaderboard supremacy.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">• Live Odds</div>
                        <div className="text-sm font-medium">• Virtual Rewards</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">• Performance Tracking</div>
                        <div className="text-sm font-medium">• Global Competition</div>
                      </div>
                    </div>
                    <Button 
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]"
                      onClick={() => router.push('/fight-predictions/events')}
                    >
                      View Live Events <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </AnimatedItem>

            </AnimatedContainer>

            {/* Secondary Features */}
            <AnimatedContainer className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto" delay={0.4}>
              
              <AnimatedItem variant="fadeUp">
                <Card className="group text-center p-8 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/10 transition-all duration-300 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Users className="h-8 w-8 text-orange-600" />
                    </div>
                    <h3 className="text-xl font-bold">Global Rankings</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Climb the worldwide leaderboard and showcase your prediction mastery against thousands of competitors.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-500/50 group-hover:scale-105 transition-all"
                      onClick={() => router.push('/leaderboard')}
                    >
                      View Rankings
                    </Button>
                  </div>
                </Card>
              </AnimatedItem>

              <AnimatedItem variant="fadeUp" delay={0.1}>
                <Card className="group text-center p-8 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/10 transition-all duration-300 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Activity className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold">Performance Analytics</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Deep dive into your prediction analytics with detailed performance metrics and improvement insights.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50 group-hover:scale-105 transition-all"
                      onClick={() => router.push('/dashboard')}
                      disabled={!isAuthenticated}
                    >
                      {isAuthenticated ? 'View Dashboard' : 'Sign In Required'}
                    </Button>
                  </div>
                </Card>
              </AnimatedItem>

              <AnimatedItem variant="fadeUp" delay={0.2}>
                <Card className="group text-center p-8 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/10 transition-all duration-300 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Trophy className="h-8 w-8 text-yellow-600" />
                    </div>
                    <h3 className="text-xl font-bold">Rewards & Achievements</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Earn virtual coins for successful predictions and unlock exclusive achievements as you progress.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50 group-hover:scale-105 transition-all"
                      onClick={() => router.push('/about')}
                    >
                      Learn More
                    </Button>
                  </div>
                </Card>
              </AnimatedItem>

          </AnimatedContainer>



            {/* Call to Action */}
            {!isAuthenticated && (
              <AnimatedItem variant="fadeUp" delay={0.8} className="text-center">
                <Card className="max-w-3xl mx-auto p-10 bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/5 border border-primary/30 backdrop-blur-sm shadow-xl">
                  <div className="space-y-6">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                      <Star className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-3xl font-thin">Ready to Start Your Journey?</h3>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                      Join thousands of MMA fans testing their prediction skills. 
                      Create your account and get 1,000 free coins to start your journey!
                    </p>
                    <Button 
                      className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                      onClick={() => router.push('/auth')}
                    >
                      Sign Up & Get 1,000 Coins
                    </Button>
                  </div>
                </Card>
              </AnimatedItem>
            )}
        </div>
      </div>
      
      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />
    </PageTransition>
  );
} 