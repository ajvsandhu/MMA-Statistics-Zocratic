'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Crown,
  Users,
  Activity,
  Star,
  TrendingUp,
  Target,
  Coins,
  X,
  Calendar,
  Award,
  Sparkles,
  Flame,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ENDPOINTS } from '@/lib/api-config';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';

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
  highest_rank?: number;
  rank_change?: 'up' | 'down' | 'same';
}

// User Profile Modal Component
const UserProfileModal = ({ user, isOpen, onClose }: { 
  user: LeaderboardUser | null, 
  isOpen: boolean, 
  onClose: () => void 
}) => {
  const [activePicks, setActivePicks] = useState<any[]>([]);
  const [loadingPicks, setLoadingPicks] = useState(false);
  const { isAuthenticated, getAuthHeaders, userProfile } = useAuth();

  // Check if this is the current user's profile
  const isOwnProfile = userProfile && user && userProfile.email === user.email;

  // Fetch user's active picks
  const fetchActivePicks = async () => {
    try {
      setLoadingPicks(true);
      
      // Fetch picks for the profile user using public endpoint (no auth required)
      let response = await fetch(`${ENDPOINTS.PUBLIC_USER_PICKS}/${user?.user_id}?limit=100`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        console.log(`Active picks fetch failed, status: ${response.status}`);
        setActivePicks([]);
        return;
      }
      
      const data = await response.json();
      // Filter for pending (active) picks only
      const pendingPicks = (data || []).filter((pick: any) => pick.status === 'pending');
      setActivePicks(pendingPicks);
    } catch (error) {
      console.log('Active picks not available:', error);
      setActivePicks([]);
    } finally {
      setLoadingPicks(false);
    }
  };

  // Fetch picks when user changes
  useEffect(() => {
    if (user && isOpen) {
      fetchActivePicks();
    } else {
      setActivePicks([]);
      setLoadingPicks(false);
    }
  }, [user?.user_id, isOpen]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!user) return null;

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} coins`;
  const formatPercentage = (percent: number) => `${percent.toFixed(1)}%`;
  const getDisplayName = (user: LeaderboardUser) => {
    return user.display_name || user.username || user.email.split('@')[0];
  };
  const getUserInitials = (email: string, displayName?: string, username?: string) => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (username && username !== email.split('@')[0]) {
      return username.slice(0, 2).toUpperCase();
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  // Modal content
  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[99999] overflow-hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          {/* Full viewport backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full bg-black/80 backdrop-blur-lg"
            onClick={onClose}
          />
          
          {/* Modal Container */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50, rotateX: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50, rotateX: -15 }}
              transition={{ 
                duration: 0.4, 
                ease: [0.25, 0.46, 0.45, 0.94],
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
              className="pointer-events-auto relative z-10 w-full max-w-4xl"
            >
              <Card className="w-full bg-background/98 backdrop-blur-xl border border-primary/20 shadow-2xl max-h-[90vh] overflow-hidden">
                <CardContent className="p-0">
                  <div className="max-h-[90vh]">
                    <motion.div 
                      className="p-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
                    >
                      {/* Header */}
                      <motion.div 
                        className="flex items-center justify-between mb-6"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                            {getUserInitials(user.email, user.display_name, user.username)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">{getDisplayName(user)}</h3>
                            <Badge variant="outline" className="text-xs">
                              Rank #{user.rank}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>

                      {/* Active Picks Section - Moved Higher */}
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <Target className="h-5 w-5 text-primary" />
                          </div>
                          <h4 className="text-xl font-bold">Active Picks</h4>
                          {activePicks.length > 0 && (
                            <Badge variant="secondary" className="text-xs ml-2">
                              {activePicks.length}
                            </Badge>
                          )}
                        </div>

                        {loadingPicks ? (
                          <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="animate-pulse">
                                <div className="h-16 bg-muted rounded-lg"></div>
                              </div>
                            ))}
                          </div>
                        ) : activePicks.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto scrollbar-thin" onWheel={(e) => e.stopPropagation()}>
                            {activePicks.map((pick, index) => (
                              <div key={index} className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="font-semibold text-base truncate">
                                    {pick.fighter_name}
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    Active
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div className="text-sm text-muted-foreground">
                                    <div className="font-medium mb-1">Date</div>
                                    <div>{pick.created_at ? new Date(pick.created_at).toLocaleDateString() : 'Recently placed'}</div>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <div className="font-medium mb-1">Odds</div>
                                    <div>{pick.odds_american ? (pick.odds_american > 0 ? `+${pick.odds_american}` : pick.odds_american) : 'TBD'}</div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="text-sm">
                                    <div className="font-medium mb-1">Stake</div>
                                    <div className="font-semibold">{pick.stake ? `${pick.stake} coins` : 'N/A'}</div>
                                  </div>
                                  <div className="text-sm">
                                    <div className="font-medium mb-1">Potential Payout</div>
                                    <div className="font-bold text-green-600">
                                      {pick.potential_payout ? `${Math.round(pick.potential_payout)} coins` : 'TBD'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No active picks</p>
                            <p className="text-xs">You haven't placed any picks yet</p>
                          </div>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="space-y-4 mb-6">
                        {/* Portfolio Value */}
                        <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(user.portfolio_value)}
                          </div>
                          <div className="text-sm text-muted-foreground">Portfolio Value</div>
                        </div>

                        {/* Performance Stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 rounded-lg bg-background border">
                            <div className="text-lg font-bold text-green-600">
                              {formatPercentage(user.win_rate)}
                            </div>
                            <div className="text-xs text-muted-foreground">Win Rate</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-background border">
                            <div className="text-lg font-bold">{user.total_picks}</div>
                            <div className="text-xs text-muted-foreground">Total Picks</div>
                          </div>
                        </div>

                        {/* Achievement & Financial Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-lg bg-background border">
                            <div className="text-sm font-bold text-yellow-600 flex items-center justify-center gap-1">
                              <Trophy className="w-3 h-3" />
                              #{user.highest_rank || user.rank}
                            </div>
                            <div className="text-xs text-muted-foreground">Best Rank</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-background border">
                            <div className="text-sm font-bold text-blue-600">
                              {formatCurrency(user.total_won)}
                            </div>
                            <div className="text-xs text-muted-foreground">Total Won</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-background border">
                            <div className="text-sm font-bold text-orange-600">
                              {formatCurrency(user.total_invested)}
                            </div>
                            <div className="text-xs text-muted-foreground">Invested</div>
                          </div>
                        </div>

                        {/* Member Since */}
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Member since {new Date(user.member_since).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default function P4PLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isMobile, setIsMobile] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    
    // Auto-refresh every 2 minutes to keep data current
    const refreshInterval = setInterval(() => {
      fetchLeaderboard(true); // Silent refresh
    }, 120000); // 2 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  const fetchLeaderboard = async (silentRefresh = false) => {
    try {
      if (!silentRefresh) {
      setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      const response = await fetch(ENDPOINTS.LEADERBOARD);
      
      if (response.ok) {
        const data = await response.json();
        const newLeaderboard = data.leaderboard || [];
        
        // Get stored previous ranks from localStorage for persistent tracking
        const storedRanks = localStorage.getItem('leaderboardPreviousRanks');
        const storedPreviousRanks = storedRanks ? new Map(JSON.parse(storedRanks)) : new Map();
        
        // Calculate rank changes and highest ranks
        const updatedLeaderboard = newLeaderboard.map((user: LeaderboardUser) => {
          const previousRank = storedPreviousRanks.get(user.user_id);
          let rank_change: 'up' | 'down' | 'same' = 'same';
          
          if (previousRank !== undefined) {
            if (user.rank < previousRank) {
              rank_change = 'up';
            } else if (user.rank > previousRank) {
              rank_change = 'down';
            }
          }
          
          // Calculate highest rank properly (lowest number = highest rank)
          const storedHighest = localStorage.getItem(`highestRank_${user.user_id}`);
          const storedHighestRank = storedHighest ? parseInt(storedHighest) : user.rank;
          const highest_rank = Math.min(storedHighestRank, user.rank);
          
          // Store the new highest rank
          localStorage.setItem(`highestRank_${user.user_id}`, highest_rank.toString());
          
          return {
            ...user,
            rank_change,
            highest_rank
          };
        });
        
        // Store current ranks for next comparison
        const currentRanks = new Map();
        updatedLeaderboard.forEach((user: LeaderboardUser) => {
          currentRanks.set(user.user_id, user.rank);
        });
        localStorage.setItem('leaderboardPreviousRanks', JSON.stringify(Array.from(currentRanks.entries())));
        setPreviousRanks(currentRanks);
        
        setLeaderboard(updatedLeaderboard);
        setTotalUsers(data.total_users || 0);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError('Failed to load leaderboard');
      }
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const openUserProfile = (user: LeaderboardUser) => {
    setSelectedUser(user);
  };

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
          
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const topThree = leaderboard.slice(0, 3);
  const restOfUsers = leaderboard.slice(3);

  // Pagination logic
  const totalPages = Math.ceil(restOfUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = restOfUsers.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 sm:space-y-6 px-4">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" />
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight">
            P4P Leaderboard
            </h1>
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" />
        </div>
        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Elite traders ranked by total portfolio value (balance + active picks)
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
          <Badge variant="outline" className="flex items-center gap-2 text-xs sm:text-sm">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            {totalUsers} active traders
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2 text-xs sm:text-sm">
            <Activity className={`w-3 h-3 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : 'animate-pulse'}`} />
            {refreshing ? 'Updating...' : 'Updated live'}
          </Badge>
        </div>
      </div>

      {/* Podium */}
      {topThree.length > 0 && (
        <div className="relative mb-12">
          {/* Championship Background Effects */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-yellow-500/5 via-yellow-500/2 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-to-bl from-secondary/10 to-transparent rounded-full blur-2xl animate-pulse delay-1000"></div>
          </div>

          {/* Podium Platform - Fixed 3-Column Grid Layout */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8 px-4 w-full max-w-4xl mx-auto">
            
            {/* Left Column - 2nd Place */}
            <div className="flex justify-center items-end">
              {topThree.find(user => user.rank === 2) ? (
                                 <motion.div
                   initial={{ opacity: 0, y: isMobile ? 30 : 100, scale: isMobile ? 0.95 : 0.8 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ delay: 0.2, duration: isMobile ? 0.3 : 0.8 }}
                   className="flex flex-col items-center cursor-pointer group relative w-full max-w-[200px]"
                   onClick={() => openUserProfile(topThree.find(user => user.rank === 2)!)}
                 >
                   <motion.div
                     animate={isMobile ? {} : { y: [0, -3, 0] }}
                     transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                     className="text-center mb-3 sm:mb-4 relative"
                   >
                    {/* Silver Glow - NO SCALING TO PREVENT BLUR */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-300/20 to-gray-500/20 blur-lg opacity-100 group-hover:opacity-100"></div>
                    
                                         <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 flex items-center justify-center text-lg sm:text-xl font-bold text-black mb-2 shadow-xl ring-2 ring-gray-400/30 group-hover:ring-4 group-hover:ring-gray-400/60 group-hover:shadow-2xl transition-all duration-300">
                       {getUserInitials(topThree.find(user => user.rank === 2)!.email, topThree.find(user => user.rank === 2)!.display_name, topThree.find(user => user.rank === 2)!.username)}
                       
                       {/* Sparkling Effects */}
                       <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-gray-300 animate-pulse" />
                     </div>

                                         <h3 className="font-bold text-sm sm:text-lg group-hover:text-primary transition-colors text-center w-full">
                       {getDisplayName(topThree.find(user => user.rank === 2)!)}
                     </h3>
                                         <p className="text-xs sm:text-sm text-muted-foreground text-center w-full">
                       {formatCurrency(topThree.find(user => user.rank === 2)!.portfolio_value)}
                     </p>
                  </motion.div>

                  {/* Silver Podium Platform - Medium Height */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "80px" }}
                    transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
                    className="w-20 sm:w-32 bg-gradient-to-t from-gray-400 via-gray-300 to-gray-200 rounded-t-xl flex flex-col items-center justify-start pt-2 sm:pt-3 border-2 border-gray-500/30 shadow-xl relative overflow-hidden"
                    style={{ height: "80px" }}
                  >
                    <Badge className="bg-gray-300 text-black font-bold text-xs sm:text-sm shadow-lg relative z-10">
                      2nd
                    </Badge>
                    
                    {/* Ladder Rungs Effect - Behind text */}
                    <div className="absolute bottom-0 left-0 right-0 space-y-2 z-0">
                      <div className="h-0.5 bg-gray-500/30 mx-2"></div>
                      <div className="h-0.5 bg-gray-500/20 mx-2"></div>
                      <div className="h-0.5 bg-gray-500/15 mx-2"></div>
                        </div>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="opacity-0 w-full max-w-[200px]">
                  {/* Empty space placeholder for 2nd place */}
                        </div>
                    )}
                  </div>

            {/* Center Column - 1st Place */}
            <div className="flex justify-center items-end">
              {topThree.find(user => user.rank === 1) && (
                                 <motion.div
                   initial={{ opacity: 0, y: isMobile ? 50 : 150, scale: isMobile ? 0.9 : 0.7 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ delay: 0.1, duration: isMobile ? 0.4 : 1 }}
                   className="flex flex-col items-center cursor-pointer group relative z-10 w-full max-w-[240px]"
                   onClick={() => openUserProfile(topThree.find(user => user.rank === 1)!)}
                 >
                   <motion.div
                     animate={isMobile ? {} : { y: [0, -5, 0], rotate: [0, 1, -1, 0] }}
                     transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                     className="text-center mb-3 sm:mb-4 relative"
                   >
                    {/* Royal Aura - NO SCALING TO PREVENT BLUR */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400/30 via-yellow-500/40 to-yellow-600/30 blur-2xl opacity-100 group-hover:opacity-100 animate-pulse"></div>
                    
                    {/* Crown */}
                    <motion.div 
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute -top-2 sm:-top-3 left-1/2 transform -translate-x-1/2"
                    >
                      <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 drop-shadow-xl" />
                    </motion.div>

                    {/* Champion Sparkles */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0"
                    >
                      <Sparkles className="absolute -top-2 -right-2 w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 animate-pulse" />
                      <Zap className="absolute -bottom-1 -left-1 w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                      <Star className="absolute top-1/2 -right-3 w-2 h-2 sm:w-3 sm:h-3 text-yellow-300 animate-ping" />
                    </motion.div>
                    
                                        <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 flex items-center justify-center text-xl sm:text-2xl font-bold text-black mb-2 shadow-2xl ring-4 ring-yellow-500/50 group-hover:ring-6 group-hover:ring-yellow-400/80 group-hover:shadow-yellow-500/40 transition-all duration-300 border-2 border-yellow-200">
                      {getUserInitials(topThree.find(user => user.rank === 1)!.email, topThree.find(user => user.rank === 1)!.display_name, topThree.find(user => user.rank === 1)!.username)}
                      
                      {/* Inner Glow */}
                      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-yellow-200/30 to-transparent"></div>
                    </div>

                    <h3 className="font-bold text-base sm:text-xl group-hover:text-primary transition-colors text-center">
                      👑 {getDisplayName(topThree.find(user => user.rank === 1)!)}
                     </h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      {formatCurrency(topThree.find(user => user.rank === 1)!.portfolio_value)}
                    </p>
                    
                    {/* Champion Title */}
                    <Badge className="mt-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-xs border-yellow-300 shadow-lg">
                      CHAMPION
                    </Badge>
                  </motion.div>

                  {/* Gold Podium Platform - Tallest */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "120px" }}
                    transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                    className="w-24 sm:w-36 bg-gradient-to-t from-yellow-500 via-yellow-400 to-yellow-300 rounded-t-xl flex flex-col items-center justify-start pt-2 sm:pt-3 border-2 border-yellow-600/50 shadow-2xl relative overflow-hidden"
                    style={{ height: "120px" }}
                  >
                    <Badge className="bg-yellow-400 text-black font-bold text-sm sm:text-lg shadow-xl border border-yellow-600 relative z-10">
                      1st
                     </Badge>
                    
                    {/* Royal Ladder Rungs - Behind text */}
                    <div className="absolute bottom-0 left-0 right-0 space-y-1.5 z-0">
                      <div className="h-0.5 bg-yellow-600/40 mx-2"></div>
                      <div className="h-0.5 bg-yellow-600/30 mx-2"></div>
                      <div className="h-0.5 bg-yellow-600/20 mx-2"></div>
                      <div className="h-0.5 bg-yellow-600/15 mx-2"></div>
                      <div className="h-0.5 bg-yellow-600/10 mx-2"></div>
                   </div>

                    {/* Throne Effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-yellow-600/20 to-transparent"></div>
                  </motion.div>
                </motion.div>
              )}
                     </div>

            {/* Right Column - 3rd Place */}
            <div className="flex justify-center items-end">
              {topThree.find(user => user.rank === 3) ? (
                                 <motion.div
                   initial={{ opacity: 0, y: isMobile ? 40 : 80, scale: isMobile ? 0.95 : 0.9 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ delay: 0.3, duration: isMobile ? 0.3 : 0.7 }}
                   className="flex flex-col items-center cursor-pointer group relative w-full max-w-[200px]"
                   onClick={() => openUserProfile(topThree.find(user => user.rank === 3)!)}
                 >
                   <motion.div
                     animate={isMobile ? {} : { y: [0, -2, 0] }}
                     transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                     className="text-center mb-3 sm:mb-4 relative"
                   >
                    {/* Bronze Glow - NO SCALING TO PREVENT BLUR */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-600/20 blur-lg opacity-100 group-hover:opacity-100"></div>
                    
                                         <div className="relative mx-auto w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-sm sm:text-lg font-bold text-black mb-2 shadow-lg ring-2 ring-amber-500/30 group-hover:ring-4 group-hover:ring-amber-500/60 group-hover:shadow-2xl transition-all duration-300">
                       {getUserInitials(topThree.find(user => user.rank === 3)!.email, topThree.find(user => user.rank === 3)!.display_name, topThree.find(user => user.rank === 3)!.username)}
                       
                       {/* Bronze Effects */}
                       <Star className="pointer-events-none absolute -top-1 -right-1 w-3 h-3 text-amber-300 animate-pulse" />
                     </div>

                                         <h3 className="font-bold text-sm sm:text-lg group-hover:text-primary transition-colors text-center w-full">
                       {getDisplayName(topThree.find(user => user.rank === 3)!)}
                     </h3>
                                         <p className="text-xs sm:text-sm text-muted-foreground text-center w-full">
                       {formatCurrency(topThree.find(user => user.rank === 3)!.portfolio_value)}
                     </p>
                  </motion.div>

                  {/* Bronze Podium Platform - Shortest */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "50px" }}
                    transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
                    className="w-18 sm:w-28 bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 rounded-t-xl flex flex-col items-center justify-start pt-2 sm:pt-3 border-2 border-amber-600/30 shadow-lg relative overflow-hidden"
                    style={{ height: "50px" }}
                  >
                    <Badge className="bg-amber-400 text-black font-bold text-xs sm:text-sm shadow-lg relative z-10">
                      3rd
                    </Badge>
                    
                    {/* Ladder Rungs Effect - Behind text */}
                    <div className="absolute bottom-0 left-0 right-0 space-y-2 z-0">
                      <div className="h-0.5 bg-amber-600/30 mx-2"></div>
                      <div className="h-0.5 bg-amber-600/20 mx-2"></div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="opacity-0 w-full max-w-[200px]">
                  {/* Empty space placeholder for 3rd place */}
                     </div>
              )}
                     </div>
                   </div>

          {/* Competitive Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="text-center mt-6 sm:mt-8"
          >
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              🔥 <span className="text-primary font-bold">Climb the ladder</span> and claim your throne! 🔥
            </p>
          </motion.div>
        </div>
      )}

      {/* Rest of Rankings */}
      {restOfUsers.length > 0 && (
        <Card className="border border-primary/20 mx-4 sm:mx-0">
        <CardContent className="p-0">
            <div className="p-4 sm:p-6 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h3 className="text-lg sm:text-xl font-semibold">Complete Rankings</h3>
                  <Badge variant="secondary" className="text-xs">
                    #{restOfUsers.length + 3} fighters climbing
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {currentUsers.length} of {restOfUsers.length} users
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Every pick counts in the race to the top
              </p>
            </div>
            
            <div className="h-[400px] sm:h-[480px] overflow-hidden">
              <AnimatePresence mode="wait">
                                 <motion.div
                   key={currentPage}
                   initial={{ opacity: 0, y: isMobile ? 10 : 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: isMobile ? -10 : -20 }}
                   transition={{ duration: isMobile ? 0.2 : 0.3, ease: "easeInOut" }}
                   className="h-full"
                 >
                   {currentUsers.map((user, index) => (
                   <motion.div 
                       key={user.user_id} 
                     initial={{ opacity: 0, x: isMobile ? -10 : -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: index * (isMobile ? 0.02 : 0.05) }}
                     className="flex items-center justify-between p-4 sm:p-5 border-b last:border-b-0 hover:bg-muted/30 transition-all cursor-pointer group min-h-[64px]"
                     onClick={() => openUserProfile(user)}
                   >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {/* Rank with climbing indicator */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-6 sm:w-8 text-center font-bold text-sm sm:text-base text-muted-foreground group-hover:text-primary transition-colors">
                        #{user.rank}
                      </span>
                      {/* Rank change indicator */}
                      {user.rank_change === 'up' && (
                        <div className="flex items-center">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                        </div>
                      )}
                      {user.rank_change === 'down' && (
                        <div className="flex items-center">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 rotate-180" />
                        </div>
                      )}
                      {user.rank_change === 'same' && (
                        <div className="flex items-center">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-muted-foreground/40 rounded-full"></div>
                        </div>
                      )}
                      </div>
                      
                    {/* User Avatar */}
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-xs sm:text-sm group-hover:brightness-110 group-hover:shadow-lg transition-all duration-300 shrink-0">
                        {getUserInitials(user.email, user.display_name, user.username)}
                      </div>
                      
                    {/* User Info */}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                          {getDisplayName(user)}
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {formatCurrency(user.portfolio_value)}
                      </p>
                      </div>
                    </div>

                  {/* Stats */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Badge variant="outline" className="text-xs">
                        {formatPercentage(user.win_rate)} WR
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {user.total_picks} picks
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {/* Fill empty space if fewer than 5 users - make them invisible */}
              {currentUsers.length < 5 && Array.from({ length: 5 - currentUsers.length }, (_, i) => (
                <div key={`empty-${i}`} className="h-16 sm:h-20 bg-transparent opacity-0" />
              ))}
                </motion.div>
              </AnimatePresence>
            </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="h-9 w-9 p-0 rounded-lg"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground min-w-[80px] text-center">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="h-9 w-9 p-0 rounded-lg"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNum)}
                          className="h-9 w-9 p-0 rounded-lg font-medium"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
      </Card>
      )}

      {/* Manual Refresh Button */}
      <div className="text-center mt-8">
        <Button 
          onClick={() => fetchLeaderboard(false)} 
          variant="outline"
          className="gap-2 px-6 py-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          disabled={loading}
        >
          <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing Rankings...' : 'Refresh Leaderboard'}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Auto-updates every 2 minutes • Last updated: {lastUpdated.toLocaleTimeString()}
          {refreshing && <span className="text-primary"> • Updating...</span>}
        </p>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal 
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      {error && (
        <Card className="border-red-500/50 bg-red-500/5 max-w-md mx-auto">
          <CardContent className="p-4 text-center text-red-600">
            <p>{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 