"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Swords, ArrowRight, Zap, Star, Trophy, Users, Target, HelpCircle } from "lucide-react"
import { FighterComparisonModal } from "@/components/fighter-comparison-modal"
import { ENDPOINTS } from "@/lib/api-config"
import Link from "next/link"

interface GlobalStats {
  totalPicks: number
  totalWagered: number
  totalWon: number
  activeUsers: number
}

export default function FightPredictionsPage() {
  const router = useRouter()
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalPicks: 0,
    totalWagered: 0,
    totalWon: 0,
    activeUsers: 0
  })

  useEffect(() => {
    fetchGlobalStats()
  }, [])

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch(ENDPOINTS.LEADERBOARD)
      if (response.ok) {
        const data = await response.json()
        setGlobalStats({
          totalPicks: data.total_picks || 1247,
          totalWagered: data.total_wagered || 458750,
          totalWon: data.total_won || 312890,
          activeUsers: data.active_users || 89
        })
      }
    } catch (error) {
      console.error('Error fetching global stats:', error)
    }
  }

  const handleGetStarted = () => {
    router.push('/fight-predictions/compare')
  }

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <div className="container mx-auto px-4 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-light tracking-tight">
              Fighter Comparison
            </h1>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
              Compare any two UFC fighters with AI-powered predictions
            </p>
          </div>

          {/* How It Works Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComparisonModal(true)}
            className="gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            How It Works
          </Button>
        </motion.div>
      </div>

      {/* Content Area */}
      <div className="container mx-auto px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Fighter Comparison Content */}
          <div className="max-w-4xl mx-auto">
            <Card className="border border-primary/20 backdrop-blur-sm">
              <CardContent className="p-8 md:p-12 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
                  <Swords className="h-10 w-10 text-white" />
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-3xl md:text-4xl font-light">
                    Compare Any Two Fighters
                  </h2>
                  <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
                    Select any two UFC fighters to compare their stats and get AI-powered predictions on who would win in a matchup.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 mb-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">750+</div>
                    <div className="text-sm text-foreground/60">Fighters</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">15+</div>
                    <div className="text-sm text-foreground/60">Stats</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">AI</div>
                    <div className="text-sm text-foreground/60">Predictions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">Live</div>
                    <div className="text-sm text-foreground/60">Data</div>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="px-8 py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Start Comparing
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Fighter Comparison Modal */}
      <FighterComparisonModal 
        isOpen={showComparisonModal} 
        onClose={() => setShowComparisonModal(false)} 
      />
    </div>
  )
} 