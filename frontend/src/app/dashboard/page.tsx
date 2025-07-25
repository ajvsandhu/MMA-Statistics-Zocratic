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
      
      console.log('Dashboard: Fetching data with headers:', headers);
      
      // Use the centralized API configuration
      
      // Fetch balance
      try {
        const balanceResponse = await fetch(ENDPOINTS.GET_BALANCE, { 
          headers,
          method: 'GET'
        });
        console.log('Balance response status:', balanceResponse.status);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          console.log('Balance data:', balanceData);
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
        console.log('Picks response status:', picksResponse.status);
        if (picksResponse.ok) {
          const picksData = await picksResponse.json();
          console.log('Picks data:', picksData);
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
        console.log('Transactions response status:', transactionsResponse.status);
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          console.log('Transactions data:', transactionsData);
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
        console.log('Rank response status:', rankResponse.status);
        if (rankResponse.ok) {
          const rankData = await rankResponse.json();
          console.log('Rank data:', rankData);
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

  // Calculate statistics
  const stats = {
    totalBets: picks.length,
    activeBets: picks.filter(p => p.status === 'pending').length,
    wonBets: picks.filter(p => p.status === 'won').length,
    lostBets: picks.filter(p => p.status === 'lost').length,
    winRate: picks.length > 0 ? ((picks.filter(p => p.status === 'won').length / picks.filter(p => p.status !== 'pending').length) * 100) : 0,
    totalPotentialPayout: picks.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.potential_payout, 0),
    avgStake: picks.length > 0 ? picks.reduce((sum, p) => sum + p.stake, 0) / picks.length : 0,
    profitLoss: (balance?.total_won || 0) - (balance?.total_lost || 0),
    roi: (balance?.total_wagered || 0) > 0 ? (((balance?.total_won || 0) - (balance?.total_lost || 0)) / (balance?.total_wagered || 0)) * 100 : 0
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

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Track your prediction performance and portfolio statistics</p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
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
            <p className="text-xs text-muted-foreground">
              Available for predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaderboard Rank</CardTitle>
            {getRankIcon(userRank?.current_rank || null)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userRank?.current_rank ? `#${userRank.current_rank}` : 'Unranked'}
            </div>
            <p className="text-xs text-muted-foreground">
              {userRank?.total_users ? `of ${userRank.total_users} traders` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(stats.winRate)}</div>
            <p className="text-xs text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
              Potential: {formatCurrency(stats.totalPotentialPayout)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prediction Statistics</CardTitle>
            <CardDescription>Your overall prediction performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Picks</span>
                  <span className="font-medium">{stats.totalBets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Invested</span>
                  <span className="font-medium">{formatCurrency(balance?.total_wagered || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Stake</span>
                  <span className="font-medium">{formatCurrency(Math.round(stats.avgStake))}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Won</span>
                  <span className="font-medium text-green-600">{formatCurrency(balance?.total_won || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Lost</span>
                  <span className="font-medium text-red-600">{formatCurrency(balance?.total_lost || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Net Profit</span>
                  <span className={`font-medium ${stats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.profitLoss >= 0 ? '+' : ''}{formatCurrency(stats.profitLoss)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium text-sm">{userProfile?.email || 'N/A'}</span>
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
      <Tabs defaultValue="recent-bets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent-bets">Recent Picks</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="active-bets">Active Picks</TabsTrigger>
        </TabsList>

        <TabsContent value="recent-bets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Prediction History</CardTitle>
              <CardDescription>Your latest prediction activity</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {picks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No picks placed yet. Start making predictions to see your history!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {picks.slice(0, 100).map((pick) => (
                    <div key={pick.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{pick.fighter_name}</div>
                                                 <div className="text-sm text-muted-foreground">
                           {formatDistanceToNow(new Date(pick.created_at), { addSuffix: true })}
                         </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={pick.status === 'won' ? 'default' : pick.status === 'lost' ? 'destructive' : 'secondary'}>
                            {pick.status === 'pending' ? 'Active' : pick.status === 'won' ? 'Won' : 'Lost'}
                          </Badge>
                          <span className="font-medium">{formatCurrency(pick.stake)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Odds: {formatOdds(pick.odds_american)}
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
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Your coin transaction history</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                                                 <div className="font-medium capitalize">Transaction</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className={`font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-bets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Picks</CardTitle>
              <CardDescription>Your pending predictions</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {picks.filter(p => p.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active picks. Place some predictions!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {picks.filter(p => p.status === 'pending').map((pick) => (
                    <div key={pick.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-white">{pick.fighter_name}</div>
                        <div className="text-sm text-zinc-400">
                          {pick.event_name}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          Placed {formatDistanceToNow(new Date(pick.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm text-zinc-400">
                          Stake: {formatCurrency(pick.stake)}
                        </div>
                        <div className="text-sm text-zinc-400">
                          Odds: {formatOdds(pick.odds_american)}
                        </div>
                        <div className="text-sm text-zinc-400">
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
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
          </div>
    );
  } 