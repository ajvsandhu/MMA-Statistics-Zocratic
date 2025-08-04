'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Trophy, 
  Target, 
  History,
  Calendar,
  DollarSign,
  BarChart3,
  Activity,
  Award,
  Crown,
  Medal
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ENDPOINTS } from '@/lib/api-config';

interface CoinBalance {
  balance: number;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  created_at: string;
  updated_at: string;
}

interface UserPick {
  id: string;
  event_id: number;
  fight_id: string;
  fighter_id: number;
  fighter_name: string;
  stake: number;
  odds_american: number;
  odds_decimal: number;
  potential_payout: number;
  status: string;
  payout?: number;
  settled_at?: string;
  created_at: string;
}

interface Transaction {
  id: number;
  amount: number;
  type: string;
  reason?: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

interface UserRank {
  current_rank: number | null;
  highest_rank: number | null;
  portfolio_value: number;
  total_users: number;
}

export default function DashboardPage() {
  const { user, userProfile, isAuthenticated, isLoading: authLoading, getAuthHeaders } = useAuth();
  const [balance, setBalance] = useState<CoinBalance | null>(null);
  const [picks, setPicks] = useState<UserPick[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchDashboardData();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeaders();
      
      // Use the centralized API configuration
      
      // Fetch balance
      try {
        const balanceResponse = await fetch(ENDPOINTS.GET_BALANCE, { 
          headers,
          method: 'GET'
        });
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setBalance(balanceData);
        } else {
          console.error('Balance fetch failed:', balanceResponse.status, balanceResponse.statusText);
        }
      } catch (err) {
        console.error('Balance fetch error:', err);
      }

      // Fetch picks
      try {
        const picksResponse = await fetch(`${ENDPOINTS.MY_PICKS}?limit=100`, { 
          headers,
          method: 'GET'
        });
        if (picksResponse.ok) {
          const picksData = await picksResponse.json();
          setPicks(picksData);
        } else {
          console.error('Picks fetch failed:', picksResponse.status, picksResponse.statusText);
        }
      } catch (err) {
        console.error('Picks fetch error:', err);
      }

      // Fetch transactions
      try {
        const transactionsResponse = await fetch(`${ENDPOINTS.TRANSACTION_HISTORY}?limit=50`, { 
          headers,
          method: 'GET'
        });
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          setTransactions(transactionsData);
        } else {
          console.error('Transactions fetch failed:', transactionsResponse.status, transactionsResponse.statusText);
        }
      } catch (err) {
        console.error('Transactions fetch error:', err);
      }

      // Fetch user rank
      try {
        const rankResponse = await fetch(ENDPOINTS.MY_RANK, { 
          headers,
          method: 'GET'
        });
        if (rankResponse.ok) {
          const rankData = await rankResponse.json();
          setUserRank(rankData);
        } else {
          console.error('Rank fetch failed:', rankResponse.status, rankResponse.statusText);
        }
      } catch (err) {
        console.error('Rank fetch error:', err);
      }

    } catch (err) {
      console.error('Dashboard error:', err);
      // Don't set error if we got some data
      if (!balance && picks.length === 0 && transactions.length === 0) {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics (excluding refunded bets)
  const validPicks = picks.filter(p => p.status !== 'refunded');
  
  // Calculate total lost from picks data as fallback
  const calculatedTotalLost = validPicks
    .filter(p => p.status === 'lost')
    .reduce((sum, p) => sum + p.stake, 0);
  
  const stats = {
    totalBets: validPicks.length,
    activeBets: validPicks.filter(p => p.status === 'pending').length,
    wonBets: validPicks.filter(p => p.status === 'won').length,
    lostBets: validPicks.filter(p => p.status === 'lost').length,
    winRate: validPicks.length > 0 ? ((validPicks.filter(p => p.status === 'won').length / validPicks.filter(p => p.status !== 'pending').length) * 100) : 0,
    totalPotentialPayout: validPicks.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.potential_payout, 0),
    avgStake: validPicks.length > 0 ? validPicks.reduce((sum, p) => sum + p.stake, 0) / validPicks.length : 0,
    profitLoss: (balance?.total_won || 0) - (balance?.total_lost || calculatedTotalLost),
    roi: (balance?.total_wagered || 0) > 0 ? (((balance?.total_won || 0) - (balance?.total_lost || calculatedTotalLost)) / (balance?.total_wagered || 0)) * 100 : 0
  };

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} coins`;
  const formatPercentage = (percent: number) => `${percent.toFixed(1)}%`;
  const formatOdds = (odds: number) => odds > 0 ? `+${odds}` : `${odds}`;

  const getRankIcon = (rank: number | null) => {
    if (!rank) return <Trophy className="w-4 h-4 text-muted-foreground" />;
    
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Award className="w-4 h-4 text-amber-600" />;
      default:
        return <Trophy className="w-4 h-4 text-blue-500" />;
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>Please log in to view your dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-8">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded-lg w-48 mx-auto mb-2"></div>
              <div className="h-4 bg-muted rounded w-64 mx-auto"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-96 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <div className="text-destructive text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Dashboard</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-4 mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Track your prediction performance and portfolio statistics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance?.balance || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Available for predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaderboard Rank</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userRank?.current_rank ? `#${userRank.current_rank}` : 'Unranked'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {userRank?.total_users ? `of ${userRank.total_users} traders` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(stats.winRate)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.wonBets}W / {stats.lostBets}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Picks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Potential: {formatCurrency(stats.totalPotentialPayout)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="w-5 h-5 text-primary" />
              Prediction Statistics
            </CardTitle>
            <CardDescription>Your overall prediction performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Picks</span>
                  <span className="font-semibold">{stats.totalBets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Invested</span>
                  <span className="font-semibold">{formatCurrency(balance?.total_wagered || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Stake</span>
                  <span className="font-semibold">{formatCurrency(Math.round(stats.avgStake))}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Won</span>
                  <span className="font-semibold text-green-600">{formatCurrency(balance?.total_won || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Lost</span>
                  <span className="font-semibold text-red-600">{formatCurrency(balance?.total_lost || calculatedTotalLost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Net Profit</span>
                  <span className={`font-semibold ${stats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.profitLoss >= 0 ? '+' : ''}{formatCurrency(stats.profitLoss)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Trophy className="w-5 h-5 text-primary" />
              Account Info
            </CardTitle>
            <CardDescription>Your account details and rankings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Username</span>
                <span className="font-medium text-sm">{userProfile?.preferred_username || userProfile?.email?.split('@')[0] || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Rank</span>
                <span className="font-medium text-sm flex items-center gap-1">
                  {getRankIcon(userRank?.current_rank || null)}
                  {userRank?.current_rank ? `#${userRank.current_rank}` : 'Unranked'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Highest Rank</span>
                <span className="font-medium text-sm">
                  {userRank?.highest_rank ? `#${userRank.highest_rank}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Portfolio Value</span>
                <span className="font-medium text-sm text-green-600">
                  {formatCurrency(userRank?.portfolio_value || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="font-medium text-sm">
                  {balance?.created_at ? formatDistanceToNow(new Date(balance.created_at), { addSuffix: true }) : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed data */}
      <Tabs defaultValue="recent-bets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-card/50 backdrop-blur-sm border border-primary/20">
          <TabsTrigger value="recent-bets">Recent Picks</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="active-bets">Active Picks</TabsTrigger>
        </TabsList>

        <TabsContent value="recent-bets" className="space-y-4">
          <Card className="bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Recent Prediction History
              </CardTitle>
              <CardDescription>Your latest prediction activity and results</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto overscroll-contain">
              {picks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No picks placed yet</h3>
                  <p>Start making predictions to see your history!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {picks.slice(0, 100).map((pick) => (
                    <div key={pick.id} className="flex items-center justify-between p-4 rounded-xl bg-background/50 backdrop-blur-sm border border-primary/10 hover:border-primary/20 transition-all duration-200">
                      <div className="flex-1">
                        <div className="font-medium">{pick.fighter_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(pick.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Stake: {formatCurrency(pick.stake)} • Odds: {formatOdds(pick.odds_american)}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            pick.status === 'won' ? 'default' : 
                            pick.status === 'lost' ? 'destructive' : 
                            pick.status === 'refunded' ? 'outline' : 
                            'secondary'
                          }>
                            {pick.status === 'pending' ? 'Active' : 
                             pick.status === 'won' ? 'Won' : 
                             pick.status === 'lost' ? 'Lost' : 
                             pick.status === 'refunded' ? 'Voided' : 
                             'Unknown'}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">
                          {pick.status === 'won' && pick.payout ? (
                            <span className="text-green-600">+{formatCurrency(pick.payout)}</span>
                          ) : pick.status === 'lost' ? (
                            <span className="text-red-600">-{formatCurrency(pick.stake)}</span>
                          ) : pick.status === 'pending' ? (
                            <span className="text-muted-foreground">Potential: {formatCurrency(pick.potential_payout)}</span>
                          ) : (
                            <span className="text-muted-foreground">{formatCurrency(pick.stake)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Transaction History
              </CardTitle>
              <CardDescription>Your complete coin transaction history</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
                  <p>Your transaction history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 rounded-xl bg-background/50 backdrop-blur-sm border border-primary/10 hover:border-primary/20 transition-all duration-200">
                      <div className="flex-1">
                        <div className="font-medium capitalize">
                          {transaction.reason || transaction.type.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {transaction.type.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className={`font-bold text-lg ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Balance: {formatCurrency(transaction.balance_after)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-bets" className="space-y-4">
          <Card className="bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Active Picks
              </CardTitle>
              <CardDescription>Your pending predictions awaiting results</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {picks.filter(p => p.status === 'pending').length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No active picks</h3>
                  <p>Place some predictions to see them here!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {picks.filter(p => p.status === 'pending').map((pick) => (
                    <div key={pick.id} className="flex items-center justify-between p-4 rounded-xl bg-background/50 backdrop-blur-sm border border-primary/10 hover:border-primary/20 transition-all duration-200">
                      <div className="flex-1">
                        <div className="font-medium">{pick.fighter_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Placed {formatDistanceToNow(new Date(pick.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm text-muted-foreground">
                          Stake: {formatCurrency(pick.stake)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Odds: {formatOdds(pick.odds_american)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Potential: {formatCurrency(pick.potential_payout || 0)}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <Card className="border-red-200 bg-gradient-to-r from-red-50/50 to-pink-50/50 dark:border-red-800 dark:from-red-950/20 dark:to-pink-950/20 max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800 dark:text-red-200">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-red-600" />
              </div>
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 