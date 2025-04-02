"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ENDPOINTS } from "@/lib/api-config"
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
import { ChevronDown, ChevronUp } from "lucide-react"
import { FighterStats, FightHistory } from "@/types/fighter"
import { formatDate } from "@/lib/utils"

// Constants
const DEFAULT_PLACEHOLDER_IMAGE = '/placeholder-fighter.png'
const DEFAULT_VALUE = "0"
const DEFAULT_PERCENTAGE = "0%"
const UNRANKED_VALUE = 99

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
  id?: string;
  fighter_name: string;
  fight_url: string;
  opponent: string;
  date: string;
  fight_date: string;
  opponent_name: string;
  opponent_display_name: string;
  result: string;
  method: string;
  round: number;
  time: string;
  event: string;
  kd: string;
  sig_str: string;
  sig_str_pct: string;
  total_str: string;
  head_str: string;
  body_str: string;
  leg_str: string;
  takedowns: string;
  td_pct: string;
  ctrl: string;
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

export function FighterDetails({ fighterName }: FighterDetailsProps) {
  const [stats, setStats] = React.useState<FighterStats | null>(null)
  const [fightHistory, setFightHistory] = React.useState<FightHistory[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [imageError, setImageError] = React.useState(false)
  const [expandedFight, setExpandedFight] = React.useState<number | null>(null)

  // Fetch fighter data and fight history
  React.useEffect(() => {
    const fetchFighterData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(ENDPOINTS.FIGHTER(fighterName));
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Fighter not found' : 'Failed to fetch fighter data');
        }

        const data = await response.json();
        
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

  const calculateAge = (dob: string) => {
    // Return empty string if DOB is not provided
    if (!dob) return '';
    
    try {
      // Check if the date is in a valid format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) && 
          !/^\d{2}\/\d{2}\/\d{4}$/.test(dob) &&
          !/^\w+ \d{1,2}, \d{4}$/.test(dob)) {
        return '';
      }
      
    const birthDate = new Date(dob);
      // Check if the date is valid
      if (isNaN(birthDate.getTime())) {
        return '';
      }
      
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
      
      // Ensure age is reasonable (between 18 and 50 for fighters)
      if (age < 18 || age > 50) {
        console.warn(`Calculated age ${age} from DOB ${dob} seems suspicious`);
        return '';
      }
    
    return age;
    } catch (error) {
      console.error(`Error calculating age from DOB: ${dob}`, error);
      return '';
    }
  };

  // Create a utility function to safely get stats and apply fallbacks
  const getStat = (value: string | undefined, fallback: string = DEFAULT_VALUE): string => {
    return value || fallback;
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading fighter data...</div>
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive border border-destructive rounded-lg">
        {error}
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

  // Fight history tab content
  const FightHistoryView = () => {
    return (
      <div className="space-y-4 overflow-hidden">
        <h4 className="text-xl font-medium tracking-tight mb-6">
          Fight History
        </h4>
        
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
                <div 
                  key={`${displayName}-${fightDate}-${index}`}
                  data-expanded={expandedFight === index}
                  className={`group relative overflow-hidden rounded-xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${styles.bg} ${styles.ring} ${styles.hover} hover:shadow-sm`}
                >
                  <div 
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => setExpandedFight(expandedFight === index ? null : index)}
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
                      
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] text-muted-foreground group-hover:text-foreground/70 ${
                          expandedFight === index ? 'rotate-180' : ''
                        }`}
                      />
                    </div>

                    <div 
                      className={`grid transition-[grid-template-rows,opacity,transform] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        expandedFight === index ? 'grid-rows-[1fr] opacity-100 translate-y-0' : 'grid-rows-[0fr] opacity-0 -translate-y-2'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className={`pt-4 mt-4 border-t border-border/5`}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                              { label: "Knockdowns", value: fight.kd },
                              { label: "Significant Strikes", value: fight.sig_str, subValue: fight.sig_str_pct },
                              { label: "Total Strikes", value: fight.total_str },
                              { label: "Takedowns", value: fight.takedowns, subValue: fight.td_pct }
                            ].map((stat, statIndex) => (
                              <div 
                                key={stat.label}
                                className="bg-background/40 rounded-lg p-3 transition-all duration-300 hover:bg-background/60"
                              >
                                <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
                                <div className="text-xl font-medium">{stat.value}</div>
                                {stat.subValue && (
                                  <div className="text-sm text-muted-foreground mt-1">{stat.subValue}</div>
                                )}
                              </div>
                            ))}
                          </div>

                          {(fight.head_str || fight.body_str || fight.leg_str) && (
                            <div className="mt-4">
                              <div className="text-sm text-muted-foreground mb-3">Strike Distribution</div>
                              <div className="grid grid-cols-3 gap-4">
                                {[
                                  { label: "Head", value: fight.head_str },
                                  { label: "Body", value: fight.body_str },
                                  { label: "Leg", value: fight.leg_str }
                                ].map((stat) => (
                                  <div 
                                    key={stat.label}
                                    className="bg-background/40 rounded-lg p-3 transition-all duration-300 hover:bg-background/60"
                                  >
                                    <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
                                    <div className="text-xl font-medium">{stat.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fight.ctrl && fight.ctrl !== '0:00' && (
                              <div className="bg-background/40 rounded-lg p-3 transition-all duration-300 hover:bg-background/60">
                                <div className="text-sm text-muted-foreground mb-1">Control Time</div>
                                <div className="text-xl font-medium">{fight.ctrl}</div>
                              </div>
                            )}
                            {fight.event && (
                              <div className="bg-background/40 rounded-lg p-3 transition-all duration-300 hover:bg-background/60">
                                <div className="text-sm text-muted-foreground mb-1">Event</div>
                                <div className="text-lg font-medium leading-tight">{fight.event}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Overview tab content
  const OverviewView = () => {
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
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData.overallStats}>
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name={stats.name}
                      dataKey="A"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Quick Stats */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Quick Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  {fightStats.map((category) => (
                    <div key={category.category} className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">{category.category}</h4>
                      {category.stats.map((stat) => (
                        <div key={stat.label} className="flex justify-between items-center">
                          <span className="text-sm">{stat.label}</span>
                          <span className="font-semibold">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strike Distribution Card */}
        <Card>
          <CardHeader>
            <CardTitle>Strike Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.strikeDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 'dataMax + 1']} />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip
                    content={({ payload, label }) => {
                      if (payload && payload.length && payload[0].value != null) {
                        const value = Number(payload[0].value);
                        const percentage = payload[0].payload.percentage;
                        return (
                          <div className="bg-background/95 p-2 rounded-lg border shadow-sm">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm">{`${value.toFixed(1)} strikes/min (${percentage.toFixed(1)}%)`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6">
                    {chartData.strikeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl overflow-x-hidden">
      <div className="space-y-8">
        {/* Fighter Header */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 bg-background/40 backdrop-blur-md p-8 rounded-lg ring-1 ring-white/10">
          {/* Fighter Image */}
          <div className="relative aspect-square md:col-span-1">
            {!imageError ? (
              stats.tap_link ? (
                <a 
                  href={stats.tap_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block w-full h-full transform transition-all duration-300 hover:scale-[1.02] rounded-lg overflow-hidden ring-1 ring-white/10"
                >
                  <img 
                    src={stats.image_url || DEFAULT_PLACEHOLDER_IMAGE} 
                    alt={stats.name}
                    className="w-full h-full object-cover object-top transition-transform duration-500"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                      <span className="text-sm font-medium text-white/90">View on Tapology</span>
                    </div>
                  </div>
                </a>
              ) : (
                <div className="w-full h-full rounded-lg overflow-hidden ring-1 ring-white/10">
                  <img 
                    src={stats.image_url || DEFAULT_PLACEHOLDER_IMAGE} 
                    alt={stats.name}
                    className="w-full h-full object-cover object-top"
                    onError={() => setImageError(true)}
                  />
                </div>
              )
            ) : (
              <div className="w-full h-full bg-background/40 rounded-lg flex items-center justify-center ring-1 ring-white/10">
                <span className="text-muted-foreground">No image available</span>
              </div>
            )}
          </div>

          {/* Fighter Info */}
          <div className="md:col-span-2 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">
                  {stats.name}
                </h2>
                {stats.nickname && (
                  <p className="text-xl text-primary/90 mt-1">"{stats.nickname}"</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-2xl font-semibold">{stats.record}</p>
                  {Number(stats.ranking) !== 99 && stats.ranking !== '99' && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                      Rank #{stats.ranking}
                    </span>
                  )}
                </div>
                {stats.weight_class && (
                  <p className="text-lg text-muted-foreground mt-1">{stats.weight_class}</p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Height', value: stats.height || 'N/A', icon: '📏' },
                  { label: 'Weight', value: stats.weight || 'N/A', icon: '⚖️' },
                  { label: 'Reach', value: stats.reach || 'N/A', icon: '🤜' },
                  { label: 'Stance', value: stats.stance || 'N/A', icon: '🥋' },
                  { label: 'Age', value: stats.dob ? calculateAge(stats.dob) : 'N/A', icon: '📅' },
                  { label: 'Status', value: Number(stats.ranking) === 99 ? 'Unranked' : 'Ranked', icon: '📊' },
                ].map(({ label, value, icon }) => (
                  <div 
                    key={label}
                    className="bg-background/40 backdrop-blur-sm p-3 rounded-lg ring-1 ring-white/10 transition-colors duration-300 hover:bg-background/60"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span role="img" aria-label={label}>{icon}</span>
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                    <p className="font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats and History Tabs */}
        <div className="animate-in fade-in duration-500">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="stats">Detailed Stats</TabsTrigger>
              <TabsTrigger value="history">Fight History</TabsTrigger>
            </TabsList>

            <div className="relative min-h-[500px]">
              <TabsContent 
                value="overview"
                className="space-y-8 [&>*]:animate-in [&>*]:fade-in-50 [&>*]:duration-500"
              >
                <OverviewView />
              </TabsContent>

              <TabsContent 
                value="stats"
                className="space-y-8 [&>*]:animate-in [&>*]:fade-in-50 [&>*]:duration-500"
              >
                {/* Striking Stats */}
                <ErrorBoundary FallbackComponent={ChartErrorFallback}>
                  <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border/5 bg-background/40 backdrop-blur-sm">
                      <CardTitle>Striking Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Strikes Landed per min</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.slpm).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Striking Output</p>
                        </div>
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Strike Accuracy</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.str_acc).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Strike Success Rate</p>
                        </div>
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Strikes Absorbed per min</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.sapm).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Strikes Received</p>
                        </div>
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Strike Defense</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.str_def).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Strike Evasion Rate</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        {/* Strike Output Chart */}
                        <div className="h-[200px]">
                          <h4 className="text-sm font-medium mb-2">Strike Output</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.strikeData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                              />
                              <YAxis 
                                domain={[0, 'dataMax + 2']}
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                              />
                              <Tooltip
                                content={({ payload, label }) => {
                                  if (payload && payload.length && payload[0].value != null) {
                                    const value = Number(payload[0].value);
                                    return (
                                      <div className="bg-background/95 p-2 rounded-lg border shadow-sm">
                                        <p className="font-medium">{label}</p>
                                        <p className="text-sm">{`${value.toFixed(1)} strikes/min`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.strikeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Strike Accuracy Chart */}
                        <div className="h-[200px]">
                          <h4 className="text-sm font-medium mb-2">Strike Accuracy</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.strikeAccuracyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                              />
                              <YAxis 
                                domain={[0, 100]}
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                                tickFormatter={(value) => `${value}%`}
                              />
                              <Tooltip
                                content={({ payload, label }) => {
                                  if (payload && payload.length && payload[0].value != null) {
                                    const value = Number(payload[0].value);
                                    return (
                                      <div className="bg-background/95 p-2 rounded-lg border shadow-sm">
                                        <p className="font-medium">{label}</p>
                                        <p className="text-sm">{`${value}%`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.strikeAccuracyData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ErrorBoundary>

                {/* Grappling Stats */}
                <ErrorBoundary FallbackComponent={ChartErrorFallback}>
                  <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border/5 bg-background/40 backdrop-blur-sm">
                      <CardTitle>Grappling Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Takedowns per 15 min</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.td_avg).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Grappling Frequency</p>
                        </div>
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Takedown Accuracy</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.td_acc).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Takedown Success Rate</p>
                        </div>
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Takedown Defense</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.td_def).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Takedown Prevention</p>
                        </div>
                        <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Submissions per 15 min</p>
                          <p className="text-3xl font-bold">{safeParseFloat(stats.sub_avg).toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Submission Threat</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        {/* Grappling Output Chart */}
                        <div className="h-[200px]">
                          <h4 className="text-sm font-medium mb-2">Grappling Output</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.grappleData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                              />
                              <YAxis 
                                domain={[0, 5]}
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                              />
                              <Tooltip
                                content={({ payload, label }) => {
                                  if (payload && payload.length && payload[0].value != null) {
                                    const value = Number(payload[0].value);
                                    return (
                                      <div className="bg-background/95 p-2 rounded-lg border shadow-sm">
                                        <p className="font-medium">{label}</p>
                                        <p className="text-sm">{`${value.toFixed(1)} per 15min`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.grappleData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Grappling Accuracy Chart */}
                        <div className="h-[200px]">
                          <h4 className="text-sm font-medium mb-2">Grappling Accuracy</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.grappleAccuracyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                              />
                              <YAxis 
                                domain={[0, 100]}
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                                tickFormatter={(value) => `${value}%`}
                              />
                              <Tooltip
                                content={({ payload, label }) => {
                                  if (payload && payload.length && payload[0].value != null) {
                                    const value = Number(payload[0].value);
                                    return (
                                      <div className="bg-background/95 p-2 rounded-lg border shadow-sm">
                                        <p className="font-medium">{label}</p>
                                        <p className="text-sm">{`${value}%`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.grappleAccuracyData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ErrorBoundary>
              </TabsContent>

              <TabsContent 
                value="history"
                className="[&>*]:animate-in [&>*]:fade-in-50 [&>*]:duration-500"
              >
                <FightHistoryView />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
} 