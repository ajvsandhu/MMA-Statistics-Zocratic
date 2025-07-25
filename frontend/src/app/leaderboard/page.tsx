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
  ChevronDown
} from 'lucide-react';
import { ENDPOINTS } from '@/lib/api-config';

interface LeaderboardUser {
  rank: number;
  user_id: string;
  email: string;
  display_name?: string;
  username: string;
  balance: number;
  total_invested: number;  // Changed from total_wagered
  total_won: number;
  total_lost: number;
  active_picks_value: number;  // Changed from active_bets_value
  portfolio_value: number;
  win_rate: number;
  roi: number;
  total_picks: number;  // Changed from total_bets
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
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black";
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-500 text-black";
    if (rank === 3) return "bg-gradient-to-r from-amber-400 to-amber-600 text-black";
    if (rank <= 10) return "bg-gradient-to-r from-blue-500 to-blue-700 text-white";
    return "bg-gradient-to-r from-gray-600 to-gray-800 text-white";
  };

  const getTopThree = () => leaderboard.slice(0, 3);
  const getRestOfLeaderboard = () => leaderboard.slice(3);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-4xl font-bold tracking-tight">Leaderboard</h1>
          <Trophy className="w-8 h-8 text-yellow-500" />
        </div>
        <p className="text-lg text-muted-foreground">
          Top performers ranked by total portfolio value (balance + active picks)
        </p>
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{totalUsers} active traders</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>Updated live</span>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {getTopThree().length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {getTopThree().map((user, index) => {
            const actualRank = user.rank;
            // Arrange for podium: 2nd, 1st, 3rd
            const podiumOrder = [1, 0, 2];
            const podiumIndex = podiumOrder.indexOf(index);
            const height = podiumIndex === 1 ? 'h-64' : podiumIndex === 0 ? 'h-56' : 'h-48';
            
            return (
              <Card key={user.user_id} className={`${height} relative overflow-hidden ${actualRank === 1 ? 'border-yellow-400 shadow-yellow-400/20 shadow-lg' : actualRank === 2 ? 'border-gray-400' : 'border-amber-400'}`}>
                <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center space-y-3">
                  {/* Rank Icon */}
                  <div className="relative">
                    {getRankIcon(actualRank)}
                    {actualRank === 1 && (
                      <div className="absolute -top-2 -right-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  <div className={`w-12 h-12 rounded-full ${getRankBadgeColor(actualRank)} flex items-center justify-center text-sm font-bold`}>
                    {getUserInitials(user.email, user.display_name, user.username)}
                  </div>

                  {/* User Info */}
                  <div className="space-y-1 w-full">
                    <h3 className="font-bold text-base truncate px-1">
                      {getDisplayName(user)}
                    </h3>
                    <Badge className={`${getRankBadgeColor(actualRank)} font-bold px-2 py-1 text-xs`}>
                      #{actualRank}
                    </Badge>
                  </div>

                  {/* Portfolio Value */}
                  <div className="space-y-1">
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(user.portfolio_value)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Portfolio Value
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs w-full px-2">
                    <div className="text-center">
                      <div className="font-semibold text-xs">{formatPercentage(user.win_rate)}</div>
                      <div className="text-muted-foreground text-xs">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-xs">{user.total_picks}</div>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Full Rankings
          </CardTitle>
          <CardDescription>Complete leaderboard of all active traders</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {getRestOfLeaderboard().length > 0 ? (
              <div className="space-y-0">
                {getRestOfLeaderboard().map((user) => (
                  <div 
                    key={user.user_id} 
                    className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                  >
                    {/* Left: Rank, Avatar, Name */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-8 text-center">
                        <span className="font-bold text-lg">#{user.rank}</span>
                      </div>
                      
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-gray-600 to-gray-800 text-white flex items-center justify-center text-sm font-bold">
                        {getUserInitials(user.email, user.display_name, user.username)}
                      </div>
                      
                      <div>
                        <div className="font-semibold truncate max-w-32">
                          {getDisplayName(user)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-48">
                          Member since {new Date(user.member_since).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Center: Stats */}
                    <div className="hidden md:flex items-center gap-8 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-green-600">{formatCurrency(user.portfolio_value)}</div>
                        <div className="text-xs text-muted-foreground">Portfolio</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{formatPercentage(user.win_rate)}</div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{formatCurrency(user.total_invested)}</div>
                        <div className="text-xs text-muted-foreground">Total Invested</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{user.total_picks}</div>
                        <div className="text-xs text-muted-foreground">Picks</div>
                      </div>
                    </div>

                    {/* Right: Portfolio Value (Mobile) */}
                    <div className="md:hidden text-right">
                      <div className="font-bold text-green-600">{formatCurrency(user.portfolio_value)}</div>
                      <div className="text-xs text-muted-foreground">{user.total_picks} picks</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No rankings available yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="text-center">
        <Button onClick={fetchLeaderboard} variant="outline" className="gap-2">
          <Activity className="w-4 h-4" />
          Refresh Rankings
        </Button>
      </div>

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