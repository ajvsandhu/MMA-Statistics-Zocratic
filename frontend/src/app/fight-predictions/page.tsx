"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Coins, TrendingUp, Target, BarChart3, Trophy, Users, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useState, useEffect } from "react"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { ENDPOINTS } from "@/lib/api-config"

interface UserStats {
  balance?: number
  totalPicks?: number
  winRate?: number
  rank?: number
}

export default function FightPredictionsPage() {
  const router = useRouter()
  const { isAuthenticated, getAuthHeaders, userProfile } = useAuth()
  const [userStats, setUserStats] = useState<UserStats>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserStats()
    }
  }, [isAuthenticated])

  const fetchUserStats = async () => {
    if (!isAuthenticated) return
    
    setLoading(true)
    try {
      const headers = getAuthHeaders()
      // Fetch balance and rank in parallel
      const [balanceRes, rankRes] = await Promise.all([
        fetch(ENDPOINTS.GET_BALANCE, { headers }),
        fetch(ENDPOINTS.MY_RANK, { headers })
      ])
      
      const stats: UserStats = {}
      
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        stats.balance = balanceData.balance
        
        // Calculate win rate if we have enough data
        if (balanceData.total_wagered > 0) {
          const totalPicks = Math.floor(balanceData.total_wagered / 50) // Estimate based on avg stake
          const wins = Math.floor(balanceData.total_won / 100) // Estimate based on avg payout
          stats.totalPicks = totalPicks
          stats.winRate = totalPicks > 0 ? (wins / totalPicks) * 100 : 0
        }
      }
      
      if (rankRes.ok) {
        const rankData = await rankRes.json()
        stats.rank = rankData.current_rank
      }
      
      setUserStats(stats)
    } catch (error) {
      console.error('Error fetching user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition variant="slide-up">
      <div className="container relative mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header Section */}
          <AnimatedItem variant="fadeDown" className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Fight Predictions & Picks</h1>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Analyze upcoming UFC fights with AI-powered predictions, place picks with virtual coins, 
              and compete on the leaderboard. Use your analytical skills to climb the rankings!
            </p>
          </AnimatedItem>

          {/* User Stats Bar - Only for authenticated users */}
          {isAuthenticated && (
            <AnimatedItem variant="fadeUp" delay={0.1}>
              <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex flex-wrap justify-center gap-6 text-center">
                    <div className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-yellow-500" />
                      <span className="font-semibold">{userStats.balance?.toLocaleString() || '...'} Coins</span>
                    </div>
                    {userStats.totalPicks && (
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-500" />
                        <span>{userStats.totalPicks} Picks Made</span>
                      </div>
                    )}
                    {userStats.winRate !== undefined && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <span>{userStats.winRate.toFixed(1)}% Win Rate</span>
                      </div>
                    )}
                    {userStats.rank && (
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-orange-500" />
                        <span>Rank #{userStats.rank}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </AnimatedItem>
          )}

          {/* Main Features Grid */}
          <AnimatedContainer className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto" delay={0.2}>
            
            {/* Quick Prediction Tool */}
            <AnimatedItem variant="scale">
              <Card className="h-full bg-card/50 backdrop-blur border-primary/20 transition-all duration-300 hover:bg-card/70 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">AI Prediction Tool</CardTitle>
                      <Badge variant="secondary" className="mt-1">Free Analysis</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Compare any two fighters and get instant AI-powered predictions based on comprehensive 
                    statistical analysis, fighting styles, and historical performance data.
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Win probability percentages</li>
                    <li>• Fighting style matchup analysis</li>
                    <li>• Historical head-to-head data</li>
                    <li>• Method of victory predictions</li>
                  </ul>
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                    onClick={() => router.push('/fight-predictions/compare')}
                  >
                    Start Analysis <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </AnimatedItem>

            {/* Live Events Betting */}
            <AnimatedItem variant="scale" delay={0.1}>
              <Card className="h-full bg-card/50 backdrop-blur border-primary/20 transition-all duration-300 hover:bg-card/70 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <Coins className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Live Event Picks</CardTitle>
                      <Badge variant="default" className="mt-1 bg-green-600">Place Picks</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Put your prediction skills to the test! Place picks on upcoming UFC events using 
                    virtual coins, backed by real DraftKings odds and our AI analysis.
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Real-time betting odds integration</li>
                    <li>• Virtual coin rewards system</li>
                    <li>• Track your pick performance</li>
                    <li>• Compete with other users</li>
                  </ul>
                  <Button 
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    onClick={() => router.push('/fight-predictions/events')}
                  >
                    View Events <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </AnimatedItem>

          </AnimatedContainer>

          {/* Secondary Features */}
          <AnimatedContainer className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto" delay={0.4}>
            
            <AnimatedItem variant="fadeUp">
              <Card className="text-center p-6 bg-card/30 backdrop-blur border-primary/10 transition-all duration-300 hover:bg-card/50">
                <Users className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Leaderboard</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Compete with other users and climb the rankings based on your pick performance.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/leaderboard')}
                >
                  View Rankings
                </Button>
              </Card>
            </AnimatedItem>

            <AnimatedItem variant="fadeUp" delay={0.1}>
              <Card className="text-center p-6 bg-card/30 backdrop-blur border-primary/10 transition-all duration-300 hover:bg-card/50">
                <Activity className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Dashboard</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Track your picks, earnings, win rate, and detailed performance analytics.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/dashboard')}
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? 'View Stats' : 'Login Required'}
                </Button>
              </Card>
            </AnimatedItem>

            <AnimatedItem variant="fadeUp" delay={0.2}>
              <Card className="text-center p-6 bg-card/30 backdrop-blur border-primary/10 transition-all duration-300 hover:bg-card/50">
                <Trophy className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Rewards System</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Earn coins for successful picks and unlock achievements as you improve.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/about')}
                >
                  Learn More
                </Button>
              </Card>
            </AnimatedItem>

          </AnimatedContainer>

          {/* How It Works Section */}
          <AnimatedContainer className="max-w-4xl mx-auto space-y-6" delay={0.6}>
            <AnimatedItem variant="fadeUp" className="text-center">
              <h2 className="text-3xl font-semibold mb-2">How the System Works</h2>
              <p className="text-muted-foreground">
                Our platform combines advanced AI analysis with an engaging prediction game
              </p>
            </AnimatedItem>
            
            <div className="grid md:grid-cols-2 gap-6">
              <AnimatedItem variant="fadeUp" delay={0.1}>
                <Card className="p-6 bg-card/30 backdrop-blur border-primary/10">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                    AI-Powered Analysis
                  </h3>
                  <p className="text-muted-foreground">
                    Our machine learning models analyze thousands of fight statistics, fighter profiles, 
                    and historical matchups to generate accurate win probabilities and predictions.
                  </p>
                </Card>
              </AnimatedItem>

              <AnimatedItem variant="fadeUp" delay={0.2}>
                <Card className="p-6 bg-card/30 backdrop-blur border-primary/10">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                    Real Odds Integration
                  </h3>
                  <p className="text-muted-foreground">
                    We integrate live odds from DraftKings to provide realistic payouts and market insights, 
                    making your virtual picks feel authentic and rewarding.
                  </p>
                </Card>
              </AnimatedItem>

              <AnimatedItem variant="fadeUp" delay={0.3}>
                <Card className="p-6 bg-card/30 backdrop-blur border-primary/10">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                    Virtual Currency System
                  </h3>
                  <p className="text-muted-foreground">
                    Start with 1,000 virtual coins and grow your bankroll through smart picks. 
                    Your performance determines your ranking and bragging rights on the leaderboard.
                  </p>
                </Card>
            </AnimatedItem>
            
              <AnimatedItem variant="fadeUp" delay={0.4}>
                <Card className="p-6 bg-card/30 backdrop-blur border-primary/10">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                    Performance Tracking
                  </h3>
                      <p className="text-muted-foreground">
                    Monitor your progress with detailed analytics including win rate, ROI, 
                    favorite fighters, and prediction accuracy across different fighting styles.
                      </p>
                  </Card>
                </AnimatedItem>
            </div>
          </AnimatedContainer>

          {/* Call to Action */}
          {!isAuthenticated && (
            <AnimatedItem variant="fadeUp" delay={0.8} className="text-center">
              <Card className="max-w-2xl mx-auto p-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                <h3 className="text-2xl font-semibold mb-4">Ready to Start Predicting?</h3>
                <p className="text-muted-foreground mb-6">
                  Join thousands of MMA fans testing their prediction skills. 
                  Create your account and get 1,000 free coins to start!
                </p>
                <Button 
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-8 py-3 text-lg"
                  onClick={() => router.push('/auth')}
                >
                  Sign Up & Get 1,000 Coins
                </Button>
              </Card>
            </AnimatedItem>
          )}
        </div>
      </div>
    </PageTransition>
  );
} 