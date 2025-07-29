"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Coins, Target, Trophy, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ENDPOINTS } from '@/lib/api-config'

interface UserBet {
  id: string
  event_id: number
  fight_id: string
  fighter_id: number
  fighter_name: string
  stake: number
  odds_american: number
  odds_decimal: number
  potential_payout: number
  status: string
  payout?: number
  settled_at?: string
  created_at: string
}

interface UserBetsModalProps {
  eventId: number
  eventName: string
  isOpen: boolean
  onClose: () => void
}

export function UserBetsModal({ eventId, eventName, isOpen, onClose }: UserBetsModalProps) {
  const { isAuthenticated, getToken } = useAuth()
  const [userBets, setUserBets] = useState<UserBet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchUserBets()
    }
  }, [isOpen, isAuthenticated, eventId])

  const fetchUserBets = async () => {
    if (!isAuthenticated) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) return

      const response = await fetch(`${ENDPOINTS.MY_PICKS}?event_id=${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const betsData = await response.json()
        setUserBets(betsData)
      } else {
        setError('Failed to fetch your picks')
      }
    } catch (error) {
      console.error('Error fetching user bets:', error)
      setError('Failed to fetch your picks')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge variant="default" className="bg-green-600">Won</Badge>
      case 'lost':
        return <Badge variant="destructive">Lost</Badge>
      case 'pending':
        return <Badge variant="secondary">Active</Badge>
      case 'refunded':
        return <Badge variant="outline">Refunded</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} coins`
  const formatOdds = (odds: number) => odds > 0 ? `+${odds}` : `${odds}`

  const totalWagered = userBets.reduce((sum, bet) => sum + bet.stake, 0)
  const totalPotentialPayout = userBets.reduce((sum, bet) => sum + bet.potential_payout, 0)
  const activeBets = userBets.filter(bet => bet.status === 'pending')
  const completedBets = userBets.filter(bet => bet.status === 'won' || bet.status === 'lost')

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-primary" />
            Your Picks for {eventName}
          </DialogTitle>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Coins className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">Sign in to view your picks</h3>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              You need to be signed in to see your picks for this event.
            </p>
            <Button onClick={onClose} size="sm">Close</Button>
          </div>
        ) : loading ? (
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-pulse">
              <Coins className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">Loading your picks...</p>
          </div>
        ) : error ? (
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Target className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-red-600">Error</h3>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">{error}</p>
            <Button onClick={fetchUserBets} variant="outline" size="sm">Try Again</Button>
          </div>
        ) : userBets.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Target className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">No picks yet</h3>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              You haven't placed any picks for this event yet.
            </p>
            <Button onClick={onClose} size="sm">Close</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{userBets.length}</div>
                    <div className="text-xs text-muted-foreground">Total Picks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{activeBets.length}</div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(totalWagered)}</div>
                    <div className="text-xs text-muted-foreground">Total Wagered</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(totalPotentialPayout)}</div>
                    <div className="text-xs text-muted-foreground">Potential Payout</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Bets List */}
            <div className="space-y-2 sm:space-y-3">
              {userBets.map((bet, index) => (
                <Card key={bet.id} className="border-primary/10 hover:border-primary/20 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <span className="font-semibold truncate text-sm sm:text-base">{bet.fighter_name}</span>
                            {getStatusBadge(bet.status)}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Odds: {formatOdds(bet.odds_american)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-primary text-sm sm:text-base">{formatCurrency(bet.stake)}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          Potential: {formatCurrency(bet.potential_payout)}
                        </div>
                        {bet.payout && bet.status === 'won' && (
                          <div className="text-xs sm:text-sm text-green-600 font-semibold">
                            Won: {formatCurrency(bet.payout)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Footer Stats */}
            {completedBets.length > 0 && (
              <Card className="bg-gradient-to-br from-green-500/5 to-green-600/5 border-green-200">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-700 text-sm sm:text-base">Completed Picks</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="text-muted-foreground">Won:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        {completedBets.filter(bet => bet.status === 'won').length}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lost:</span>
                      <span className="ml-2 font-semibold text-red-600">
                        {completedBets.filter(bet => bet.status === 'lost').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 