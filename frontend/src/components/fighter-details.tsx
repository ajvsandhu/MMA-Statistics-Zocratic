"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ENDPOINTS, fetchWithRetries } from "@/lib/api-config"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts"
import { ErrorBoundary } from "react-error-boundary"
import { ChevronDown, ChevronUp, X, AlertCircle, RefreshCw } from "lucide-react"
import { FighterStats, FightHistory } from "@/types/fighter"
import { formatDate } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/lib/utils"

// Constants
const DEFAULT_PLACEHOLDER_IMAGE = '/placeholder-fighter.png'
const DEFAULT_VALUE = "0"
const DEFAULT_PERCENTAGE = "0%"
const UNRANKED_VALUE = 99

// Constants for styling
const MOBILE_STYLES = {
  statsGrid: "grid-cols-1 gap-2 text-sm",
  statsCard: "p-2",
  statsTitle: "text-base",
  statsValue: "text-lg",
  statsLabel: "text-xs",
  chartHeight: "h-[200px]",
  imageSize: "w-32 h-32",
  headerText: "text-2xl",
  subText: "text-sm"
};

const DESKTOP_STYLES = {
  statsGrid: "grid-cols-2 gap-4",
  statsCard: "p-4",
  statsTitle: "text-lg",
  statsValue: "text-2xl",
  statsLabel: "text-sm",
  chartHeight: "h-[300px]",
  imageSize: "w-64 h-64",
  headerText: "text-3xl",
  subText: "text-base"
};

// Utility functions
const safeParseFloat = (value: string | undefined): number => {
  if (!value || typeof value !== 'string') return 0;
  // Remove any non-numeric characters except decimal point
  const sanitized = value.replace(/[^\d.]/g, '');
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
};

const safeReplacePercent = (value: string | undefined): string => {
  if (!value || typeof value !== 'string') return '0%';
  // Remove any existing % symbol and add it back
  const sanitized = value.replace(/%/g, '').trim();
  return `${sanitized}%`;
};

// Type definitions
type FightResult = 'win' | 'loss' | 'draw' | 'nc' | 'dq'

interface FighterDetailsProps {
  fighterName: string
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface ChartDataSet {
  strikeData: ChartData[];
  strikeAccuracyData: ChartData[];
  grappleData: ChartData[];
  grappleAccuracyData: ChartData[];
  overallStats: { subject: string; A: number }[];
  strikeDistribution: { name: string; value: number; percentage: number }[];
}

interface FightStat {
  label: string;
  value: string;
}

interface FightStatCategory {
  category: string;
  stats: FightStat[];
}

interface Fight {
  id?: string | number;
  fighter_name?: string;
  fight_url?: string;
  opponent: string;
  date?: string;
  fight_date?: string;
  opponent_name?: string;
  opponent_display_name?: string;
  result: string;
  method: string;
  round: number;
  time: string;
  event: string;
  kd?: string;
  sig_str?: string;
  sig_str_pct?: string;
  total_str?: string;
  head_str?: string;
  body_str?: string;
  leg_str?: string;
  takedowns?: string;
  td_pct?: string;
  ctrl?: string;
}

// Error Fallback Component
function ChartErrorFallback({ error }: { error: Error }) {
  return (
    <div className="p-4 text-sm text-red-500">
      Failed to load chart: {error.message}
    </div>
  )
}

// Result color mapping
const RESULT_COLORS: Record<FightResult, string> = {
  win: 'text-green-500',
  loss: 'text-red-500',
  draw: 'text-yellow-500',
  nc: 'text-gray-500',
  dq: 'text-gray-500'
}

// Add method emoji mapping
const METHOD_ICONS: Record<string, string> = {
  'KO/TKO': '💥',
  'Submission': '🔒',
  'Decision - Unanimous': '📋',
  'Decision - Split': '⚖️',
  'Decision - Majority': '✌️',
  'No Contest': '⚠️',
  'DQ': '🚫',
};

const getMethodIcon = (method: string): string => {
  const cleanMethod = method.trim().toLowerCase();
  if (cleanMethod.includes('ko') || cleanMethod.includes('tko')) return '💥';
  if (cleanMethod.includes('submission')) return '🔒';
  if (cleanMethod.includes('unanimous')) return '📋';
  if (cleanMethod.includes('split')) return '⚖️';
  if (cleanMethod.includes('majority')) return '✌️';
  if (cleanMethod.includes('no contest')) return '⚠️';
  if (cleanMethod.includes('dq')) return '🚫';
  return '';
};

// Add result emoji mapping
const RESULT_EMOJI: Record<string, string> = {
  'win': '🏆',
  'loss': '❌',
  'draw': '🤝',
  'nc': '⚠️',
  'dq': '🚫',
};

const getResultEmoji = (result: string): string => {
  const lowerResult = result.toLowerCase().trim();
  if (lowerResult.includes('win') || lowerResult === 'w') return RESULT_EMOJI['win'];
  if (lowerResult.includes('loss') || lowerResult === 'l') return RESULT_EMOJI['loss'];
  if (lowerResult.includes('draw') || lowerResult === 'd') return RESULT_EMOJI['draw'];
  if (lowerResult.includes('dq')) return RESULT_EMOJI['dq'];
  if (lowerResult.includes('nc') || lowerResult.includes('no contest')) return RESULT_EMOJI['nc'];
  return RESULT_EMOJI['nc'];
};

// Modified calculateChartData function with proper type handling
function calculateChartData(stats: FighterStats | null): ChartDataSet {
  if (!stats) return {
    strikeData: [],
    strikeAccuracyData: [],
    grappleData: [],
    grappleAccuracyData: [],
    overallStats: [],
    strikeDistribution: []
  }

  const slpm = safeParseFloat(stats.slpm);
  const sapm = safeParseFloat(stats.sapm);
  const strAcc = safeParseFloat(stats.str_acc);
  const strDef = safeParseFloat(stats.str_def);
  const tdAvg = safeParseFloat(stats.td_avg);
  const subAvg = safeParseFloat(stats.sub_avg);
  const tdAcc = safeParseFloat(stats.td_acc);
  const tdDef = safeParseFloat(stats.td_def);

  return {
    strikeData: [
      { name: 'Strikes Landed/min', value: slpm, color: '#3b82f6' },
      { name: 'Strikes Absorbed/min', value: sapm, color: '#3b82f6' },
    ],
    strikeAccuracyData: [
      { name: 'Strike Accuracy', value: strAcc, color: '#3b82f6' },
      { name: 'Strike Defense', value: strDef, color: '#3b82f6' },
    ],
    grappleData: [
      { name: 'Takedowns/15min', value: tdAvg, color: '#3b82f6' },
      { name: 'Submissions/15min', value: subAvg, color: '#3b82f6' },
    ],
    grappleAccuracyData: [
      { name: 'Takedown Accuracy', value: tdAcc, color: '#3b82f6' },
      { name: 'Takedown Defense', value: tdDef, color: '#3b82f6' },
    ],
    overallStats: [
      { subject: 'Strike Power', A: (slpm / 10) * 100 || 0 },
      { subject: 'Strike Defense', A: strDef || 0 },
      { subject: 'Grappling', A: (tdAvg / 5) * 100 || 0 },
      { subject: 'Submission', A: (subAvg / 2) * 100 || 0 },
      { subject: 'Accuracy', A: strAcc || 0 },
    ],
    strikeDistribution: (() => {
      const totalStrikes = slpm + sapm;
      return [
        { name: 'Strikes Landed', value: slpm, percentage: totalStrikes > 0 ? (slpm / totalStrikes) * 100 : 0 },
        { name: 'Strikes Absorbed', value: sapm, percentage: totalStrikes > 0 ? (sapm / totalStrikes) * 100 : 0 },
      ];
    })()
  }
}

// Add this before the FightHistoryView component
const getResultStyles = (result: string) => {
  const lowerResult = result.toLowerCase().trim();
  
  // Win conditions (including variations)
  if (lowerResult.includes('win') || lowerResult === 'w' || lowerResult === 'winner') {
    return {
      bg: 'bg-emerald-500/5',
      ring: 'ring-1 ring-emerald-500/30',
      text: 'text-emerald-500/90 font-medium',
      hover: 'hover:bg-emerald-500/10 hover:ring-emerald-500/50'
    };
  }
  
  // Loss conditions (including variations)
  if (lowerResult.includes('loss') || lowerResult === 'l' || lowerResult.includes('loser')) {
    return {
      bg: 'bg-red-500/5',
      ring: 'ring-1 ring-red-500/30',
      text: 'text-red-500/90 font-medium',
      hover: 'hover:bg-red-500/10 hover:ring-red-500/50'
    };
  }
  
  // Draw conditions
  if (lowerResult.includes('draw') || lowerResult === 'd') {
    return {
      bg: 'bg-amber-500/5',
      ring: 'ring-1 ring-amber-500/30',
      text: 'text-amber-500/90 font-medium',
      hover: 'hover:bg-amber-500/10 hover:ring-amber-500/50'
    };
  }
  
  // DQ conditions
  if (lowerResult.includes('dq') || lowerResult.includes('disqualification')) {
    return {
      bg: 'bg-purple-500/5',
      ring: 'ring-1 ring-purple-500/30',
      text: 'text-purple-500/90 font-medium',
      hover: 'hover:bg-purple-500/10 hover:ring-purple-500/50'
    };
  }
  
  // No Contest and other conditions
  return {
    bg: 'bg-zinc-500/5',
    ring: 'ring-1 ring-zinc-500/30',
    text: 'text-zinc-500/90 font-medium',
    hover: 'hover:bg-zinc-500/10 hover:ring-zinc-500/50'
  };
};

// Add these new constants after the existing ones
const STAT_CATEGORIES = {
  striking: {
    title: "Striking",
    icon: "🥊",
    stats: [
      { key: "slpm", label: "Strikes Landed/min", format: (v: number) => v.toFixed(1) },
      { key: "str_acc", label: "Strike Accuracy", format: (v: number) => `${v}%` },
      { key: "sapm", label: "Strikes Absorbed/min", format: (v: number) => v.toFixed(1) },
      { key: "str_def", label: "Strike Defense", format: (v: number) => `${v}%` }
    ]
  },
  grappling: {
    title: "Grappling",
    icon: "🤼",
    stats: [
      { key: "td_avg", label: "Takedowns/15min", format: (v: number) => v.toFixed(1) },
      { key: "td_acc", label: "Takedown Accuracy", format: (v: number) => `${v}%` },
      { key: "td_def", label: "Takedown Defense", format: (v: number) => `${v}%` },
      { key: "sub_avg", label: "Submissions/15min", format: (v: number) => v.toFixed(1) }
    ]
  }
}

// Add this function before the FighterHeader component
const calculateAge = (dob: string): string => {
  if (!dob) return 'N/A';
  
  try {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return 'N/A';
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age.toString();
  } catch (error) {
    console.error('Error calculating age:', error);
    return 'N/A';
  }
};

// Add this new component for the fighter header
const FighterHeader = ({ stats, imageError, setImageError }: { 
  stats: FighterStats;
  imageError: boolean;
  setImageError: (error: boolean) => void;
}) => {
  const isMobile = useIsMobile();
  const styles = isMobile ? MOBILE_STYLES : DESKTOP_STYLES;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-lg p-4 md:p-6 bg-card/80 backdrop-blur-sm border border-primary/10"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-center">
        {/* Fighter Image */}
        <div className="flex justify-center">
          <motion.div
            className={cn(
              "fighter-image-container relative overflow-hidden",
              isMobile ? "rounded-full ring-2 ring-primary/20" : "",
              styles.imageSize
            )}
          >
            {!imageError ? (
              <Image
                src={stats.image_url || DEFAULT_PLACEHOLDER_IMAGE} 
                alt={stats.name}
                width={isMobile ? 128 : 256}
                height={isMobile ? 128 : 256}
                className={cn(
                  "object-cover w-full h-full",
                  !isMobile && "rounded-lg"
                )}
                onError={() => setImageError(true)}
                priority
              />
            ) : (
              <div className="w-full h-full bg-background/60 flex items-center justify-center">
                <span className="text-muted-foreground">No image</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Fighter Info */}
        <div className="md:col-span-2 flex flex-col justify-between text-center md:text-left">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-2 md:space-y-4"
          >
            <div>
              <h2 className={cn(
                "font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80",
                styles.headerText
              )}>
                {stats.name}
              </h2>
              {stats.nickname && (
                <p className={cn("text-primary/90 mt-1", styles.subText)}>"{stats.nickname}"</p>
              )}
              <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                <p className={cn("font-semibold", styles.headerText)}>{stats.record}</p>
                {Number(stats.ranking) !== 99 && stats.ranking !== '99' && (
                  <Badge variant="secondary" className={cn("px-2 py-0.5 font-medium bg-accent/20 ring-1 ring-white/20", styles.subText)}>
                    {formatRanking(String(stats.ranking))}
                  </Badge>
                )}
              </div>
              {stats.weight_class && (
                <p className={cn("text-muted-foreground mt-1", styles.subText)}>{stats.weight_class}</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'Height', value: stats.height || 'N/A', icon: '📏' },
                { label: 'Weight', value: stats.weight || 'N/A', icon: '⚖️' },
                { label: 'Reach', value: stats.reach || 'N/A', icon: '🤜' },
                { label: 'Stance', value: stats.stance || 'N/A', icon: '🥋' },
                { label: 'Age', value: stats.dob ? calculateAge(stats.dob) : 'N/A', icon: '📅' },
                { label: 'Status', value: Number(stats.ranking) === 99 ? 'Unranked' : 'Ranked', icon: '📊' },
              ].map(({ label, value, icon }) => (
                <motion.div 
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "bg-background/60 backdrop-blur-sm rounded-lg ring-1 ring-primary/10 transition-all duration-300 hover:bg-background/80 hover:ring-primary/20 hover:shadow-lg",
                    styles.statsCard
                  )}
                >
                  <div className="flex items-center justify-center md:justify-start gap-1">
                    <span role="img" aria-label={label}>{icon}</span>
                    <p className={cn("text-muted-foreground", styles.statsLabel)}>{label}</p>
                  </div>
                  <p className={cn("font-medium truncate text-center md:text-left", styles.statsLabel)}>{value}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

const formatRanking = (ranking: string | null): string => {
  if (!ranking) return '';
  const rankNum = parseInt(ranking);
  if (isNaN(rankNum)) return '';
  if (rankNum === 1) return 'Champion';
  if (rankNum >= 2 && rankNum <= 16) return `#${rankNum - 1}`;
  return '';  // Return empty string for unranked (99) or invalid rankings
};

// Move FightHistoryView outside of FighterDetails
const FightHistoryView = ({ 
  fightHistory, 
  selectedFight, 
  setSelectedFight 
}: { 
  fightHistory: FightHistory[], 
  selectedFight: Fight | null, 
  setSelectedFight: (fight: Fight | null) => void 
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 relative">
      <h4 className="text-xl font-medium tracking-tight mb-6">
        Fight History
      </h4>
      
      <AnimatePresence>
        {selectedFight && (
          <motion.div className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              onClick={() => setSelectedFight(null)}
            />
            
            {/* Modal Container */}
            <div 
              className="fixed inset-0 z-[101] overflow-hidden flex items-center justify-center"
              onClick={() => setSelectedFight(null)}
            >
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ 
                  duration: 0.15,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="relative w-[95vw] max-w-3xl max-h-[90vh] bg-card/95 backdrop-blur-xl border border-primary/10 rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header - Always visible */}
                <div className="sticky top-0 z-[102] flex items-center justify-between border-b border-primary/10 bg-card/95 backdrop-blur-xl p-4">
                  <h3 className="text-xl font-semibold truncate pr-4">{selectedFight.event}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-white/10 shrink-0"
                    onClick={() => setSelectedFight(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Scrollable Content */}
                <div className={cn(
                  "overflow-y-auto",
                  isMobile ? "max-h-[70vh]" : ""
                )}>
                  <div className="p-4 md:p-6">
                    <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                      {/* Fight Details */}
                      <div className="space-y-4 md:space-y-6">
                        <div className="space-y-3">
                          <h4 className="text-lg font-medium flex items-center gap-2">
                            <span role="img" aria-label="Fight Details">⚔️</span>
                            Fight Details
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: "Method", value: selectedFight.method, icon: getMethodIcon(selectedFight.method) },
                              { label: "Round", value: selectedFight.round, icon: "🔄" },
                              { label: "Time", value: selectedFight.time, icon: "⏱️" },
                              { label: "Date", value: formatDate(selectedFight.date || selectedFight.fight_date || ''), icon: "📅" }
                            ].map(({ label, value, icon }) => (
                              <motion.div
                                key={label}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-accent/20 rounded-lg p-3 ring-1 ring-white/10"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span role="img" aria-label={label}>{icon}</span>
                                  <p className="text-sm text-muted-foreground">{label}</p>
                                </div>
                                <p className="font-medium">{value}</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-lg font-medium flex items-center gap-2">
                            <span role="img" aria-label="Opponent">🥊</span>
                            Opponent
                          </h4>
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-accent/20 rounded-lg p-4 ring-1 ring-primary/10"
                          >
                            <p className="text-xl font-medium mb-2">
                              {selectedFight.opponent_display_name || selectedFight.opponent}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Result:</span>
                              <span className={cn(
                                "text-sm font-medium px-2 py-1 rounded-full",
                                selectedFight.result.toLowerCase().includes('win') && "bg-emerald-500/20 text-emerald-500",
                                selectedFight.result.toLowerCase().includes('loss') && "bg-red-500/20 text-red-500",
                                !selectedFight.result.toLowerCase().includes('win') && 
                                !selectedFight.result.toLowerCase().includes('loss') && "bg-yellow-500/20 text-yellow-500"
                              )}>
                                {selectedFight.result}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Fight Stats */}
                      <div className="space-y-4 md:space-y-6">
                        {selectedFight.sig_str && (
                          <div className="space-y-3">
                            <h4 className="text-lg font-medium flex items-center gap-2">
                              <span role="img" aria-label="Strike Stats">🎯</span>
                              Strike Stats
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              {[
                                { label: "Significant Strikes", value: selectedFight.sig_str },
                                { label: "Accuracy", value: selectedFight.sig_str_pct },
                                { label: "Total Strikes", value: selectedFight.total_str },
                                { label: "Head Strikes", value: selectedFight.head_str },
                                { label: "Body Strikes", value: selectedFight.body_str },
                                { label: "Leg Strikes", value: selectedFight.leg_str }
                              ].filter(stat => stat.value).map(({ label, value }, index) => (
                                <motion.div
                                  key={label}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="bg-accent/20 rounded-lg p-3 ring-1 ring-white/10"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">{label}</span>
                                    <span className="font-medium">{value}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedFight.takedowns && (
                          <div className="space-y-3">
                            <h4 className="text-lg font-medium flex items-center gap-2">
                              <span role="img" aria-label="Grappling">🤼</span>
                              Grappling
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              {[
                                { label: "Takedowns", value: selectedFight.takedowns },
                                { label: "Success Rate", value: selectedFight.td_pct },
                                { label: "Control Time", value: selectedFight.ctrl }
                              ].filter(stat => stat.value).map(({ label, value }, index) => (
                                <motion.div
                                  key={label}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.2 + index * 0.05 }}
                                  className="bg-accent/20 rounded-lg p-3 ring-1 ring-white/10"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">{label}</span>
                                    <span className="font-medium">{value}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!fightHistory || fightHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No fight history available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fightHistory.map((fight, index) => {
            if (!fight) return null;
            
            const displayName = fight.opponent_display_name || fight.opponent || fight.opponent_name || "Unknown Opponent";
            const fightDate = fight.fight_date || fight.date || "Unknown Date";
            const fightResult = fight.result || "NC";
            const methodIcon = getMethodIcon(fight.method || '');
            
            const styles = getResultStyles(fightResult);
            
            return (
              <motion.button
                key={`${displayName}-${fightDate}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={cn(
                  "group relative z-10 w-full text-left",
                  "rounded-xl p-6",
                  "bg-card/50 backdrop-blur-sm border border-primary/10",
                  "hover:bg-card/60 hover:border-primary/20",
                  "transition-all duration-300",
                  selectedFight === fight && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedFight(fight)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium truncate group-hover:text-foreground/90">{displayName}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDate(fightDate)}</span>
                        <span className={`text-sm ${styles.text}`}>
                          • {fightResult}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span role="img" aria-label={fight.method} className="text-base">{methodIcon}</span>
                      <span className="text-sm text-muted-foreground">{fight.method || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Add responsive container styles
const responsiveContainerStyles = {
  width: '100%',
  height: '100%',
  minHeight: '160px',
  '@media (max-width: 640px)': {
    minHeight: '140px',
  },
};

const StatsView = ({ stats, chartData }: { stats: FighterStats; chartData: ChartDataSet }) => {
  const isMobile = useIsMobile();
  const styles = isMobile ? MOBILE_STYLES : DESKTOP_STYLES;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Striking Stats */}
      <Card className="overflow-hidden bg-card/60 backdrop-blur-xl border-primary/10">
        <CardHeader className="border-b border-primary/10 py-2 md:py-3">
          <CardTitle className={cn("flex items-center justify-center gap-2 text-center w-full", styles.statsTitle)}>
            <span role="img" aria-label="Striking" className="flex-shrink-0">🥊</span>
            <span className="flex-shrink-0">Striking Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("p-2 md:p-4", styles.statsCard)}>
          <div className={cn("grid gap-2 md:gap-4", styles.statsGrid)}>
            {[
              { label: "Strikes Landed/min", value: safeParseFloat(stats.slpm).toFixed(1), desc: "Striking Output" },
              { label: "Strike Accuracy", value: `${safeParseFloat(stats.str_acc).toFixed(1)}%`, desc: "Strike Success Rate" },
              { label: "Strikes Absorbed/min", value: safeParseFloat(stats.sapm).toFixed(1), desc: "Strikes Received" },
              { label: "Strike Defense", value: `${safeParseFloat(stats.str_def).toFixed(1)}%`, desc: "Strike Evasion Rate" }
            ].map((stat, index) => (
              <div 
                key={stat.label} 
                className="space-y-1 p-2 md:p-3 bg-accent/20 rounded-lg ring-1 ring-white/10 hover:ring-white/20 transition-all duration-300"
              >
                <p className={cn("text-muted-foreground", styles.statsLabel)}>{stat.label}</p>
                <p className={cn("font-bold", styles.statsValue)}>{stat.value}</p>
                <p className={cn("text-muted-foreground", styles.statsLabel)}>{stat.desc}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="mt-4 space-y-4">
            {/* Strike Distribution Chart */}
            <div className={styles.chartHeight}>
              <h4 className={cn("mb-2 font-medium", styles.statsLabel)}>Strike Distribution</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.strikeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <YAxis 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))">
                    {chartData.strikeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.7)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Strike Accuracy Chart */}
            <div className={styles.chartHeight}>
              <h4 className={cn("mb-2 font-medium", styles.statsLabel)}>Strike Accuracy</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.strikeAccuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <YAxis 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grappling Stats */}
      <Card className="overflow-hidden bg-card/60 backdrop-blur-xl border-primary/10">
        <CardHeader className="border-b border-primary/10 py-2 md:py-3">
          <CardTitle className={cn("flex items-center justify-center gap-2 text-center w-full", styles.statsTitle)}>
            <span role="img" aria-label="Grappling" className="flex-shrink-0">🤼</span>
            <span className="flex-shrink-0">Grappling Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("p-2 md:p-4", styles.statsCard)}>
          <div className={cn("grid gap-2 md:gap-4", styles.statsGrid)}>
            {[
              { label: "Takedowns/15min", value: safeParseFloat(stats.td_avg).toFixed(1), desc: "Grappling Frequency" },
              { label: "Takedown Accuracy", value: `${safeParseFloat(stats.td_acc).toFixed(1)}%`, desc: "Takedown Success Rate" },
              { label: "Takedown Defense", value: `${safeParseFloat(stats.td_def).toFixed(1)}%`, desc: "Takedown Prevention" },
              { label: "Submissions/15min", value: safeParseFloat(stats.sub_avg).toFixed(1), desc: "Submission Threat" }
            ].map((stat, index) => (
              <div 
                key={stat.label} 
                className="space-y-1 p-2 md:p-3 bg-accent/20 rounded-lg ring-1 ring-white/10 hover:ring-white/20 transition-all duration-300"
              >
                <p className={cn("text-muted-foreground", styles.statsLabel)}>{stat.label}</p>
                <p className={cn("font-bold", styles.statsValue)}>{stat.value}</p>
                <p className={cn("text-muted-foreground", styles.statsLabel)}>{stat.desc}</p>
              </div>
            ))}
          </div>

          {/* Grappling Charts */}
          <div className="mt-4 space-y-4">
            {/* Grappling Stats Chart */}
            <div className={styles.chartHeight}>
              <h4 className={cn("mb-2 font-medium", styles.statsLabel)}>Grappling Performance</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.grappleData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <YAxis 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Grappling Accuracy Chart */}
            <div className={styles.chartHeight}>
              <h4 className={cn("mb-2 font-medium", styles.statsLabel)}>Grappling Accuracy</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.grappleAccuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <YAxis 
                    tick={{ fill: 'currentColor', fontSize: isMobile ? 10 : 12 }}
                    stroke="currentColor"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export function FighterDetails({ fighterName }: FighterDetailsProps) {
  const [stats, setStats] = React.useState<FighterStats | null>(null)
  const [fightHistory, setFightHistory] = React.useState<FightHistory[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [imageError, setImageError] = React.useState(false)
  const [selectedFight, setSelectedFight] = React.useState<Fight | null>(null)
  const [activeTab, setActiveTab] = React.useState<string>('overview')

  // Fetch fighter data and fight history
  React.useEffect(() => {
    const fetchFighterData = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Clean the fighter name to remove any trailing "- N/A" which causes API issues
        const cleanedFighterName = fighterName.replace(/ - N\/A$/, '');
        
        // Use fetchWithRetries for robust API calls
        const response = await fetchWithRetries(ENDPOINTS.FIGHTER(cleanedFighterName));
        
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Fighter not found' : `Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // Check if there was an error from the API
        if (data.status === 'error') {
          throw new Error(data.detail || 'Error fetching fighter data');
        }
        
        // Check for fight history data
        if (!data.last_5_fights) {
          // Try looking for fights under other keys
          const possibleKeys = ['last_5_fights', 'fights', 'fight_history', 'fightHistory'];
          for (const key of possibleKeys) {
            if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
              data.last_5_fights = data[key];
              break;
            }
          }
        }
        
        // Map and sanitize fight history data if available
        const processedFightHistory = Array.isArray(data.last_5_fights) 
          ? data.last_5_fights.map((fight: Fight) => ({
              id: fight.id,
              fighter_name: String(fight.fighter_name || ''),
              fight_url: String(fight.fight_url || ''),
              opponent: String(fight.opponent || ''),
              date: String(fight.date || fight.fight_date || 'Unknown Date'),
              fight_date: String(fight.fight_date || fight.date || 'Unknown Date'),
              opponent_name: String(fight.opponent_name || fight.opponent || 'Unknown Opponent'),
              opponent_display_name: String(fight.opponent_display_name || fight.opponent || 'Unknown Opponent'),
              result: String(fight.result || 'NC'),
              method: String(fight.method || 'N/A'),
              round: Number(fight.round || 0),
              time: String(fight.time || '0:00'),
              event: String(fight.event || 'Unknown Event'),
              kd: String(fight.kd || '0'),
              sig_str: String(fight.sig_str || '0/0'),
              sig_str_pct: String(fight.sig_str_pct || '0%'),
              total_str: String(fight.total_str || '0/0'),
              head_str: String(fight.head_str || '0/0'),
              body_str: String(fight.body_str || '0/0'),
              leg_str: String(fight.leg_str || '0/0'),
              takedowns: String(fight.takedowns || '0/0'),
              td_pct: String(fight.td_pct || '0%'),
              ctrl: String(fight.ctrl || '0:00'),
            }))
          : [];

        // Properly map API fields to our expected structure
        const sanitizedData: Record<string, any> = {
          name: data?.fighter_name || data?.name || fighterName || '',
          image_url: data?.image_url || DEFAULT_PLACEHOLDER_IMAGE,
          record: data?.Record || data?.record || DEFAULT_VALUE,
          height: data?.Height || data?.height || DEFAULT_VALUE,
          weight: data?.Weight || data?.weight || DEFAULT_VALUE,
          reach: data?.Reach || data?.reach || DEFAULT_VALUE,
          stance: data?.STANCE || data?.stance || DEFAULT_VALUE,
          dob: data?.DOB || data?.dob || '',
          slpm: data?.SLpM || data?.SLPM || data?.slpm || DEFAULT_VALUE,
          str_acc: data?.['Str. Acc.'] || data?.str_acc || DEFAULT_PERCENTAGE,
          sapm: data?.SApM || data?.SAPM || data?.sapm || DEFAULT_VALUE,
          str_def: data?.['Str. Def'] || data?.str_def || DEFAULT_PERCENTAGE,
          td_avg: data?.['TD Avg.'] || data?.td_avg || DEFAULT_VALUE,
          td_acc: data?.['TD Acc.'] || data?.td_acc || DEFAULT_PERCENTAGE,
          td_def: data?.['TD Def.'] || data?.td_def || DEFAULT_PERCENTAGE,
          sub_avg: data?.['Sub. Avg.'] || data?.sub_avg || DEFAULT_VALUE,
          weight_class: data?.weight_class || '',
          nickname: data?.nickname || '',
          last_5_fights: processedFightHistory, // Use the processed fight history
          ranking: data?.ranking || UNRANKED_VALUE,
          tap_link: data?.tap_link || '',
        };
        
        setStats(sanitizedData as FighterStats);
        setFightHistory(processedFightHistory);
      } catch (err) {
        console.error('Error fetching fighter:', err);
        setError('Failed to load fighter data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFighterData();
  }, [fighterName]);

  // Create a function to refetch data that can be called from UI
  const refetchFighterData = () => {
    setIsLoading(true);
    setError(null);
    
    // We need to create a new function here because fetchFighterData is scoped to the useEffect
    const refetch = async () => {
      try {
        // Clean the fighter name to remove any trailing "- N/A" which causes API issues
        const cleanedFighterName = fighterName.replace(/ - N\/A$/, '');
        
        const response = await fetchWithRetries(ENDPOINTS.FIGHTER(cleanedFighterName));
        
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Fighter not found' : `Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // Check if there was an error from the API
        if (data.status === 'error') {
          throw new Error(data.detail || 'Error fetching fighter data');
        }
        
        // Check for fight history data
        if (!data.last_5_fights) {
          // Try looking for fights under other keys
          const possibleKeys = ['last_5_fights', 'fights', 'fight_history', 'fightHistory'];
          for (const key of possibleKeys) {
            if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
              data.last_5_fights = data[key];
              break;
            }
          }
        }
        
        // Map and sanitize fight history data if available
        const processedFightHistory = Array.isArray(data.last_5_fights) 
          ? data.last_5_fights.map((fight: Fight) => ({
              id: fight.id,
              fighter_name: String(fight.fighter_name || ''),
              fight_url: String(fight.fight_url || ''),
              opponent: String(fight.opponent || ''),
              date: String(fight.date || fight.fight_date || 'Unknown Date'),
              fight_date: String(fight.fight_date || fight.date || 'Unknown Date'),
              opponent_name: String(fight.opponent_name || fight.opponent || 'Unknown Opponent'),
              opponent_display_name: String(fight.opponent_display_name || fight.opponent || 'Unknown Opponent'),
              result: String(fight.result || 'NC'),
              method: String(fight.method || 'N/A'),
              round: Number(fight.round || 0),
              time: String(fight.time || '0:00'),
              event: String(fight.event || 'Unknown Event'),
              kd: String(fight.kd || '0'),
              sig_str: String(fight.sig_str || '0/0'),
              sig_str_pct: String(fight.sig_str_pct || '0%'),
              total_str: String(fight.total_str || '0/0'),
              head_str: String(fight.head_str || '0/0'),
              body_str: String(fight.body_str || '0/0'),
              leg_str: String(fight.leg_str || '0/0'),
              takedowns: String(fight.takedowns || '0/0'),
              td_pct: String(fight.td_pct || '0%'),
              ctrl: String(fight.ctrl || '0:00'),
            }))
          : [];

        // Properly map API fields to our expected structure
        const sanitizedData: Record<string, any> = {
          name: data?.fighter_name || data?.name || fighterName || '',
          image_url: data?.image_url || DEFAULT_PLACEHOLDER_IMAGE,
          record: data?.Record || data?.record || DEFAULT_VALUE,
          height: data?.Height || data?.height || DEFAULT_VALUE,
          weight: data?.Weight || data?.weight || DEFAULT_VALUE,
          reach: data?.Reach || data?.reach || DEFAULT_VALUE,
          stance: data?.STANCE || data?.stance || DEFAULT_VALUE,
          dob: data?.DOB || data?.dob || '',
          slpm: data?.SLpM || data?.SLPM || data?.slpm || DEFAULT_VALUE,
          str_acc: data?.['Str. Acc.'] || data?.str_acc || DEFAULT_PERCENTAGE,
          sapm: data?.SApM || data?.SAPM || data?.sapm || DEFAULT_VALUE,
          str_def: data?.['Str. Def'] || data?.str_def || DEFAULT_PERCENTAGE,
          td_avg: data?.['TD Avg.'] || data?.td_avg || DEFAULT_VALUE,
          td_acc: data?.['TD Acc.'] || data?.td_acc || DEFAULT_PERCENTAGE,
          td_def: data?.['TD Def.'] || data?.td_def || DEFAULT_PERCENTAGE,
          sub_avg: data?.['Sub. Avg.'] || data?.sub_avg || DEFAULT_VALUE,
          weight_class: data?.weight_class || '',
          nickname: data?.nickname || '',
          last_5_fights: processedFightHistory, // Use the processed fight history
          ranking: data?.ranking || UNRANKED_VALUE,
          tap_link: data?.tap_link || '',
        };
        
        setStats(sanitizedData as FighterStats);
        setFightHistory(processedFightHistory);
      } catch (err) {
        console.error('Error refetching fighter:', err);
        setError('Failed to load fighter data. Please try again later.');
        setIsLoading(false);
      }
    };
    
    refetch();
  };

  // Calculate all chart data at once
  const chartData = React.useMemo(() => calculateChartData(stats), [stats]);

  // Calculate fight stats
  const fightStats = React.useMemo<FightStatCategory[]>(() => {
    if (!stats) return [];
    
    return [
      { 
        category: 'Striking', 
        stats: [
          { label: 'Strikes Landed/min', value: safeParseFloat(stats.slpm).toFixed(1) },
          { label: 'Strike Accuracy', value: safeReplacePercent(stats.str_acc) },
          { label: 'Strikes Absorbed/min', value: safeParseFloat(stats.sapm).toFixed(1) },
          { label: 'Strike Defense', value: safeReplacePercent(stats.str_def) },
        ]
      },
      { 
        category: 'Grappling', 
        stats: [
          { label: 'Takedowns/15min', value: safeParseFloat(stats.td_avg).toFixed(1) },
          { label: 'Takedown Accuracy', value: safeReplacePercent(stats.td_acc) },
          { label: 'Takedown Defense', value: safeReplacePercent(stats.td_def) },
          { label: 'Submissions/15min', value: safeParseFloat(stats.sub_avg).toFixed(1) },
        ]
      },
    ];
  }, [stats]);

  // Create a utility function to safely get stats and apply fallbacks
  const getStat = (value: string | undefined, fallback: string = DEFAULT_VALUE): string => {
    return value || fallback;
  };

  // Render component based on loading and error states
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 mb-4 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-muted-foreground">Loading fighter data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-12 h-12 mb-4 text-destructive" />
        <h3 className="text-xl font-bold mb-2">Error Loading Fighter Data</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button 
          variant="outline" 
          onClick={refetchFighterData}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (!stats) {
    return <div className="p-8 text-center">No fighter data available</div>
  }

  const getFightResultColor = (result: string): string => {
    const lowerResult = result.toLowerCase().trim();
    
    // Win conditions (including variations)
    if (lowerResult.includes('win') || lowerResult === 'w') {
      return 'bg-emerald-500/90 border-emerald-500';
    }
    
    // Loss conditions (including DQ and variations)
    if (lowerResult.includes('loss') || lowerResult.includes('dq') || lowerResult === 'l') {
      return 'bg-red-500/90 border-red-500';
    }
    
    // No Contest (including variations)
    if (lowerResult.includes('nc') || lowerResult.includes('no contest') || lowerResult === 'n/a') {
      return 'bg-zinc-500/90 border-zinc-500';
    }
    
    // Draw (including variations)
    if (lowerResult.includes('draw') || lowerResult === 'd') {
      return 'bg-amber-500/90 border-amber-500';
    }
    
    // Default case
    return 'bg-zinc-500/90 border-zinc-500';
  };

  // Overview tab content
  const OverviewView = () => {
    const isMobile = useIsMobile();
    
    // Use getStat function to safely access properties
    const offense = [
      { label: "Strikes Landed per Min", value: getStat(stats?.slpm) },
      { label: "Striking Accuracy", value: getStat(stats?.str_acc, DEFAULT_PERCENTAGE) },
      { label: "Strikes Absorbed per Min", value: getStat(stats?.sapm) },
      { label: "Striking Defense", value: getStat(stats?.str_def, DEFAULT_PERCENTAGE) }
    ];
    
    const grappling = [
      { label: "Takedown Avg per 15 Min", value: getStat(stats?.td_avg) },
      { label: "Takedown Accuracy", value: getStat(stats?.td_acc, DEFAULT_PERCENTAGE) },
      { label: "Takedown Defense", value: getStat(stats?.td_def, DEFAULT_PERCENTAGE) },
      { label: "Submission Avg per 15 Min", value: getStat(stats?.sub_avg) }
    ];
    
    return (
      <div className="grid gap-6">
        {/* Fighter Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Fighter Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Radar Chart */}
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData.overallStats}>
                    <PolarGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.2} />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      stroke="currentColor"
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]} 
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      stroke="currentColor" 
                      strokeOpacity={0.2} 
                    />
                    <Radar
                      name={stats.name}
                      dataKey="A"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.6}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Quick Stats */}
              <div className="space-y-4">
                <h3 className={cn(
                  "font-semibold",
                  isMobile ? "text-base" : "text-lg"
                )}>Quick Stats</h3>
                <div className="grid grid-cols-2 gap-2">
                  {fightStats.map((category) => (
                    <div key={category.category} className="space-y-2">
                      <h4 className={cn(
                        "font-medium text-muted-foreground",
                        isMobile ? "text-xs" : "text-sm"
                      )}>{category.category}</h4>
                      {category.stats.map((stat) => (
                        <div key={stat.label} className="flex justify-between items-center gap-2">
                          <span className={cn(
                            "text-muted-foreground",
                            isMobile ? "text-xs" : "text-sm"
                          )}>{stat.label}</span>
                          <span className={cn(
                            "font-semibold",
                            isMobile ? "text-xs" : "text-sm"
                          )}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        <div className="space-y-6 md:space-y-8">
          {/* Fighter Header */}
          <FighterHeader stats={stats} imageError={imageError} setImageError={setImageError} />

          {/* Stats and History Tabs */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="animate-in fade-in duration-500"
          >
            <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6 md:mb-8">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="fights">Fights</TabsTrigger>
              </TabsList>

              <div className="relative min-h-[500px]">
                <AnimatePresence mode="wait">
                  {activeTab === "overview" && (
                    <TabsContent 
                      value="overview"
                      key="overview"
                      className="space-y-6 md:space-y-8 [&>*]:animate-in [&>*]:fade-in-50 [&>*]:duration-500"
                    >
                      <OverviewView />
                    </TabsContent>
                  )}

                  {activeTab === "stats" && (
                    <TabsContent 
                      value="stats"
                      key="stats"
                      className="space-y-6 md:space-y-8 [&>*]:animate-in [&>*]:fade-in-50 [&>*]:duration-500"
                    >
                      <StatsView stats={stats} chartData={chartData} />
                    </TabsContent>
                  )}

                  {activeTab === "fights" && (
                    <TabsContent 
                      value="fights"
                      key="fights"
                      className="[&>*]:animate-in [&>*]:fade-in-50 [&>*]:duration-500"
                    >
                      <FightHistoryView fightHistory={fightHistory} selectedFight={selectedFight} setSelectedFight={setSelectedFight} />
                    </TabsContent>
                  )}
                </AnimatePresence>
              </div>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  )
} 