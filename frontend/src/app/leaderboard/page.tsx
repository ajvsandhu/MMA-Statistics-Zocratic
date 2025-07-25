'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Medal, 
  Award,
  Crown,
  TrendingUp,
  Users,
  Target,
  Coins,
  Activity,
  Star,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Flame
} from 'lucide-react';
import { ENDPOINTS } from '@/lib/api-config';

interface LeaderboardUser {
  rank: number;
  user_id: string;
  email: string;
  display_name?: string;
  username: string;
  balance: number;
  total_invested: number;
  total_won: number;
  total_lost: number;
  active_picks_value: number;
  portfolio_value: number;
  win_rate: number;
  roi: number;
  total_picks: number;
  member_since: string;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(ENDPOINTS.LEADERBOARD);
      
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setTotalUsers(data.total_users || 0);
      } else {
        setError('Failed to load leaderboard');
      }
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} coins`;
  const formatPercentage = (percent: number) => `${percent.toFixed(1)}%`;
  
  const getUserInitials = (email: string, displayName?: string, username?: string) => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (username && username !== email.split('@')[0]) {
      return username.slice(0, 2).toUpperCase();
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getDisplayName = (user: LeaderboardUser) => {
    return user.display_name || user.username || user.email.split('@')[0];
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-7 h-7 text-yellow-500" />;
      case 2:
        return <Medal className="w-7 h-7 text-gray-400" />;
      case 3:
        return <Award className="w-7 h-7 text-amber-600" />;
      default:
        return <span className="w-7 h-7 flex items-center justify-center text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-lg";
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-500 text-black shadow-lg";
    if (rank === 3) return "bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-lg";
    if (rank <= 10) return "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-md";
    return "bg-gradient-to-r from-gray-600 to-gray-800 text-white";
  };

  const getTopThree = () => leaderboard.slice(0, 3);
  const getRestOfLeaderboard = () => leaderboard.slice(3);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-2xl w-1/2 mx-auto"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-72 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Trophy className="w-10 h-10 text-yellow-500" />
            <h1 className="text-5xl md:text-6xl font-thin text-foreground">
              Global Leaderboard
            </h1>
            <Trophy className="w-10 h-10 text-yellow-500" />
          </div>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full mx-auto"></div>
        </div>
        <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
          Elite traders ranked by total portfolio value (balance + active picks)
        </p>
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="font-medium">{totalUsers} active traders</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <Activity className="w-5 h-5 text-green-600" />
            <span className="font-medium">Updated live</span>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {getTopThree().length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {getTopThree().map((user, index) => {
            const actualRank = user.rank;
            const podiumOrder = [1, 0, 2];
            const podiumIndex = podiumOrder.indexOf(index);
            const height = podiumIndex === 1 ? 'h-80' : podiumIndex === 0 ? 'h-72' : 'h-64';
            
            return (
              <Card key={user.user_id} className={`${height} relative overflow-hidden group transition-all duration-500 hover:shadow-2xl ${
                actualRank === 1 ? 'border-yellow-400 shadow-yellow-400/30 shadow-xl bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-950/20 dark:to-orange-950/20' : 
                actualRank === 2 ? 'border-gray-400 shadow-gray-400/20 shadow-lg bg-gradient-to-br from-gray-50/50 to-slate-50/50 dark:from-gray-950/20 dark:to-slate-950/20' : 
                'border-amber-400 shadow-amber-400/20 shadow-lg bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20'
              }`}>
                <div className={`absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500 ${
                  actualRank === 1 ? 'bg-gradient-to-br from-yellow-400/50 via-transparent to-orange-400/50' :
                  actualRank === 2 ? 'bg-gradient-to-br from-gray-400/50 via-transparent to-slate-400/50' :
                  'bg-gradient-to-br from-amber-400/50 via-transparent to-orange-400/50'
                }`}></div>

                <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center space-y-4 relative z-10">
                  <div className="relative">
                    {getRankIcon(actualRank)}
                    {actualRank === 1 && (
                      <>
                        <div className="absolute -top-2 -right-2">
                          <Sparkles className="w-5 h-5 text-yellow-400 fill-current animate-pulse" />
                        </div>
                        <div className="absolute -bottom-1 -left-1">
                          <Flame className="w-4 h-4 text-orange-500 fill-current" />
                        </div>
                      </>
                    )}
                  </div>

                  <div className={`w-16 h-16 rounded-2xl ${getRankBadgeColor(actualRank)} flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform duration-300`}>
                    {getUserInitials(user.email, user.display_name, user.username)}
                  </div>

                                     <div className="space-y-2 w-full">
                     <h3 className="font-bold text-lg leading-tight truncate px-2">
                       {getDisplayName(user)}
                     </h3>
                     <Badge className={`${getRankBadgeColor(actualRank)} font-bold px-2 py-1 text-xs`}>
                       #{actualRank} Champion
                     </Badge>
                   </div>

                   <div className="space-y-1">
                     <div className="text-xl font-bold text-green-600 leading-tight">
                       {formatCurrency(user.portfolio_value)}
                     </div>
                     <div className="text-xs text-muted-foreground font-medium">
                       Portfolio Value
                     </div>
                   </div>

                                     <div className="grid grid-cols-2 gap-3 text-sm w-full px-2">
                     <div className="text-center p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                       <div className="font-semibold text-sm leading-tight">{formatPercentage(user.win_rate)}</div>
                       <div className="text-muted-foreground text-xs">Win Rate</div>
                     </div>
                     <div className="text-center p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                       <div className="font-semibold text-sm leading-tight">{user.total_picks}</div>
                       <div className="text-muted-foreground text-xs">Total Picks</div>
                     </div>
                   </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rest of Leaderboard */}
      <Card className="bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-primary/20 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Target className="w-6 h-6 text-primary" />
            Complete Rankings
          </CardTitle>
          <CardDescription className="text-base">Elite traders from around the world competing for supremacy</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[700px] overflow-y-auto">
            {getRestOfLeaderboard().length > 0 ? (
              <div className="space-y-0">
                {getRestOfLeaderboard().map((user, index) => (
                  <div 
                    key={user.user_id} 
                    className="flex items-center justify-between p-6 border-b last:border-b-0 hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-6 flex-1">
                      <div className="w-10 text-center">
                        <span className="font-bold text-xl text-muted-foreground group-hover:text-primary transition-colors">#{user.rank}</span>
                      </div>
                      
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform duration-300">
                        {getUserInitials(user.email, user.display_name, user.username)}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="font-semibold text-lg truncate max-w-48 group-hover:text-primary transition-colors">
                          {getDisplayName(user)}
                        </div>
                        <div className="text-sm text-muted-foreground truncate max-w-64">
                          Member since {new Date(user.member_since).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-8 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg text-green-600">{formatCurrency(user.portfolio_value)}</div>
                        <div className="text-xs text-muted-foreground font-medium">Portfolio</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base">{formatPercentage(user.win_rate)}</div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base">{formatCurrency(user.total_invested)}</div>
                        <div className="text-xs text-muted-foreground">Invested</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base">{user.total_picks}</div>
                        <div className="text-xs text-muted-foreground">Picks</div>
                      </div>
                    </div>

                    <div className="lg:hidden text-right space-y-1">
                      <div className="font-bold text-lg text-green-600">{formatCurrency(user.portfolio_value)}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.total_picks} picks • {formatPercentage(user.win_rate)} win rate
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Trophy className="w-16 h-16 mx-auto mb-6 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Rankings Yet</h3>
                <p>Be the first to make predictions and claim the top spot!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="text-center">
        <Button 
          onClick={fetchLeaderboard} 
          className="gap-3 px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          disabled={loading}
        >
          <Activity className="w-5 h-5" />
          {loading ? 'Refreshing...' : 'Refresh Rankings'}
        </Button>
      </div>

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