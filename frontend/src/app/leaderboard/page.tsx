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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-10 md:mb-12">
          {getTopThree().map((user, index) => {
            const actualRank = user.rank;
            const podiumOrder = [1, 0, 2];
            const podiumIndex = podiumOrder.indexOf(index);
            const height = podiumIndex === 1 ? 'h-72 sm:h-80 md:h-96' : podiumIndex === 0 ? 'h-64 sm:h-72 md:h-80' : 'h-56 sm:h-64 md:h-72';
            
            return (
              <Card key={user.user_id} className={`${height} relative overflow-hidden group transition-all duration-500 hover:shadow-2xl bg-card/50 backdrop-blur-sm border-primary/20 ${
                actualRank === 1 ? 'border-primary shadow-primary/20' : 
                actualRank === 2 ? 'border-muted-foreground/40 shadow-muted-foreground/10' : 
                'border-secondary shadow-secondary/20'
              }`}>
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20"></div>

                <CardContent className="p-2 sm:p-3 md:p-4 lg:p-6 h-full flex flex-col items-center justify-center text-center space-y-1 sm:space-y-2 md:space-y-3 lg:space-y-4 relative z-10">
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

                  <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl ${getRankBadgeColor(actualRank)} flex items-center justify-center text-sm sm:text-base md:text-lg font-bold group-hover:scale-110 transition-transform duration-300`}>
                    {getUserInitials(user.email, user.display_name, user.username)}
                  </div>

                                     <div className="space-y-0.5 sm:space-y-1 w-full">
                     <h3 className="font-bold text-xs sm:text-sm md:text-base lg:text-lg leading-tight truncate px-1 sm:px-2">
                       {getDisplayName(user)}
                     </h3>
                     <Badge className={`${getRankBadgeColor(actualRank)} font-bold px-1 sm:px-2 py-0.5 text-[9px] sm:text-[10px] md:text-xs`}>
                       #{actualRank} Champion
                     </Badge>
                   </div>

                   <div className="space-y-0.5 sm:space-y-1">
                     <div className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-primary leading-tight">
                       {formatCurrency(user.portfolio_value)}
                     </div>
                     <div className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground font-medium">
                       Portfolio Value
                     </div>
                   </div>

                                     <div className="grid grid-cols-2 gap-1 sm:gap-2 md:gap-3 text-sm w-full px-1 sm:px-2">
                     <div className="text-center p-0.5 sm:p-1 md:p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                       <div className="font-semibold text-[10px] sm:text-xs md:text-sm leading-tight">{formatPercentage(user.win_rate)}</div>
                       <div className="text-muted-foreground text-[8px] sm:text-[9px] md:text-[10px]">Win Rate</div>
                     </div>
                     <div className="text-center p-0.5 sm:p-1 md:p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                       <div className="font-semibold text-[10px] sm:text-xs md:text-sm leading-tight">{user.total_picks}</div>
                       <div className="text-muted-foreground text-[8px] sm:text-[9px] md:text-[10px]">Total Picks</div>
                     </div>
                   </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rest of Leaderboard */}
      <Card className="bg-card/50 backdrop-blur-sm border border-primary/20 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Target className="w-6 h-6 text-primary" />
            Complete Rankings
          </CardTitle>
          <CardDescription className="text-base">Elite traders from around the world competing for supremacy</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[700px] overflow-y-auto overflow-x-hidden">
            {getRestOfLeaderboard().length > 0 ? (
              <div className="space-y-0">
                {getRestOfLeaderboard().map((user, index) => (
                  <div 
                    key={user.user_id} 
                    className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b last:border-b-0 hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-6 flex-1 min-w-0">
                      <div className="w-6 sm:w-8 md:w-10 text-center shrink-0">
                        <span className="font-bold text-sm sm:text-base md:text-xl text-muted-foreground group-hover:text-primary transition-colors">#{user.rank}</span>
                      </div>
                      
                      <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center text-xs sm:text-sm font-bold group-hover:scale-110 transition-transform duration-300 shrink-0">
                        {getUserInitials(user.email, user.display_name, user.username)}
                      </div>
                      
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-semibold text-sm sm:text-base md:text-lg truncate group-hover:text-primary transition-colors">
                          {getDisplayName(user)}
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 xl:gap-6 text-sm shrink-0">
                      <div className="text-center min-w-0">
                        <div className="font-bold text-sm xl:text-base text-primary">{formatCurrency(user.portfolio_value)}</div>
                        <div className="text-xs text-muted-foreground font-medium">Portfolio</div>
                      </div>
                      <div className="text-center min-w-0">
                        <div className="font-semibold text-sm xl:text-base">{formatPercentage(user.win_rate)}</div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center min-w-0">
                        <div className="font-semibold text-sm xl:text-base">{formatCurrency(user.total_invested)}</div>
                        <div className="text-xs text-muted-foreground">Invested</div>
                      </div>
                      <div className="text-center min-w-0">
                        <div className="font-semibold text-sm xl:text-base">{user.total_picks}</div>
                        <div className="text-xs text-muted-foreground">Picks</div>
                      </div>
                    </div>

                    <div className="lg:hidden text-right space-y-1 shrink-0 min-w-0">
                      <div className="font-bold text-sm sm:text-base text-primary">{formatCurrency(user.portfolio_value)}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
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